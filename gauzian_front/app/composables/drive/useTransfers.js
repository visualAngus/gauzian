import { ref } from 'vue';
import JSZip from "jszip";

import {
    decryptWithStoredPrivateKey,
    decryptSimpleDataWithDataKey,
    decryptDataWithDataKey,
    encryptWithStoredPublicKey,
    encryptSimpleDataWithDataKey,
    generateDataKey,
} from '~/utils/crypto';

import { useAutoShare } from './useAutoShare';


export function useTransfers({ API_URL, activeFolderId, loadPath, liste_decrypted_items } = {}) {
    let fileIdCounter = 0;

    // Configuration retry
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 1000; // 1 seconde, puis exponentiel

    // Upload-related state (was missing and caused undefined in templates)
    const abortControllers = ref({});
    const listToUpload = ref([]);
    const listUploadInProgress = ref([]);
    const listUploaded = ref([]);
    const fileProgressMap = ref({});
    const simultaneousUploads = 3;

    // État des erreurs pour affichage UI
    const transferErrors = ref({});

    const downloadAbortControllers = ref({});

    const listDownloadInProgress = ref([]);
    const downloadProgressMap = ref({});
    const transferStartTimes = ref({});
    const transferLastProgress = ref({});
    const transferLastUpdate = ref({});
    const transferSpeeds = ref({});
    const transferETAs = ref({});

    const pausedTransfers = ref(new Set());
    const allTransfersPaused = ref(false);
    const isPanelCollapsed = ref(false);

    /**
     * Exécute une fonction avec retry automatique et backoff exponentiel
     */
    const withRetry = async (fn, options = {}) => {
        const { maxRetries = MAX_RETRIES, baseDelay = RETRY_BASE_DELAY, transferId = null, chunkIndex = null } = options;

        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Ne pas retry si c'est une annulation volontaire
                if (error.name === 'AbortError') {
                    throw error;
                }

                // Ne pas retry si c'est une erreur 4xx (erreur client, pas réseau)
                if (error.status >= 400 && error.status < 500) {
                    throw error;
                }

                const isLastAttempt = attempt === maxRetries - 1;
                if (isLastAttempt) {
                    console.error(`Échec définitif après ${maxRetries} tentatives`, error);
                    throw error;
                }

                // Calcul du délai avec backoff exponentiel + jitter
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
                console.warn(`Tentative ${attempt + 1}/${maxRetries} échouée, retry dans ${Math.round(delay)}ms...`,
                    chunkIndex !== null ? `(chunk ${chunkIndex})` : '');

                // Mettre à jour l'état d'erreur pour l'UI
                if (transferId) {
                    transferErrors.value[transferId] = {
                        message: `Retry ${attempt + 1}/${maxRetries}...`,
                        retrying: true,
                    };
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    };

    const updateTransferStats = (transferId, progress, totalSize) => {
        const now = Date.now();

        if (!transferStartTimes.value[transferId]) {
            transferStartTimes.value[transferId] = now;
            transferLastProgress.value[transferId] = 0;
            transferLastUpdate.value[transferId] = now;
            return;
        }

        const timeDiff = (now - transferLastUpdate.value[transferId]) / 1000; // en secondes

        if (timeDiff > 0.5) {
            // Mise à jour toutes les 0.5 secondes
            const progressDiff =
                progress - (transferLastProgress.value[transferId] || 0);
            const bytesPerSecond = (totalSize * progressDiff) / 100 / timeDiff;

            transferSpeeds.value[transferId] = bytesPerSecond;

            if (progress > 0 && progress < 100) {
                const remainingProgress = 100 - progress;
                const eta = (remainingProgress / progressDiff) * timeDiff;
                transferETAs.value[transferId] = eta;
            }

            transferLastProgress.value[transferId] = progress;
            transferLastUpdate.value[transferId] = now;
        }
    };


    const downloadFile = async (item) => {
        const downloadId = `download-${Date.now()}-${Math.random()}`;

        // Créer un AbortController pour ce download
        const abortController = new AbortController();
        downloadAbortControllers.value[downloadId] = abortController;

        try {
            const filename = item.metadata?.filename || "download";
            console.log("Starting download for:", filename);

            // Ajouter à la liste des téléchargements
            listDownloadInProgress.value.push({
                name: filename,
                _downloadId: downloadId,
                _targetFolderId: activeFolderId.value,
            });
            downloadProgressMap.value[downloadId] = 0;

            // Récupérer les infos du fichier depuis l'API
            const fileInfoRes = await fetch(`${API_URL}/drive/file/${item.file_id}`, {
                method: "GET",
                credentials: "include",
                signal: abortController.signal,
            });

            if (!fileInfoRes.ok) {
                throw new Error("Failed to fetch file info");
            }

            const fileInfo = await fileInfoRes.json();

            // Déchiffrer la clé du fichier
            const dataKey = await decryptWithStoredPrivateKey(
                fileInfo.encrypted_file_key,
            );

            // Déchiffrer les métadonnées
            const decryptedMetadataStr = await decryptSimpleDataWithDataKey(
                fileInfo.encrypted_metadata,
                dataKey,
            );
            const metadata = JSON.parse(decryptedMetadataStr);

            const chunks = fileInfo.chunks || [];
            const totalChunks = chunks.length;

            console.log(
                `Downloading ${totalChunks} chunks for file: ${metadata.filename}`,
            );

            // Créer un ReadableStream pour le fichier chiffré
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            // Créer une file d'attente pour l'écriture des chunks
            (async () => {
                try {
                    for (let i = 0; i < chunks.length; i++) {
                        // Vérifier si en pause
                        while (isPaused(downloadId)) {
                            await new Promise((resolve) => setTimeout(resolve, 100));
                        }

                        const chunk = chunks[i];
                        console.log(`Downloading chunk ${i + 1}/${totalChunks}`);

                        // Télécharger le chunk avec retry automatique
                        const chunkData = await withRetry(async () => {
                            const chunkRes = await fetch(
                                `${API_URL}/drive/download_chunk/${chunk.s3_key}`,
                                {
                                    method: "GET",
                                    credentials: "include",
                                    signal: abortController.signal,
                                },
                            );

                            if (!chunkRes.ok) {
                                const error = new Error(`Failed to download chunk ${i}`);
                                error.status = chunkRes.status;
                                throw error;
                            }

                            // Succès - effacer l'état d'erreur
                            if (transferErrors.value[downloadId]) {
                                delete transferErrors.value[downloadId];
                            }

                            return await chunkRes.json();
                        }, { transferId: downloadId, chunkIndex: i });

                        // Déchiffrer le chunk
                        const decryptedChunk = await decryptDataWithDataKey(
                            chunkData.data,
                            chunkData.iv,
                            dataKey,
                        );

                        // Écrire dans le stream
                        await writer.write(decryptedChunk);

                        // Mettre à jour la progression
                        const progress = ((i + 1) / totalChunks) * 100;
                        downloadProgressMap.value[downloadId] = progress;
                        updateTransferStats(downloadId, progress, metadata.size);
                    }

                    await writer.close();
                } catch (error) {
                    await writer.abort(error);
                }
            })();

            // Convertir le stream en blob
            const response = new Response(readable, {
                headers: {
                    "Content-Type": metadata.mime_type || "application/octet-stream",
                },
            });

            const blob = await response.blob();

            // Déclencher le téléchargement directement sans demander où sauvegarder
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = metadata.filename || filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Libérer la mémoire
            URL.revokeObjectURL(url);

            console.log("Download completed successfully");

            // Nettoyer l'AbortController
            delete downloadAbortControllers.value[downloadId];

            // Retirer de la liste des téléchargements
            listDownloadInProgress.value = listDownloadInProgress.value.filter(
                (d) => d._downloadId !== downloadId,
            );
            delete downloadProgressMap.value[downloadId];
            delete transferSpeeds.value[downloadId];
            delete transferETAs.value[downloadId];
        } catch (error) {
            console.error("Error downloading file:", error);

            // Ne pas afficher d'alerte si l'erreur est due à un abort
            if (error.name !== "AbortError") {
                alert(`Erreur lors du téléchargement: ${error.message}`);
            }

            // Nettoyer l'AbortController
            delete downloadAbortControllers.value[downloadId];

            // Retirer de la liste des téléchargements en cas d'erreur
            listDownloadInProgress.value = listDownloadInProgress.value.filter(
                (d) => d._downloadId !== downloadId,
            );
            delete downloadProgressMap.value[downloadId];
            delete transferSpeeds.value[downloadId];
            delete transferETAs.value[downloadId];
        }
    };

    const formatSpeed = (bytesPerSecond) => {
        if (!bytesPerSecond || bytesPerSecond === 0) return "";
        const sizes = ["o/s", "Ko/s", "Mo/s", "Go/s"];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
        return (bytesPerSecond / Math.pow(1024, i)).toFixed(1) + " " + sizes[i];
    };

    const formatETA = (seconds) => {
        if (!seconds || seconds === Infinity) return "";
        if (seconds < 60) return Math.round(seconds) + "s restantes";
        if (seconds < 3600) return Math.round(seconds / 60) + "min restantes";
        return Math.round(seconds / 3600) + "h restantes";
    };

    const getTransferStatus = (transferId, type) => {
        if (pausedTransfers.value.has(transferId)) return "En pause";
        const progress =
            type === "upload"
                ? fileProgressMap.value[transferId]
                : downloadProgressMap.value[transferId];
        if (progress >= 100) return "Terminé";
        if (progress > 0) return "En cours";
        return "En attente";
    };

    const isPaused = (transferId) => {
        return pausedTransfers.value.has(transferId);
    };

    const togglePauseTransfer = (transferId, type) => {
        if (pausedTransfers.value.has(transferId)) {
            pausedTransfers.value.delete(transferId);
        } else {
            pausedTransfers.value.add(transferId);
        }
    };


    const resumeAllTransfers = () => {
        allTransfersPaused.value = false;
        pausedTransfers.value.clear();
    };

    const cancelAllTransfers = () => {
        if (confirm("Voulez-vous vraiment annuler tous les transferts en cours ?")) {
            [...listUploadInProgress.value].forEach((file) =>
                abort_upload(file._uploadId),
            );
            [...listDownloadInProgress.value].forEach((file) =>
                cancelDownload(file._downloadId),
            );
        }
    };

    const cancelDownload = (downloadId) => {
        console.log(`Attempting to cancel download for ID: ${downloadId}`);

        // 1. Annuler les requêtes en cours via AbortController
        const abortController = downloadAbortControllers.value[downloadId];
        if (abortController) {
            abortController.abort();
            delete downloadAbortControllers.value[downloadId];
            console.log(`AbortController signaled for download ID ${downloadId}`);
        }

        // 2. Retirer de la liste des téléchargements
        listDownloadInProgress.value = listDownloadInProgress.value.filter(
            (d) => d._downloadId !== downloadId,
        );

        // 3. Nettoyer la progression et stats
        delete downloadProgressMap.value[downloadId];
        delete transferSpeeds.value[downloadId];
        delete transferETAs.value[downloadId];
        pausedTransfers.value.delete(downloadId);

        console.log(`Download ${downloadId} has been cancelled.`);
    };

    const togglePanelCollapse = () => {
        isPanelCollapsed.value = !isPanelCollapsed.value;
    };


    const abort_upload = async (file_id) => {
        console.log(`Attempting to abort upload for file ID: ${file_id}`);

        // 1. Annuler les requêtes en cours via AbortController
        const abortController = abortControllers.value[file_id];
        if (abortController) {
            abortController.abort();
            delete abortControllers.value[file_id];
            console.log(`AbortController signaled for file ID ${file_id}`);
        }

        // 2. Retirer le fichier de la liste des uploads en cours
        const fileIndex = listUploadInProgress.value.findIndex(
            (f) => f._uploadId === file_id,
        );
        if (fileIndex !== -1) {
            listUploadInProgress.value.splice(fileIndex, 1);
            console.log(`Removed file from upload queue`);
        }

        // Aussi retirer de la liste d'attente
        listToUpload.value = listToUpload.value.filter(
            (f) => f._uploadId !== file_id,
        );
        listUploaded.value = listUploaded.value.filter(
            (f) => f._uploadId !== file_id,
        );

        // 3. Nettoyer la progression et stats
        delete fileProgressMap.value[file_id];
        delete transferSpeeds.value[file_id];
        delete transferETAs.value[file_id];
        delete transferStartTimes.value[file_id];
        delete transferLastProgress.value[file_id];
        delete transferLastUpdate.value[file_id];
        pausedTransfers.value.delete(file_id);

        // 4. Relancer les uploads pour passer au fichier suivant
        startUploads();

        //   POST
        const res = await fetch(`${API_URL}/drive/abort_upload`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file_id: file_id,
            }),
        });

        if (!res.ok) {
            console.error(
                `Failed to notify server about aborting upload for file ID ${file_id}`,
            );
            return;
        }
    };

    const downloadFolderAsZip = async (folderId, folderName) => {
        const downloadId = `download-${Date.now()}-${Math.random()}`;

        // Créer un AbortController pour ce download
        const abortController = new AbortController();
        downloadAbortControllers.value[downloadId] = abortController;

        try {
            console.log("Starting folder download as ZIP:", folderId);

            // Ajouter à la liste des téléchargements
            listDownloadInProgress.value.push({
                name: `${folderName}.zip`,
                _downloadId: downloadId,
                _targetFolderId: activeFolderId.value,
            });
            downloadProgressMap.value[downloadId] = 0;

            // Récupérer la structure complète du dossier
            const contentsRes = await fetch(
                `${API_URL}/drive/folder_contents/${folderId}`,
                {
                    method: "GET",
                    credentials: "include",
                    signal: abortController.signal,
                },
            );

            if (!contentsRes.ok) {
                throw new Error("Failed to fetch folder contents");
            }

            const { contents } = await contentsRes.json();
            console.log(`Retrieved ${contents.length} items from folder`);

            // Créer un ZIP avec streaming
            const zip = new JSZip();

            // Calculer le nombre total de chunks pour la progression précise
            const totalChunks = contents.reduce((sum, item) => {
                if (item.type === "file") {
                    return sum + (item.chunks?.length || 0);
                }
                return sum;
            }, 0);
            let processedChunks = 0;

            // Traiter chaque fichier
            for (const item of contents) {
                if (item.type === "file") {
                    try {
                        // Déchiffrer la clé du fichier
                        const dataKey = await decryptWithStoredPrivateKey(
                            item.encrypted_file_key,
                        );

                        // Déchiffrer les métadonnées
                        const decryptedMetadataStr = await decryptSimpleDataWithDataKey(
                            item.encrypted_metadata,
                            dataKey,
                        );
                        const metadata = JSON.parse(decryptedMetadataStr);

                        // Créer un blob progressivement sans garder tous les chunks en mémoire
                        const decryptedChunks = [];
                        for (let i = 0; i < item.chunks.length; i++) {
                            // Vérifier si en pause
                            while (isPaused(downloadId)) {
                                await new Promise((resolve) => setTimeout(resolve, 100));
                            }

                            const chunk = item.chunks[i];

                            // Download chunk avec retry automatique
                            const chunkData = await withRetry(async () => {
                                const chunkRes = await fetch(
                                    `${API_URL}/drive/download_chunk/${chunk.s3_key}`,
                                    {
                                        method: "GET",
                                        credentials: "include",
                                        signal: abortController.signal,
                                    },
                                );

                                if (!chunkRes.ok) {
                                    const error = new Error(
                                        `Failed to download chunk for file ${metadata.filename}`,
                                    );
                                    error.status = chunkRes.status;
                                    throw error;
                                }

                                // Succès - effacer l'état d'erreur
                                if (transferErrors.value[downloadId]) {
                                    delete transferErrors.value[downloadId];
                                }

                                return await chunkRes.json();
                            }, { transferId: downloadId, chunkIndex: i });
                            const decryptedChunk = await decryptDataWithDataKey(
                                chunkData.data,
                                chunkData.iv,
                                dataKey,
                            );
                            decryptedChunks.push(decryptedChunk);

                            // Mettre à jour la progression après chaque chunk
                            processedChunks++;
                            const progress = (processedChunks / totalChunks) * 100;
                            downloadProgressMap.value[downloadId] = progress;
                            updateTransferStats(
                                downloadId,
                                progress,
                                totalChunks * 1024 * 1024,
                            );
                        }

                        // Ajouter le fichier au ZIP
                        const fileBlob = new Blob(decryptedChunks, { type: item.mime_type });
                        zip.file(`${item.path}${metadata.filename}`, fileBlob);

                        console.log(
                            `Added file: ${metadata.filename} (${processedChunks}/${totalChunks} chunks)`,
                        );
                    } catch (fileError) {
                        console.error("Error processing file:", fileError);
                    }
                }
            }

            // Générer le ZIP et le télécharger directement
            console.log("Generating ZIP file...");
            const zipBlob = await zip.generateAsync({ type: "blob" });

            // Télécharger directement sans demander où sauvegarder
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${folderName}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);

            console.log("ZIP download completed");

            // Nettoyer l'AbortController
            delete downloadAbortControllers.value[downloadId];

            // Retirer de la liste des téléchargements
            listDownloadInProgress.value = listDownloadInProgress.value.filter(
                (d) => d._downloadId !== downloadId,
            );
            delete downloadProgressMap.value[downloadId];
            delete transferSpeeds.value[downloadId];
            delete transferETAs.value[downloadId];
        } catch (error) {
            console.error("Error downloading folder as ZIP:", error);

            // Ne pas afficher d'alerte si l'erreur est due à un abort
            if (error.name !== "AbortError") {
                alert(`Erreur lors du téléchargement: ${error.message}`);
            }

            // Nettoyer l'AbortController
            delete downloadAbortControllers.value[downloadId];

            // Retirer de la liste des téléchargements en cas d'erreur
            listDownloadInProgress.value = listDownloadInProgress.value.filter(
                (d) => d._downloadId !== downloadId,
            );
            delete downloadProgressMap.value[downloadId];
            delete transferSpeeds.value[downloadId];
            delete transferETAs.value[downloadId];
        }
    };
    const downloadItem = async (element) => {
        if (!element?.dataset) return;

        const itemType = element.dataset.itemType;
        const itemId = element.dataset.itemId;

        if (itemType === "file") {
            // Télécharger un fichier unique
            const item = liste_decrypted_items.value.find((i) => i.file_id === itemId);
            if (item) {
                downloadFile(item);
            }
        } else if (itemType === "folder") {
            // Télécharger un dossier avec tout son contenu en ZIP
            downloadFolderAsZip(itemId, element.dataset.folderName);
        }
    };

    const initializeFileInDB = async (file, folder_id) => {
        const dataKey = await generateDataKey();
        const encryptedFileKey = await encryptWithStoredPublicKey(dataKey);
        const metadata = {
            filename: file.name,
            size: file.size,
            mime_type: file.type,
            last_modified: file.lastModified,
        };

        const stringifiedMetadata = JSON.stringify(metadata);
        //   console.log("Stringified Metadata:", stringifiedMetadata);

        const encryptedMetadata = await encryptSimpleDataWithDataKey(
            stringifiedMetadata,
            dataKey,
        );

        const res = await fetch(`${API_URL}/drive/initialize_file`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                encrypted_metadata: encryptedMetadata,
                encrypted_file_key: encryptedFileKey,
                size: file.size,
                mime_type: file.type,
                folder_id: folder_id,
            }),
        });
        if (!res.ok) {
            throw new Error("Failed to initialize file in DB");
        }
        const resData = await res.json();
        const fileId = resData.file_id;

        // Propagation automatique des permissions si le fichier est créé dans un dossier partagé
        // On ne bloque pas l'upload si la propagation échoue
        if (folder_id && folder_id !== "root") {
            const { propagateFileAccess } = useAutoShare(API_URL);
            propagateFileAccess(fileId, folder_id, dataKey).catch(err => {
                console.error('Failed to propagate file access:', err);
            });
        }

        return [fileId, dataKey];
    };


    const uploadFile = async (file, file_id, dataKey) => {
        const chunkSize = 1 * 1024 * 1024; // 1 MB (réduit pour éviter stack overflow)
        const totalChunks = Math.ceil(file.size / chunkSize);

        // Créer un AbortController pour ce fichier
        const abortController = new AbortController();
        abortControllers.value[file_id] = abortController;

        // Limite le nombre d'envois simultanés pour ne pas tuer le navigateur
        // 3 à 5 est généralement un bon chiffre.
        const CONCURRENCY_LIMIT = 3;

        // Cette fonction gère l'upload d'un index précis avec retry automatique
        const uploadChunkByIndex = async (index) => {
            // Vérifier si l'upload est en pause
            while (isPaused(file_id)) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const start = index * chunkSize;
            const end = Math.min(start + chunkSize, file.size);

            const chunk = file.slice(start, end);

            const { cipherText, iv } = await encryptDataWithDataKey(chunk, dataKey);
            const body = {
                file_id: file_id,
                index: index,
                chunk_data: cipherText,
                iv: iv,
            };

            // Upload avec retry automatique
            await withRetry(async () => {
                const res = await fetch(`${API_URL}/drive/upload_chunk`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                    signal: abortController.signal,
                });

                if (!res.ok) {
                    const error = new Error(`Failed to upload chunk ${index}`);
                    error.status = res.status;
                    throw error;
                }

                // Succès - effacer l'état d'erreur
                if (transferErrors.value[file_id]) {
                    delete transferErrors.value[file_id];
                }

                return res;
            }, { transferId: file_id, chunkIndex: index });

            // Met à jour la progression
            const progress = Math.min((end / file.size) * 100, 100).toFixed(2);
            fileProgressMap.value = {
                ...fileProgressMap.value,
                [file_id]: parseFloat(progress),
            };

            // Mise à jour des stats de transfert
            updateTransferStats(file_id, parseFloat(progress), file.size);

            // Petit délai pour éviter le rate limiting
            await new Promise((resolve) => setTimeout(resolve, 50));
        };

        // Gestionnaire de file d'attente (Pool)
        const queue = [];
        for (let i = 0; i < totalChunks; i++) {
            queue.push(i);
        }

        const worker = async () => {
            while (queue.length > 0) {
                // On récupère le prochain index à traiter
                const index = queue.shift();
                try {
                    await uploadChunkByIndex(index);
                } catch (err) {
                    // Si l'erreur est une annulation, on arrête le worker
                    if (err.name === "AbortError") {
                        console.log(`Upload annulé pour le fichier ${file.name}`);
                        return; // Sortir du worker
                    }
                    console.error(`Echec chunk ${index}`, err);
                }
            }
        };

        try {
            const workers = [];
            for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, totalChunks); i++) {
                workers.push(worker());
            }

            // On attend que tous les workers aient fini
            await Promise.all(workers);

            let etat = abortController.signal.aborted ? "aborted" : "completed";

            console.log(`Finished uploading file: ${file.name}`);

            const req = await fetch(
                `${API_URL}/drive/finalize_upload/${file_id}/${etat}`,
                {
                    method: "POST",
                    credentials: "include",
                },
            );
            if (!req.ok) {
                throw new Error("Failed to finalize file upload");
            }
        } catch (error) {
            const req = await fetch(
                `${API_URL}/drive/finalize_upload/${file_id}/aborted`,
                {
                    method: "POST",
                    credentials: "include",
                },
            );
            if (!req.ok) {
                console.error("Failed to notify server about aborted upload");
            }
            // upload finalization removed (no finalize endpoint)
            throw error;
        } finally {
            // Nettoyer l'AbortController
            delete abortControllers.value[file_id];
        }
    };


    const startUploads = async () => {
        while (
            listUploadInProgress.value.length < simultaneousUploads &&
            listToUpload.value.length > 0
        ) {
            const fileObject = listToUpload.value.shift();
            const file = fileObject;
            const targetFolderId = fileObject._targetFolderId || activeFolderId.value;

            // Fiabiliser: ne jamais perdre le dossier cible
            file._targetFolderId = targetFolderId;
            if (!file._uniqueId) {
                file._uniqueId = `file-${Date.now()}-${fileIdCounter++}`;
            }

            listUploadInProgress.value.push(file);

            const [file_id, dataKey] = await initializeFileInDB(file, targetFolderId);

            // Initialiser la progression
            fileProgressMap.value[file_id] = 0;
            file._uploadId = file_id;
            file._serverFileId = file_id;
            file.status = "uploading";

            uploadFile(file, file_id, dataKey)
                .then(async () => {
                    listUploadInProgress.value = listUploadInProgress.value.filter(
                        (f) => f !== file,
                    );
                    listUploaded.value.push(file);

                    // Nettoyer la progression du fichier terminé
                    delete fileProgressMap.value[file_id];

                    // Si c'est le dernier fichier, recharger la liste
                    if (
                        listUploadInProgress.value.length === 0 &&
                        listToUpload.value.length === 0
                    ) {
                        await loadPath();
                        // Vider listUploaded après le rechargement pour éviter les doublons
                        listUploaded.value = [];
                    }
                    // console.log(listUploadInProgress.value);
                    startUploads();
                })
                .catch((err) => {
                    // Gérer les erreurs d'upload (y compris l'annulation)
                    if (err.name === "AbortError") {
                        console.log(`Upload annulé pour ${file.name}`);
                    } else {
                        console.error(`Erreur upload ${file.name}:`, err);
                    }
                    // Nettoyer même en cas d'erreur
                    listUploadInProgress.value = listUploadInProgress.value.filter(
                        (f) => f !== file,
                    );
                    delete fileProgressMap.value[file_id];
                    startUploads();
                });
        }
    };


    const pauseAllTransfers = () => {
        allTransfersPaused.value = true;
        listUploadInProgress.value.forEach((file) =>
            pausedTransfers.value.add(file._uploadId),
        );
        listDownloadInProgress.value.forEach((file) =>
            pausedTransfers.value.add(file._downloadId),
        );
    };


     watch(
        [listToUpload, listUploadInProgress],
        () => {
            startUploads();
        },
        { deep: true }
    );

    return {
        // Upload-related state
        listToUpload,
        listUploadInProgress,
        listUploaded,
        fileProgressMap,
        abortControllers,

        // Download-related state
        downloadAbortControllers,
        downloadFile,
        downloadFolderAsZip,
        listDownloadInProgress,
        downloadProgressMap,

        // UI / stats
        isPanelCollapsed,
        allTransfersPaused,
        transferSpeeds,
        transferETAs,
        transferErrors,
        formatSpeed,
        formatETA,
        getTransferStatus,
        isPaused,
        togglePauseTransfer,
        resumeAllTransfers,
        cancelAllTransfers,
        cancelDownload,
        togglePanelCollapse,

        // Actions
        abort_upload,
        updateTransferStats,
        downloadItem,
        initializeFileInDB,
        uploadFile,
        startUploads,
        pauseAllTransfers,
        downloadFile,
    };
}