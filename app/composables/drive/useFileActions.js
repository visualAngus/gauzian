import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useFetchWithAuth } from '~/composables/useFetchWithAuth';
import {
    decryptWithStoredPrivateKey,
    encryptWithPublicKey,
    generateDataKey,
    encryptWithStoredPublicKey,
    encryptSimpleDataWithDataKey
} from '~/utils/crypto';

import { useAutoShare } from './useAutoShare';

export function useFileActions({
    API_URL,
    activeFolderId,
    listToUpload,
    listUploadInProgress,
    listUploaded,
    fileProgressMap,
    abortControllers,
    refreshTreeNode,
    loadPath,
    usedSpace,
    totalSpaceLeft,
    downloadFile,
    selectedItems,
    selectedItemsMap,
    clearSelection,
    foldersList,
    liste_decrypted_items,
    addNotification
} = {}) {

    const router = useRouter();
    const { fetchWithAuth } = useFetchWithAuth();

    // Local counter for generating unique file IDs when queuing uploads
    let fileIdCounter = 0;

    const isDragging = ref(false);
    const activeItem = ref(null);
    const draggedItems = ref([]); // Tous les items en cours de déplacement
    if (!foldersList) foldersList = ref([]);
    const mousePos = ref({ x: 0, y: 0 });

    const fileInput = ref(null);
    const rightClickPanel = ref(null);
    const rightClikedItem = ref(null);

    const isSharing = ref(false);
    const shareItemTarget = ref(null);

    const isOver = ref(false);
    // Style dynamique pour l'élément "fantôme" qui suit la souris
    const ghostStyle = computed(() => ({
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate(${mousePos.value.x - 50}px, ${mousePos.value.y - 24
            }px)`,
        pointerEvents: "none", // Important pour ne pas bloquer les événements souris
        zIndex: 9999,
    }));

    const click_on_item = (item, event) => {
        // console.log("Item event:", item, event);

        // Si on est en corbeille, restaurer l'item au lieu de l'ouvrir/télécharger
        if (activeFolderId.value === "corbeille") {
            // restoreItem(item);
            return;
        }
        if (activeFolderId.value === "shared_with_me") {
            // acceptSharedItem(item);
            return;
        }

        if (item.type === "folder") {
            // naviguer dans le dossier
            router.push(`/drive?folder_id=${item.folder_id}`);
            activeFolderId.value = item.folder_id;
        } else if (item.type === "file") {
            // télécharger le fichier via le handler fourni par useTransfers
            if (typeof downloadFile === "function") {
                downloadFile(item);
            } else {
                console.warn("downloadFile not provided to useFileActions");
            }
        }
    };

    const acceptSharedItem = async (item) => {
        // Gérer les deux formats : objet JS direct ou élément HTML avec data-attributes
        const itemType = item.type ?? item.dataset?.itemType;
        const itemId = item.file_id ?? item.folder_id ?? item.dataset?.itemId;

        if (!itemId || !itemType) {
            console.error("Invalid item for accepting shared item");
            addNotification({
                title: "Erreur",
                message: "Impossible d'accepter l'élément partagé.",
                duration: 5000,
            });
            return;
        }

        try {
            const endpoint = itemType === "file"
                ? `/drive/files/${itemId}/accept`
                : `/drive/folders/${itemId}/accept`;

            const res = await fetchWithAuth(endpoint, { method: "POST" });
            if (!res.ok) {
                throw new Error(`Failed to accept shared ${itemType} ${itemId}`);
            }

            addNotification({
                title: "Partage accepté",
                message: `L'élément a été ajouté à votre drive.`,
                duration: 5000,
            });
            await loadPath();
        } catch (error) {
            console.error("Error accepting shared item:", error);
            addNotification({
                title: "Erreur",
                message: "Impossible d'accepter l'élément partagé.",
                duration: 5000,
            });
        }
    };

    const rejectSharedItem = async (item) => {
        const itemType = item.type ?? item.dataset?.itemType;
        const itemId = item.file_id ?? item.folder_id ?? item.dataset?.itemId;
        if (!itemId || !itemType) {
            console.error("Invalid item for rejecting shared item");
            addNotification({   
                title: "Erreur",
                message: "Impossible de rejeter l'élément partagé.",
                duration: 5000,
            });
            return;
        }
        try {
            const endpoint = itemType === "file"
                ? `/drive/files/${itemId}/reject`
                : `/drive/folders/${itemId}/reject`;
            const res = await fetchWithAuth(endpoint, { method: "POST" });
            if (!res.ok) {
                throw new Error(`Failed to reject shared ${itemType} ${itemId}`);
            }
            addNotification({
                title: "Partage rejeté",
                message: `L'élément a été rejeté et ne sera pas ajouté à votre drive.`,
                duration: 5000,
            });
            await loadPath();
        } catch (error) {
            console.error("Error rejecting shared item:", error);
            addNotification({
                title: "Erreur",
                message: "Impossible de rejeter l'élément partagé.",
                duration: 5000,
            });
        }
    };

    const restoreItem = async (item) => {
        // si item.type existe

        if (!item.type || (item.type !== "file" && item.type !== "folder")) {
            // c'est l'objet html avec les data-attributes

            const itemType = item.dataset.itemType;
            const itemId = item.dataset.itemId;

            try {
                if (itemType === "file") {
                    const res = await fetchWithAuth('/drive/restore_file', {
                        method: "POST",
                        body: JSON.stringify({ file_id: itemId }),
                    });
                    if (!res.ok) {
                        throw new Error(`Failed to restore file ${itemId}`);
                    }
                } else if (itemType === "folder") {
                    const res = await fetchWithAuth('/drive/restore_folder', {
                        method: "POST",
                        body: JSON.stringify({ folder_id: itemId }),
                    });
                    if (!res.ok) {
                        throw new Error(`Failed to restore folder ${itemId}`);
                    }
                }
                addNotification({
                    title: "Restauration réussie",
                    message: `L'élément a été restauré avec succès.`,
                    duration: 5000,
                });



                await loadPath();
                await refreshTreeNode(activeFolderId.value);
            } catch (error) {
                console.error("Error restoring item:", error);
                alert("Erreur lors de la restauration de l'élément");
                return;
            }
        } else {
            // Se sont les donnés direct du serveur
            try {
                if (item.type === "file") {
                    const res = await fetchWithAuth('/drive/restore_file', {
                        method: "POST",
                        body: JSON.stringify({ file_id: item.file_id }),
                    });
                    if (!res.ok) {
                        throw new Error(`Failed to restore file ${item.file_id}`);
                    }
                } else if (item.type === "folder") {
                    const res = await fetchWithAuth('/drive/restore_folder', {
                        method: "POST",
                        body: JSON.stringify({ folder_id: item.folder_id }),
                    });
                    if (!res.ok) {
                        throw new Error(`Failed to restore folder ${item.folder_id}`);
                    }
                }
                addNotification({
                    title: "Restauration réussie",
                    message: `L'élément a été restauré avec succès.`,
                    duration: 5000,
                });
                // Rafraîchir l'affichage
                await loadPath();
                await refreshTreeNode(activeFolderId.value);
            } catch (error) {
                console.error("Error restoring item:", error);
                alert("Erreur lors de la restauration de l'élément");
            }
        }
    };


    const createFolder = async () => {
        const folderName = "name_folder"; // Tu peux remplacer par une saisie utilisateur

        const metat_data = {
            folder_name: folderName,
        };
        // génération de la clé de données pour le dossier
        const dataKey = await generateDataKey();
        const encryptedFolderKey = await encryptWithStoredPublicKey(dataKey);
        const stringifiedMetadata = JSON.stringify(metat_data);
        const encryptedMetadata = await encryptSimpleDataWithDataKey(
            stringifiedMetadata,
            dataKey,
        );
        const res = await fetchWithAuth('/drive/create_folder', {
            method: "POST",
            body: JSON.stringify({
                encrypted_metadata: encryptedMetadata,
                encrypted_folder_key: encryptedFolderKey,
                parent_folder_id: activeFolderId.value,
            }),
        });
        if (!res.ok) {
            throw new Error("Failed to create folder");
        }
        const resData = await res.json();
        console.log("Folder created with ID:", resData.folder_id);
        
        // Propagation automatique des permissions si le dossier parent est partagé
        if (activeFolderId.value && activeFolderId.value !== "root") {
            const { propagateFolderAccess } = useAutoShare(API_URL);
            await propagateFolderAccess(
                resData.folder_id,
                activeFolderId.value,
                dataKey
            );
        }

        // Rafraîchir la liste des fichiers/dossiers
        await loadPath();
        await refreshTreeNode(activeFolderId.value);
        
        // il faut reussir a seclection le nouveau dossier créé pour le renommer directement
        await nextTick();
        const id = resData.folder_id;
        const newFolderElement = document.querySelector(
            `.item[data-item-id="${id}"]`,
        );
        if (newFolderElement) {
            renameItem(newFolderElement);
        }
        addNotification({
            title: "Dossier créé",
            message: `Un nouveau dossier a été créé avec succès.`,
            duration: 5000,
        });
    };


    const setIsOver = (state) => {
        isOver.value = state;
    };

    const handleTreeContextMenu = ({ node, event }) => {
        event.preventDefault();
        const panel = rightClickPanel.value?.$el || rightClickPanel.value;
        if (!panel) return;

        // Créer un élément virtuel pour le dossier du tree
        const virtualItem = document.createElement("div");
        virtualItem.setAttribute("data-item-type", "folder");
        virtualItem.setAttribute("data-item-id", node.folder_id);
        virtualItem.setAttribute(
            "data-folder-name",
            node.metadata?.folder_name || "Dossier",
        );

        rightClikedItem.value = virtualItem;

        panel.style.display = "flex";
        panel.style.top = event.pageY + "px";
        panel.style.left = event.pageX + "px";
    };


    const openItemMenu = (item, event) => {
        const panel = rightClickPanel.value?.$el || rightClickPanel.value;
        if (!panel) return;
        // Trouver l'élément DOM réel correspondant à l'item
        const itemId = item.file_id || item.folder_id;
        const realElement = document.querySelector(`.item[data-item-id="${itemId}"]`);
        
        if (!realElement) {
            return;
        }

        const pageSize = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        rightClikedItem.value = realElement;
        
        // Positionner le menu à l'endroit du clic
        panel.style.display = "flex";

        if ((event.pageX - pageSize.width > - panel.offsetWidth && event.pageX - pageSize.width < 0)) {
            if (event && event.pageY && event.pageX) {
                panel.style.top = event.pageY + "px";
                panel.style.left = event.pageX - panel.offsetWidth + "px";
            } else {
                const rect = realElement.getBoundingClientRect();
                panel.style.top = (rect.bottom + window.scrollY) + "px";
                panel.style.left = (rect.left + window.scrollX) + "px";
            }
        } else if ((event.pageY - pageSize.height > - panel.offsetHeight && event.pageY - pageSize.height < 0)){
            if (event && event.pageY && event.pageX) {
                panel.style.top = event.pageY - panel.offsetHeight + "px";
                panel.style.left = event.pageX + "px";
            }
        }
        else {
            if (event && event.pageY && event.pageX) {
                panel.style.top = event.pageY + "px";
                panel.style.left = event.pageX + "px";
            } else {
                const rect = realElement.getBoundingClientRect();
                panel.style.top = (rect.bottom + window.scrollY) + "px";
                panel.style.left = (rect.left + window.scrollX) + "px";
            }
        }
    };

    // Gestionnaire pour le clic droit sur l'espace vide
    const openEmptySpaceMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const panel = rightClickPanel.value?.$el || rightClickPanel.value;
        if (!panel) return;

        rightClikedItem.value = null;

        // Positionner le menu à l'endroit du clic
        panel.style.display = "flex";
        panel.style.top = event.pageY + "px";
        panel.style.left = event.pageX + "px";
    };

    // Fonction pour fermer le menu contextuel
    const closeContextMenu = () => {
        const panel = rightClickPanel.value?.$el || rightClickPanel.value;
        if (panel) {
            panel.style.display = "none";
        }
        rightClikedItem.value = null;
    };


    const handleFileInputChange = async (event) => {
        const files = event.target.files;
        console.log("Files selected via input:", files);
        if (files && files.length > 0) {
            await onFilesFromDrop(files);
        }
        // Réinitialiser l'input pour permettre de sélectionner les mêmes fichiers à nouveau
        event.target.value = "";
    };

    const onFilesFromDrop = async (files) => {
        let someSize = 0;
        const filesToUpload = [];

        // Phase 1: Parser les fichiers et calculer la taille + créer les dossiers
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            someSize += file.size;

            // Vérifier la taille si les refs sont fournies
            if (
                totalSpaceLeft &&
                typeof totalSpaceLeft.value !== "undefined" &&
                usedSpace &&
                typeof usedSpace.value !== "undefined"
            ) {
                if (someSize > totalSpaceLeft.value - usedSpace.value) {
                    addNotification({
                        title: "Espace insuffisant",
                        message: `Espace insuffisant pour uploader le fichier "${file.name}".`,
                        duration: 8000,
                    });
                    return;
                }
            }

            // Extraire le chemin et créer les dossiers
            if (file.webkitRelativePath) {
                const targetFolderId = await getOrCreateFolderHierarchy(
                    file.webkitRelativePath,
                    activeFolderId.value,
                );
                filesToUpload.push({ file, targetFolderId });
            } else {
                // Fichier sans chemin, upload dans le dossier actif
                filesToUpload.push({ file, targetFolderId: activeFolderId.value });
            }
        }

        await loadPath();

        // Phase 2: Ajouter les fichiers à la liste d'upload
        for (const { file, targetFolderId } of filesToUpload) {
            // Conserver l'objet File natif pour garder size/type/lastModified
            if (!file._uniqueId) {
                file._uniqueId = `file-${Date.now()}-${fileIdCounter++}`;
            }
            file._targetFolderId = targetFolderId;
            file.status = "pending";
            listToUpload.value.push(file);
        }

        // console.log("Dossiers créés:", foldersList.value);
        // console.log("Fichiers prêts pour upload:", filesToUpload);
    };
    const handleDragStart = (data) => {
        isDragging.value = true;
        activeItem.value = data.item;
        mousePos.value = { x: data.x, y: data.y };

        const itemId =
            data.item.type === "file" ? data.item.file_id : data.item.folder_id;

        // Si l'item draggé fait partie de la sélection multiple, on déplace tous les items sélectionnés
        if (selectedItems.value.has(itemId) && selectedItems.value.size > 1) {
            draggedItems.value = Array.from(selectedItemsMap.value.values());
            console.log("Drag started with", draggedItems.value.length, "items");
        } else {
            // Sinon on déplace juste cet item
            draggedItems.value = [data.item];
            console.log("Drag started:", data.item);
        }
    };

    const emptyTrash = async () => {
        if (!confirm("Voulez-vous vraiment vider la corbeille ?")) {
            return;
        }

        const res = await fetchWithAuth('/drive/empty_trash', {
            method: "POST",
        });

        if (!res.ok) {
            console.error("Failed to empty trash");
            alert("Erreur lors du vidage de la corbeille");
            return;
        }
        addNotification({
            title: "Corbeille vidée",
            message: `La corbeille a été vidée avec succès.`,
            duration: 5000,
        });
        console.log("Trash emptied successfully");
        await loadPath();
        await refreshTreeNode("corbeille");
    };

    const handleDragMove = (data) => {
        // Cette fonction est appelée à chaque pixel bougé par la souris
        mousePos.value = { x: data.x, y: data.y };
    };

    const handleDragEnd = async (data) => {
        if (!activeItem.value || draggedItems.value.length === 0) {
            isDragging.value = false;
            return;
        }

        // Trouver l'élément dossier sous la position du curseur
        const elementUnderMouse = document.elementFromPoint(data.x, data.y);

        const breadcrumbElement = elementUnderMouse?.closest(".breadcrumb-item");
        const targetFolderElement = elementUnderMouse?.closest(
            '.item[data-item-type="folder"]',
        );
        const folderTreeNodeElement = elementUnderMouse?.closest(".folder-three");

        let targetFolderId = null;

        if (breadcrumbElement) {
            targetFolderId = breadcrumbElement.dataset?.itemId;
        } else if (targetFolderElement) {
            targetFolderId = targetFolderElement.dataset?.itemId;
        } else if (folderTreeNodeElement) {
            targetFolderId = folderTreeNodeElement.dataset?.folderId;
        }

        if (!targetFolderId) {
            isDragging.value = false;
            activeItem.value = null;
            draggedItems.value = [];
            return;
        }

        try {
            // Vérifier qu'on ne déplace pas un dossier dans lui-même
            for (const item of draggedItems.value) {
                const itemId = item.file_id || item.folder_id;
                if (item.type === "folder" && itemId === targetFolderId) {
                    console.log("Cannot move a folder into itself");
                    isDragging.value = false;
                    activeItem.value = null;
                    draggedItems.value = [];
                    return;
                }
            }

            console.log(
                `Moving ${draggedItems.value.length} item(s) to folder ${targetFolderId}`,
            );

            // Déplacer tous les items
            const movePromises = draggedItems.value.map((item) =>
                moveItem(item, targetFolderId),
            );
            await Promise.all(movePromises);

            console.log("All items moved successfully");
            addNotification({
                title: "Éléments déplacés",
                message: `${draggedItems.value.length} élément(s) ont été déplacés avec succès.`,
                duration: 5000,
            });

            // Recharger le dossier courant
            await loadPath();
            await refreshTreeNode(activeFolderId.value);
            await refreshTreeNode(targetFolderId);
        } catch (error) {
            console.error("Error moving items:", error);
            alert("Erreur lors du déplacement des éléments");
        }

        isDragging.value = false;
        activeItem.value = null;
        draggedItems.value = [];
    };


    const toggleSidebar = () => {
        isSidebarOpen.value = !isSidebarOpen.value;
    };

    const gohome = () => {
        router.push(`/drive?folder_id=root`);
        activeFolderId.value = "root";
    };

    const goToTrash = () => {
        router.push(`/drive?folder_id=corbeille`);
        activeFolderId.value = "corbeille";

        loadPath({ outIn: true });
    };

    const goToSharedWithMe = () => {
        router.push(`/drive?folder_id=shared_with_me`);
        activeFolderId.value = "shared_with_me";

        loadPath({ outIn: true });
    };

    const formatBytes = (bytes) => {
        const sizes = ["octets", "Ko", "Mo", "Go", "To"];
        if (bytes === 0) return "0 octet";
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
    };

    const getOrCreateFolderHierarchy = async (
        relativePath,
        parentFolderId = "root",
    ) => {
        const pathParts = relativePath.split("/").slice(0, -1); // Exclure le nom du fichier

        if (pathParts.length === 0) {
            return parentFolderId; // Le fichier est à la racine
        }

        let currentParentId = parentFolderId;

        for (const folderName of pathParts) {
            // Vérifier si le dossier existe déjà
            const existingFolder = foldersList.value.find(
                (f) => f.name === folderName && f.parent_folder_id === currentParentId,
            );

            if (existingFolder) {
                currentParentId = existingFolder.folder_id;
            } else {
                // Créer le dossier
                try {
                    const dataKey = await generateDataKey();
                    const encryptedFolderKey = await encryptWithStoredPublicKey(dataKey);
                    const metadata = { folder_name: folderName };
                    const stringifiedMetadata = JSON.stringify(metadata);
                    const encryptedMetadata = await encryptSimpleDataWithDataKey(
                        stringifiedMetadata,
                        dataKey,
                    );

                    const res = await fetchWithAuth('/drive/create_folder', {
                        method: "POST",
                        body: JSON.stringify({
                            encrypted_metadata: encryptedMetadata,
                            encrypted_folder_key: encryptedFolderKey,
                            parent_folder_id: currentParentId,
                        }),
                    });

                    if (!res.ok) {
                        throw new Error("Failed to create folder");
                    }

                    const resData = await res.json();
                    const newFolderId = resData.folder_id;

                    // Propagation automatique des permissions si le dossier parent est partagé
                    if (currentParentId && currentParentId !== "root") {
                        const { propagateFolderAccess } = useAutoShare(API_URL);
                        await propagateFolderAccess(
                            newFolderId,
                            currentParentId,
                            dataKey
                        );
                    }

                    // Ajouter à la liste locale
                    foldersList.value.push({
                        name: folderName,
                        folder_id: newFolderId,
                        parent_folder_id: currentParentId,
                    });

                    currentParentId = newFolderId;
                } catch (err) {
                    console.error(`Erreur création dossier ${folderName}:`, err);
                    throw err;
                }
            }
        }

        return currentParentId;
    };

    const deleteItem = async (item) => {
        console.log("Delete item:", item);

        const normalizeItem = (rawItem) => {
            const id =
                rawItem?.dataset?.itemId ?? rawItem?.file_id ?? rawItem?.folder_id ?? null;
            const type =
                rawItem?.dataset?.itemType ??
                rawItem?.type ??
                (rawItem?.file_id ? "file" : rawItem?.folder_id ? "folder" : null);

            return {
                type,
                file_id: type === "file" ? id : null,
                folder_id: type === "folder" ? id : null,
            };
        };

        const normalizedCurrentItem = normalizeItem(item);
        const itemId = normalizedCurrentItem.file_id || normalizedCurrentItem.folder_id;
        const itemType = normalizedCurrentItem.type;

        if (!itemId || !itemType) {
            console.error("Invalid item for deletion:", item);
            addNotification({
                title: "Erreur",
                message: "Impossible de déterminer l'élément à supprimer.",
                duration: 5000,
            });
            return;
        }

        // Vérifier si cet item fait partie d'une sélection multiple
        let itemsToDelete = [];

        if (selectedItems.value.has(itemId) && selectedItems.value.size > 1) {
            // Supprimer tous les items sélectionnés
            itemsToDelete = Array.from(selectedItemsMap.value.values()).map(normalizeItem);
            const confirmMessage = `Voulez-vous vraiment supprimer ${itemsToDelete.length} éléments ?`;
            if (!confirm(confirmMessage)) {
                return;
            }
        } else {
            // Supprimer juste cet item
            console.log("Deleting single item:", { itemId, itemType });
            itemsToDelete = [normalizedCurrentItem];
        }

        console.log("Items to delete:", itemsToDelete);

        try {

            // Supprimer tous les items (RESTful endpoints)
            const deletePromises = itemsToDelete.map(async (itemToDelete) => {
                const id = itemToDelete.file_id || itemToDelete.folder_id;
                const type = itemToDelete.type;

                const endpoint = type === "file"
                    ? `/drive/files/${id}`
                    : `/drive/folders/${id}`;

                const res = await fetchWithAuth(endpoint, {
                    method: "DELETE",
                });

                if (!res.ok) {
                    throw new Error(`Failed to delete ${type} ${id}`);
                }
            });

            await Promise.all(deletePromises);

            console.log(`Successfully deleted ${itemsToDelete.length} item(s)`);
            addNotification({
                title: "Éléments supprimés",
                message: `${itemsToDelete.length} élément(s) ont été supprimés avec succès.`,
                duration: 5000,
            });

            // Vider la sélection après suppression
            clearSelection();

            await loadPath();
            await refreshTreeNode(activeFolderId.value);
        } catch (error) {
            console.error("Error deleting items:", error);
            alert("Erreur lors de la suppression des éléments");
        }
    };


    const renameItem = async (item) => {
        const itemId = item.dataset?.itemId;
        const itemType = item.dataset?.itemType;
        const metadata = JSON.parse(item.dataset?.itemMetadata || "{}");
        // console.log(metadata);

        if (!metadata) {
            console.error("No metadata found for item");
            return;
        }
        const encrypted_data_key = metadata.encrypted_data_key;
        if (!encrypted_data_key) {
            console.error("No encrypted data key found in metadata");
            return;
        }

        // enlever l'encrypted_data_key des metadata pour ne pas le modifier
        delete metadata.encrypted_data_key;

        // selectionné le span de classe filename ou foldername
        const nameElement = item.querySelector(".filename, .foldername");
        if (!nameElement) {
            console.error("Name element not found");
            return;
        }

        const name = itemType === "file" ? metadata.filename : metadata.folder_name;
        console.log("Current name:", name);

        // Préparer le style pour édition sur une seule ligne
        nameElement.style.textOverflow = "clip";
        nameElement.style.whiteSpace = "nowrap";
        nameElement.style.overflow = "auto";
        nameElement.style.display = "block";
        nameElement.style.maxWidth = "100%";

        // Remplacer le texte par le nom actuel
        nameElement.textContent = name;

        // Rendre le nom éditable
        nameElement.contentEditable = "true";

        // sélectionner le texte
        // Sélectionner uniquement le nom sans l'extension
        const dotIndex = name.lastIndexOf(".");
        let start = 0;
        let end = name.length;
        if (dotIndex > 0 && itemType === "file") {
            end = dotIndex;
        }
        const range = document.createRange();
        range.setStart(nameElement.firstChild || nameElement, start);
        range.setEnd(nameElement.firstChild || nameElement, end);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        nameElement.focus();

        // Gérer la fin de l'édition
        const finishEditing = async () => {
            nameElement.contentEditable = "false";
            const newName = nameElement.textContent.trim();

            // Si le nom n'a pas changé, on annule
            if (newName === name) {
                nameElement.style.textOverflow = "ellipsis";
                nameElement.style.whiteSpace = "nowrap";
                nameElement.style.overflow = "hidden";
                nameElement.style.display = "block";
                nameElement.textContent = name;
                return;
            }

            try {
                const decryptkey = await decryptWithStoredPrivateKey(encrypted_data_key);

                const encryptedMetadata = await encryptSimpleDataWithDataKey(
                    JSON.stringify(
                        itemType === "file"
                            ? { ...metadata, filename: newName }
                            : { ...metadata, folder_name: newName },
                    ),
                    decryptkey,
                );

                const endpoint =
                    itemType === "file"
                        ? `/drive/files/${itemId}`
                        : `/drive/folders/${itemId}`;

                const res = await fetchWithAuth(endpoint, {
                    method: "PATCH",
                    body: JSON.stringify({
                        new_encrypted_metadata: encryptedMetadata,
                    }),
                });
                if (!res.ok) {
                    throw new Error("Failed to rename item");
                }

                // Réinitialiser les styles
                nameElement.style.textOverflow = "ellipsis";
                nameElement.style.whiteSpace = "nowrap";
                nameElement.style.overflow = "hidden";
                nameElement.style.display = "block";

                // Mettre à jour le texte avec le nouveau nom
                nameElement.textContent = newName;

                addNotification({
                    title: "Élément renommé",
                    message: `L'élément a été renommé en "${newName}".`,
                    duration: 5000,
                });

                // Recharger le path pour synchroniser
                await loadPath();
                await refreshTreeNode(activeFolderId.value);
            } catch (error) {
                console.error("Error renaming item:", error);
                // Restaurer le nom original en cas d'erreur
                nameElement.style.textOverflow = "ellipsis";
                nameElement.style.whiteSpace = "nowrap";
                nameElement.style.overflow = "hidden";
                nameElement.style.display = "block";
                nameElement.textContent = name;
                addNotification({
                    title: "Erreur",
                    message: "Erreur lors du renommage de l'élément",
                    duration: 5000,
                });
            }
        };
        nameElement.addEventListener("blur", finishEditing, { once: true });
        nameElement.addEventListener("keydown", (e) => {
            // console.log(e.key);
            if (e.key === "Enter") {
                e.preventDefault();
                nameElement.blur(); // Utiliser blur pour déclencher finishEditing
            }
            if (e.key === "Escape") {
                e.preventDefault();
                // Annuler l'édition
                nameElement.contentEditable = "false";
                nameElement.style.textOverflow = "ellipsis";
                nameElement.style.whiteSpace = "nowrap";
                nameElement.style.overflow = "hidden";
                nameElement.style.display = "block";
                nameElement.textContent = name;
            }
        });
    };
    const moveItem = async (item, targetFolderId) => {
        const itemId = item.file_id || item.folder_id;
        const itemType = item.type;

        const endpoint =
            itemType === "file"
                ? `/drive/files/${itemId}/move`
                : `/drive/folders/${itemId}/move`;

        const res = await fetchWithAuth(endpoint, {
            method: "PATCH",
            body: JSON.stringify({
                target_folder_id: targetFolderId,
            }),
        });

        if (!res.ok) {
            throw new Error(`Failed to move ${itemType} ${itemId}`);
        } else {
            addNotification({
                title: "Élément déplacé",
                message: `L'élément a été déplacé avec succès.`,
                duration: 5000,
            });
        }
    };

    const shareItem = (item) => {
        const itemId = item.dataset?.itemId;
        const itemType = item.dataset?.itemType;
        const rawMetadata = item.dataset?.itemMetadata;

        let itemName = item.dataset?.folderName || "Élément";

        if (rawMetadata) {
            try {
                const parsed = JSON.parse(rawMetadata);
                itemName = parsed.folder_name || parsed.filename || itemName;
            } catch (error) {
                console.warn("Unable to parse item metadata for sharing", error);
            }
        }

        shareItemTarget.value = {
            id: itemId,
            type: itemType,
            name: itemName,
        };

        isSharing.value = true;
    }

    /**
     * Récupère récursivement tous les sous-dossiers ET fichiers d'un dossier en une seule requête
     */
    const getFolderContentsRecursive = async (folderId) => {
        const res = await fetchWithAuth(`/drive/folder_contents/${folderId}`, {
            method: "GET",
        });

        if (!res.ok) {
            console.warn(`Failed to fetch contents of folder ${folderId}`);
            return { folders: [], files: [] };
        }

        const data = await res.json();

        const contents = data.contents;
        console.log(contents);

        // Séparer les dossiers et fichiers
        const folders = contents.filter(item => item.type === 'folder');
        const files = contents.filter(item => item.type === 'file');

        console.log(`Files and folders fetched for folder ${folderId}:`, { folders, files });

        return { folders, files };
    };

    const shareItemServer = async (itemId, itemType, contacts, accessLevel) => {
        // 1. Récupérer les clés publiques des contacts
        const contactsList = [];
        for (const contact of contacts) {
            try {
                const res = await fetchWithAuth(`/contacts/get_public_key/${encodeURIComponent(contact.email)}`, {
                    method: "GET",
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                    throw new Error(`Failed to get public key for ${contact.email}: ${errorData.error || res.statusText}`);
                }

                const resData = await res.json();
                contactsList.push({
                    contact_id: resData.user_id, // Fix: l'API retourne user_id, pas id
                    contact_email: contact.email,
                    public_key: resData.public_key,
                });
            } catch (error) {
                console.error(`Error fetching public key for ${contact.email}:`, error);
                throw error;
            }
        }

        // 2. Traitement selon le type (fichier ou dossier)
        if (itemType === "file") {
            // PARTAGE DE FICHIER SIMPLE
            const item = liste_decrypted_items.value.find(i => i.file_id === itemId);
            if (!item || !item.encrypted_file_key) {
                throw new Error("File not found or missing encrypted key");
            }

            // Déchiffrer la clé du fichier
            const fileDataKey = await decryptWithStoredPrivateKey(item.encrypted_file_key);

            // Partager avec chaque contact (RESTful endpoint)
            const sharePromises = contactsList.map(async (contact) => {
                const encryptedFileKey = await encryptWithPublicKey(contact.public_key, fileDataKey);

                const res = await fetchWithAuth(`/drive/files/${itemId}/share`, {
                    method: "POST",
                    body: JSON.stringify({
                        recipient_user_id: contact.contact_id,
                        encrypted_file_key: encryptedFileKey,
                        access_level: accessLevel,
                    }),
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                    throw new Error(`Failed to share file with ${contact.contact_email}: ${errorData.error || res.statusText}`);
                }

                return { success: true, contact: contact.contact_email };
            });

            const results = await Promise.all(sharePromises);
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                throw new Error(`Failed to share with: ${failures.map(f => f.contact).join(", ")}`);
            }

        } else {
            // PARTAGE DE DOSSIER AVEC PROPAGATION
            console.log("Fetching all subfolders and files recursively...");

            // Récupérer le dossier principal depuis la liste décryptée
            const mainFolder = liste_decrypted_items.value.find(i => i.folder_id === itemId);
            if (!mainFolder || !mainFolder.encrypted_folder_key) {
                throw new Error("Folder not found or missing encrypted key");
            }

            // Récupérer TOUS les sous-dossiers ET fichiers en une seule requête récursive
            const { folders: subfolders, files: allFiles } = await getFolderContentsRecursive(itemId);

            // Construire la liste complète des dossiers (main + subfolders)
            const allFolders = [mainFolder, ...subfolders];

            console.log(`Found ${allFolders.length} folders and ${allFiles.length} files to share`);

            // Pour chaque contact, rechiffrer toutes les clés et envoyer en batch
            const sharePromises = contactsList.map(async (contact) => {
                try {
                    // Rechiffrer toutes les clés de dossiers
                    const folderKeys = [];
                    for (const folder of allFolders) {
                        if (!folder.encrypted_folder_key) {
                            console.warn(`Folder ${folder.folder_id} missing encrypted_folder_key, skipping`);
                            continue;
                        }

                        const folderDataKey = await decryptWithStoredPrivateKey(folder.encrypted_folder_key);
                        const encryptedFolderKeyForContact = await encryptWithPublicKey(contact.public_key, folderDataKey);

                        folderKeys.push({
                            folder_id: folder.folder_id,
                            encrypted_folder_key: encryptedFolderKeyForContact,
                        });
                    }

                    // Rechiffrer toutes les clés de fichiers
                    const fileKeys = [];
                    for (const file of allFiles) {
                        if (!file.encrypted_file_key) {
                            console.warn(`File ${file.file_id} missing encrypted_file_key, skipping`);
                            continue;
                        }

                        const fileDataKey = await decryptWithStoredPrivateKey(file.encrypted_file_key);
                        const encryptedFileKeyForContact = await encryptWithPublicKey(contact.public_key, fileDataKey);

                        fileKeys.push({
                            file_id: file.file_id,
                            encrypted_file_key: encryptedFileKeyForContact,
                        });
                    }

                    // Envoyer le batch
                    const res = await fetchWithAuth('/drive/share_folder_batch', {
                        method: "POST",
                        body: JSON.stringify({
                            folder_id: itemId,
                            contact_id: contact.contact_id,
                            access_level: accessLevel,
                            folder_keys: folderKeys,
                            file_keys: fileKeys,
                        }),
                    });

                    if (!res.ok) {
                        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                        throw new Error(`Failed to share folder with ${contact.contact_email}: ${errorData.error || res.statusText}`);
                    }

                    return { success: true, contact: contact.contact_email };

                } catch (error) {
                    console.error(`Error sharing with ${contact.contact_email}:`, error);
                    return { success: false, contact: contact.contact_email, error: error.message };
                }
            });

            const results = await Promise.all(sharePromises);
            const failures = results.filter(r => !r.success);
            if (failures.length > 0) {
                const failedContacts = failures.map(f => f.contact).join(", ");
                throw new Error(`Failed to share with: ${failedContacts}`);
            }
        }

        console.log(`Successfully shared ${itemType} with ${contactsList.length} contact(s)`);
    };


    return {
        click_on_item,
        restoreItem,
        createFolder,
        setIsOver,
        handleTreeContextMenu,
        openItemMenu,
        openEmptySpaceMenu,
        closeContextMenu,
        handleFileInputChange,
        onFilesFromDrop,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        emptyTrash,
        toggleSidebar,
        gohome,
        goToTrash,
        formatBytes,
        deleteItem,
        renameItem,
        shareItem,
        goToSharedWithMe,
        shareItemTarget,
        isSharing,
        isDragging,
        ghostStyle,
        activeItem,
        draggedItems,
        fileInput,
        rightClickPanel,
        rightClikedItem,
        shareItemServer,
        acceptSharedItem,
        rejectSharedItem,
    };
}