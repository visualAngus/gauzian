import React, { useState, useEffect, useRef } from 'react';
import _sodium from 'libsodium-wrappers';
import Header from '../components/header.js';

// Importez vos images si elles sont dans src, sinon utilisez le chemin public
// import userProfileImg from '../images/user_profile.png'; 

// --- FONCTIONS UTILITAIRES (Sodium & Helpers) ---

const hexToBuf = (hex) => {
  if (!hex) return new Uint8Array();
  return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
};

const bufToB64 = (buf) => {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export default function Drive() {
  // --- ÉTATS (STATE) ---
  const [activeSection, setActiveSection] = useState(null);
  const [path, setPath] = useState([]); // Le fil d'ariane
  const [folders, setFolders] = useState([]); // Pour stocker la liste des dossiers/fichiers
  const [files, setFiles] = useState([]); // Pour stocker la liste des fichiers
  const [imageLoadedState, setImageLoadedState] = useState(false);
  const [contents, setContents] = useState([]); // Contenu du dossier actif

  // username
  const [userName, setUserName] = useState("User");

  // varible qui contient l'id du dossier dans lequel on est
  const [activeFolderId, setActiveFolderId] = useState(null); // ID du dossier actif
  const activeFolderIdRef = useRef(null); // Garde la dernière valeur pour les callbacks async
  const token = typeof window !== 'undefined' ? localStorage.getItem('storageKey') : null;
  // root id
  const [rootFolderId, setRootFolderId] = useState(null);

  // upload pourcentage
  const [uploadProgress, setUploadProgress] = useState(0);
  const [curentFileUploadName, setCurentFileUploadName] = useState("");

  // États pour l'upload (venant de votre code React)
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null); // Pour déclencher l'input file caché
  const stopallUploadsRef = useRef(false); // Ref pour arrêter tous les uploads
  const abortControllerRef = useRef(null); // AbortController pour annuler les requêtes fetch


  // Gestion upload de plusieurs fichiers
  const [uploadingsFilesCount, setUploadingsFilesCount] = useState(0); // Nombre de fichiers en cours d'upload
  const [curentUploadingFilesNames, setCurentUploadingFilesNames] = useState([]); // Noms des fichiers en cours d'upload
  const [UploadProcesses, setUploadProcesses] = useState({}); // Dictionnaire des processus d'upload par fichier
  const uploadingCountRef = useRef(0); // Ref pour compter de manière synchrone
  const totalFilesToUploadRef = useRef(0); // Ref pour le total des fichiers à uploader
  const nbFilesUploadedRef = useRef(0); // Ref pour le nombre de fichiers déjà uploadés

  // Stockage utilisé
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(1);

  // type de vue (list/grid)
  const [viewType, setViewType] = useState('list'); // 'grid' ou 'list'

  useEffect(() => {
    activeFolderIdRef.current = activeFolderId;
  }, [activeFolderId]);

  // --- LOGIQUE METIER (Encryption / Upload / Download) ---

  const handleFileChange = async (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      // Traiter chaque fichier séquentiellement
      for (const file of selectedFiles) {
        if (stopallUploadsRef.current) {
          console.log("Upload arrêté par l'utilisateur avant traitement du fichier:", file.name);
          break; // Arrêter le traitement des fichiers suivants
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        encodeAndSend(file);
      }
    }
    // Réinitialiser l'input pour permettre de sélectionner les mêmes fichiers à nouveau
    e.target.value = '';
  };

  const handelFolderChange = (e) => {
    // a implémenter plus tard
  };
  const handleDownload = async (id_file) => {
    try {
      const response = await fetch(`/api/drive/download?id_file=${id_file}`, {
        method: 'GET',
      });
      if (!response.ok) throw new Error('Erreur lors du téléchargement du fichier.');
      const data = await response.json();
      await _sodium.ready;
      const sodium = _sodium;
      console.log('Sodium ready.');

      const storageKey = localStorage.getItem('storageKey');
      if (!storageKey) {
        window.location.href = '/login';
        throw new Error('Clé de stockage non trouvée. Veuillez vous connecter.');
      }

      const rawStorageKey = sodium.from_hex(storageKey);
      const encryptionKey = sodium.crypto_generichash(32, rawStorageKey);

      // --- 1. Déchiffrement de la clé du fichier ---
      const encryptedFileKeyB64 = data.encrypted_file_key;
      const encryptedFileKeyBuf = sodium.from_base64(encryptedFileKeyB64, sodium.base64_variants.ORIGINAL);
      const nonceKey = encryptedFileKeyBuf.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextKey = encryptedFileKeyBuf.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const fileKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextKey,
        null,
        nonceKey,
        encryptionKey
      );

      // --- 2. Déchiffrement des métadonnées ---
      const encryptedMetadataB64 = data.encrypted_metadata;
      const encryptedMetadataBuf = sodium.from_base64(encryptedMetadataB64, sodium.base64_variants.ORIGINAL);
      const nonceMeta = encryptedMetadataBuf.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextMeta = encryptedMetadataBuf.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const metadataBuf = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextMeta,
        null,
        nonceMeta,
        fileKey
      );
      const metadataStr = sodium.to_string(metadataBuf);
      const metadata = JSON.parse(metadataStr);
      console.log('Metadata déchiffrées :', metadata);

      // --- 3. Déchiffrement du fichier ---
      const encryptedBlobB64 = data.encrypted_blob;
      const encryptedBlobBuf = sodium.from_base64(encryptedBlobB64, sodium.base64_variants.ORIGINAL);
      const nonceFile = encryptedBlobBuf.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextFile = encryptedBlobBuf.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const fileBuf = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextFile,
        null,
        nonceFile,
        fileKey
      );

      // Création d'un Blob pour le téléchargement
      const blob = new Blob([fileBuf], { type: metadata.filetype });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      console.log('Fichier téléchargé et déchiffré avec succès.');


    } catch (error) {
      console.error('Error during file download:', error);
    }
  };

  const handleDownloadChunked = async (id_file) => {
    try {
      console.log("=== DÉBUT DOWNLOAD STREAMING ===");

      // const streamSaver = (await import('streamsaver')).default;

      await _sodium.ready;
      const sodium = _sodium;

      // 1. Métadonnées
      const metaResponse = await fetch(`/api/drive/download?id_file=${id_file}`);
      if (!metaResponse.ok) throw new Error("Erreur métadonnées");
      const data = await metaResponse.json();

      // 2. Clés
      const storageKey = localStorage.getItem('storageKey');
      const rawStorageKey = sodium.from_hex(storageKey);
      const encryptionKey = sodium.crypto_generichash(32, rawStorageKey);

      // Clé Fichier
      const encFileKey = sodium.from_base64(data.encrypted_file_key, sodium.base64_variants.ORIGINAL);
      const fileKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        encFileKey.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES),
        null,
        encFileKey.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES),
        encryptionKey
      );

      // Métadonnées déchiffrées
      const encMeta = sodium.from_base64(data.encrypted_metadata, sodium.base64_variants.ORIGINAL);
      const metadataBuf = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        encMeta.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES),
        null,
        encMeta.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES),
        fileKey
      );
      const metadata = JSON.parse(sodium.to_string(metadataBuf));
      console.log('✅ Metadata OK:', metadata);

      // 3. StreamSaver
      const fileStream = streamSaver.createWriteStream(metadata.filename, { size: metadata.filesize });
      const writer = fileStream.getWriter();

      // 4. Flux Réseau
      const response = await fetch(`/api/drive/download_raw?id_file=${id_file}`);
      const reader = response.body.getReader();

      // 5. Configuration (A VÉRIFIER AVEC TON UPLOAD)
      const UPLOAD_CHUNK_SIZE = 1024 * 1024; // <--- C'EST ICI QUE TOUT SE JOUE
      const HEADER_SIZE = 24;
      const TAG_SIZE = 16;
      const FULL_BLOCK_SIZE = HEADER_SIZE + UPLOAD_CHUNK_SIZE + TAG_SIZE;

      console.log(`🔧 Config: ChunkData=${UPLOAD_CHUNK_SIZE}, BlockEncrypted=${FULL_BLOCK_SIZE}`);

      let buffer = new Uint8Array(0);
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`📥 Fin du flux réseau. Reste dans buffer: ${buffer.length}`);
          if (buffer.length > 0) {
            await processBuffer(buffer, true); // Traitement final
          }
          break;
        }

        // Ajouter au buffer
        const temp = new Uint8Array(buffer.length + value.length);
        temp.set(buffer);
        temp.set(value, buffer.length);
        buffer = temp;

        // Boucle de traitement des blocs complets
        while (buffer.length >= FULL_BLOCK_SIZE) {
          const chunk = buffer.slice(0, FULL_BLOCK_SIZE);
          buffer = buffer.slice(FULL_BLOCK_SIZE);
          await processBuffer(chunk, false);
        }
      }

      async function processBuffer(bytes, isLast) {
        chunkCount++;
        try {
          // Logs pour comprendre l'erreur
          console.log(`🔑 Traitement Chunk #${chunkCount}. Taille: ${bytes.length} bytes. (IsLast: ${isLast})`);

          // Si c'est trop petit pour contenir un header + tag, c'est mort
          if (bytes.length < HEADER_SIZE + TAG_SIZE) {
            throw new Error(`Chunk trop petit (${bytes.length}) - Corruption possible`);
          }

          const nonce = bytes.slice(0, HEADER_SIZE);
          const cipher = bytes.slice(HEADER_SIZE);

          const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            null, cipher, null, nonce, fileKey
          );

          await writer.write(decrypted);
          // console.log(`✅ Chunk #${chunkCount} écrit.`); // Decommenter si besoin

        } catch (err) {
          console.error(`❌ ERREUR CRITIQUE au Chunk #${chunkCount}`);
          console.error(`Attendu: Header(24) + Tag(16) + Data. Reçu total: ${bytes.length}`);
          console.error(err);
          writer.abort(err);
          throw err;
        }
      }

      await writer.close();
      console.log("🎉 Téléchargement terminé avec succès.");

    } catch (error) {
      console.error("Erreur Globale:", error);
      // alert("Erreur: " + error.message);
    }
  };

  const newFolderFunction = async (folderName = "Nouveau dossier") => {
    // 1. Initialisation
    const sodiumLib = await import('libsodium-wrappers-sumo');
    const sodium = sodiumLib.default || sodiumLib;
    await sodium.ready;

    // Définition des helpers (si pas déjà définis ailleurs)
    const b64 = (u8) => sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);

    // 2. Récupération de la clé maîtresse depuis le localStorage
    const storageKeyHex = localStorage.getItem('storageKey');
    if (!storageKeyHex) {
      window.location.href = '/login';
      throw new Error('Clé de stockage manquante. Redirection vers la page de connexion.');
    }

    // On suppose ici que tu as stocké la clé en Hexadécimal lors du login.
    // Si tu l'as stockée en base64, utilise sodium.from_base64()
    const rawStorageKey = sodium.from_hex(storageKeyHex);

    // 3. A. Dérivation de la clé de chiffrement (Même logique que le Root)
    // C'est la clé qui sert à déverrouiller les clés des dossiers
    const userMasterKey = sodium.crypto_generichash(32, rawStorageKey);

    // 4. B. Création de la clé UNIQUE pour ce nouveau dossier
    const folderKey = sodium.randombytes_buf(32); // Renommé pour plus de clarté (ce n'est pas le root)

    // 5. C. Chiffrement de la clé du dossier avec la userMasterKey
    const nonceFolderKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedFolderKeyBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      folderKey,
      null,
      null,
      nonceFolderKey,
      userMasterKey // On utilise la clé dérivée du storageKey
    );
    // Concaténation Nonce + Cipher
    const finalEncryptedFolderKey = new Uint8Array([...nonceFolderKey, ...encryptedFolderKeyBlob]);

    // 6. D. Chiffrement des métadonnées avec la clé DU DOSSIER
    const folderMetadata = JSON.stringify({
      name: folderName,
      created_at: new Date().toISOString(),
    });

    const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedMetadataBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      sodium.from_string(folderMetadata),
      null,
      null,
      nonceMeta,
      folderKey // <--- Important : on utilise la clé spécifique de ce dossier
    );
    const finalEncryptedMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadataBlob]);

    // 7. Envoi API
    // Assure-toi que activeFolderId est bien défini (passé en argument ou via un hook/store)
    if (!activeFolderId) throw new Error("Aucun dossier parent sélectionné");
    const res = await fetch('/api/drive/new_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_folder_key: b64(finalEncryptedFolderKey),
        encrypted_metadata: b64(finalEncryptedMetadata),
        parent_folder_id: activeFolderId
      }),
    });
    

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erreur création dossier');

    console.log('Dossier créé avec succès:', data);
    // Rafraîchir la vue du dossier courant
    getFolderStructure(activeFolderId);
    console.log(data.folder_id);
    setTimeout(() => {
      rename_folder(data.folder_id, folderName);
    }, 100);
  };
  // --- NOUVELLE VERSION DE encodeAndSend ---
  const encodeAndSend = async (selectedFile) => {
    const uploadFolderId = activeFolderId; // Capture le dossier cible au moment du lancement
    if (stopallUploadsRef.current) {
      console.log("Upload arrêté par l'utilisateur pour le fichier:", selectedFile.name);
      return; // Ne pas traiter ce fichier
    }

    // Initialiser l'AbortController si ce n'est pas déjà fait
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }

    console.log(`Préparation upload pour le fichier: ${selectedFile.name} (${selectedFile.size} bytes)`);
    totalFilesToUploadRef.current += 1;

    while (uploadingCountRef.current >= 3) {
      if (stopallUploadsRef.current) {
        console.log("Upload arrêté par l'utilisateur pendant l'attente pour:", selectedFile.name);
        totalFilesToUploadRef.current = Math.max(0, totalFilesToUploadRef.current - 1); // Corriger le compteur
        return;
      }
      console.log('Attente avant de lancer un nouvel upload...');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    uploadingCountRef.current += 1;
    setUploadingsFilesCount(uploadingCountRef.current);

    try {
      await _sodium.ready;
      const sodium = _sodium;

      // 1. Récupération des clés
      const storageKey = localStorage.getItem('storageKey');
      if (!storageKey) {
        window.location.href = '/login';
        throw new Error('Clé de stockage manquante.');
      }
      const rawStorageKey = sodium.from_hex(storageKey);
      const encryptionKey = sodium.crypto_generichash(32, rawStorageKey);

      // 2. Choix de la méthode selon la taille
      // 0.9 Mo = 0.9 * 1024 * 1024 octets
      const LIMIT_SIZE = 0.9 * 1024 * 1024;

      if (selectedFile.size > LIMIT_SIZE) {
        console.log(`Fichier > 0.9Mo (${selectedFile.size}). Passage en mode Streaming.`);
        const success = await uploadLargeFileStreaming(selectedFile, sodium, encryptionKey);
        if (!success) {
          // Upload annulé, décrémenter les compteurs
          uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
          totalFilesToUploadRef.current = Math.max(0, totalFilesToUploadRef.current - 1);
          setUploadingsFilesCount(uploadingCountRef.current);
          return;
        }
      } else {
        console.log(`Fichier <= 0.9Mo (${selectedFile.size}). Passage en mode Simple.`);
        const success = await uploadSmallFile(selectedFile, sodium, encryptionKey);
        if (!success) {
          // Upload annulé, décrémenter les compteurs
          uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
          totalFilesToUploadRef.current = Math.max(0, totalFilesToUploadRef.current - 1);
          setUploadingsFilesCount(uploadingCountRef.current);
          return;
        }
      }

      // 3. Fin commune
      // setUploading(false);
      uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
      setUploadingsFilesCount(uploadingCountRef.current);
      if (uploadingCountRef.current > 0) {
        setUploading(true);
      } else {
        setUploading(false);
        nbFilesUploadedRef.current = 0;
        totalFilesToUploadRef.current = 0;
        abortControllerRef.current = null; // Réinitialiser l'AbortController
      }
      // Rafraîchir la vue uniquement si l'utilisateur est dans le dossier d'upload
      setTimeout(() => {
        if (uploadFolderId && activeFolderIdRef.current === uploadFolderId) {
          getFolderStructure(uploadFolderId);
          getFileStructure(uploadFolderId);
        }
      }, 500);

    } catch (error) {
      console.error('Erreur globale upload:', error);
      alert(`Erreur: ${error.message}`);
      // setUploading(false);
      uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
      setUploadingsFilesCount(uploadingCountRef.current);
      if (uploadingCountRef.current > 0) {
        setUploading(true);
      } else {
        setUploading(false);
        nbFilesUploadedRef.current = 0;
        totalFilesToUploadRef.current = 0;
        abortControllerRef.current = null; // Réinitialiser l'AbortController
      }
    }
  };

  // --- LOGIQUE FICHIERS < 0.9 Mo (En mémoire) ---
  const uploadSmallFile = async (file, sodium, encryptionKey) => {
    if (stopallUploadsRef.current) {
      console.log("Upload arrêté par l'utilisateur pour le petit fichier:", file.name);
      return false; // Annuler l'upload de ce fichier
    }

    try {
      const fileBytes = new Uint8Array(await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      }));

      // Métadonnées
      const metadata = JSON.stringify({
        filename: file.name,
        filesize: file.size,
        filetype: file.type,
      });

      // Génération clé fichier
      const fileKey = sodium.randombytes_buf(32);

      // Chiffrement fichier (Petit fichier = 1 seul bloc ou quelques blocs en mémoire)
      const nonceFile = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        fileBytes, null, null, nonceFile, fileKey
      );
      const finalBlob = new Uint8Array([...nonceFile, ...ciphertext]);

      // Chiffrement Métadonnées
      const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const encryptedMetadata = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        sodium.from_string(metadata), null, null, nonceMeta, fileKey
      );
      const finalMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadata]);

      // Chiffrement Clé Fichier
      const nonceKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const encryptedFileKey = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        fileKey, null, null, nonceKey, encryptionKey
      );
      const finalFileKey = new Uint8Array([...nonceKey, ...encryptedFileKey]);

      nbFilesUploadedRef.current += 1;
      // Envoi
      const payload = {
        encrypted_blob: bufToB64(finalBlob),
        encrypted_metadata: bufToB64(finalMetadata),
        encrypted_file_key: bufToB64(finalFileKey),
        media_type: file.type || 'application/octet-stream',
        file_size: finalBlob.length,
        parent_folder_id: activeFolderId,
      };

      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current ? abortControllerRef.current.signal : undefined,
      });

      if (!response.ok) throw new Error('Erreur API Upload Simple');
      return true;

    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Upload annulé pour le petit fichier:', file.name);
        return false;
      }
      console.error('Erreur upload petit fichier:', e);
      return false;
    }
  };

  const uploadLargeFileStreaming = async (file, sodium, encryptionKey) => {
    if (stopallUploadsRef.current) {
      console.log("Upload arrêté par l'utilisateur pour le gros fichier:", file.name);
      return false; // Annuler l'upload de ce fichier
    }
    // --- 1. Préparation (Identique à avant) ---
    const fileKey = sodium.randombytes_buf(32);

    const metadata = JSON.stringify({
      filename: file.name,
      filesize: file.size,
      filetype: file.type,
    });

    const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedMetadata = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      sodium.from_string(metadata), null, null, nonceMeta, fileKey
    );
    const finalMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadata]);

    const nonceKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedFileKey = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      fileKey, null, null, nonceKey, encryptionKey
    );
    const finalFileKey = new Uint8Array([...nonceKey, ...encryptedFileKey]);

    // --- 2. Initialisation Serveur ---
    let temp_upload_id;
    try {
      const openRes = await fetch('/api/drive/open_streaming_upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encrypted_metadata: bufToB64(finalMetadata),
          encrypted_file_key: bufToB64(finalFileKey),
          media_type: file.type || 'application/octet-stream',
          file_size: file.size,
          parent_folder_id: activeFolderId
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!openRes.ok) {
        let message = await openRes.json();
        return false;
        // throw new Error(message);
      }
      const data = await openRes.json();
      temp_upload_id = data.temp_upload_id;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Upload annulé lors de l\'initialisation pour:', file.name);
        return false;
      }
      throw e;
    }
    // console.log('Upload streaming initialisé, ID:', temp_upload_id);

    // --- 3. UPLOAD CONCURRENT (Le changement est ici) ---

    const CHUNK_SIZE = 1024 * 1024; // 1 Mo
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Variables partagées entre les workers
    let nextChunkIndexToProcess = 0;
    let chunksFinished = 0;

    // Nombre d'envois simultanés (3 est un bon équilibre, max 5)
    const MAX_CONCURRENT_UPLOADS = 3;

    nbFilesUploadedRef.current += 1;
    // La fonction que chaque "Worker" va exécuter en boucle
    const processNextChunk = async () => {
      while (nextChunkIndexToProcess < totalChunks) {

        // 1. On "réserve" le morceau actuel et on incrémente le compteur global
        const currentIndex = nextChunkIndexToProcess;
        nextChunkIndexToProcess++; // Le prochain worker prendra l'index suivant

        const offset = currentIndex * CHUNK_SIZE;

        try {
          // Lecture
          // Note: slice est rapide, ne charge pas en mémoire
          const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
          const chunkBuffer = await readChunkAsArrayBuffer(chunkBlob);
          const chunkBytes = new Uint8Array(chunkBuffer);

          // Chiffrement
          const nonceChunk = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
          const encryptedChunkBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
            chunkBytes, null, null, nonceChunk, fileKey
          );
          const finalChunk = new Uint8Array([...nonceChunk, ...encryptedChunkBlob]);

          // Upload
          let uploadRes;
          try {
            uploadRes = await fetch('/api/drive/upload_chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                temp_upload_id: temp_upload_id,
                chunk_index: currentIndex, // Important : envoyer le bon index !
                total_chunks: totalChunks,
                encrypted_chunk: bufToB64(finalChunk)
              }),
              signal: abortControllerRef.current.signal,
            });
          } catch (e) {
            if (e.name === 'AbortError') {
              console.log(`Upload annulé pour le chunk ${currentIndex} du fichier:`, file.name);
              // Nettoyer côté serveur
              fetch('/api/drive/cancel_streaming_upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temp_upload_id: temp_upload_id })
              }).catch(err => console.error('Erreur lors du nettoyage:', err));
              return; // Sortir de la fonction processNextChunk
            }
            throw e;
          }

          if (!uploadRes.ok) throw new Error(`Erreur upload chunk ${currentIndex}`);

          if (stopallUploadsRef.current) {
            console.log("Upload arrêté par l'utilisateur.");
            fetch('/api/drive/cancel_streaming_upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ temp_upload_id: temp_upload_id })
            });
            // supprimer toutes les ref a cet upload
            delete UploadProcesses[file.name];
            setUploadProcesses({ ...UploadProcesses });
            setCurentUploadingFilesNames(Object.keys(UploadProcesses));
            // enlever 1 au nombre de fichiers en cours d'upload
            uploadingCountRef.current = Math.max(0, uploadingCountRef.current - 1);
            setUploadingsFilesCount(uploadingCountRef.current);
            if (uploadingCountRef.current > 0) {
              setUploading(true);
            } else {
              setUploading(false);
              nbFilesUploadedRef.current = 0;
              totalFilesToUploadRef.current = 0;
              stopallUploadsRef.current = false;
              abortControllerRef.current = null; // Réinitialiser l'AbortController
            }
          }

          // Mise à jour progression UI
          chunksFinished++;
          let percent = Math.min(100, Math.round((chunksFinished / totalChunks) * 100));

          UploadProcesses[file.name] = percent;
          setUploadProcesses({ ...UploadProcesses });
          setCurentUploadingFilesNames(Object.keys(UploadProcesses));
          // console.log(`Chunk ${currentIndex + 1}/${totalChunks} uploadé. Progression: ${percent}%`);

          // Ici tu peux appeler setProgress(percent) si tu as un state React

        } catch (error) {
          console.error(`Erreur sur le chunk ${currentIndex}`, error);
          throw error; // Cela arrêtera Promise.all
        }
      }
    };

    // Lancement du Pool
    const workers = [];
    for (let i = 0; i < MAX_CONCURRENT_UPLOADS; i++) {
      workers.push(processNextChunk());
    }

    // On attend que TOUS les workers aient fini (quand il n'y a plus de chunks)
    await Promise.all(workers);

    console.log("Tous les chunks sont envoyés !");

    // 4. Finalisation (Optionnel mais recommandé)
    // C'est ici qu'on devrait dire au serveur "J'ai fini, déplace tout dans la vraie table"
    // et qu'on envoie la encrypted_file_key si elle n'a pas été envoyée au début.

    //     pub struct FinishStreamingUploadRequest {
    //     pub temp_upload_id: Uuid,
    //     pub encrypted_file_key: String,
    //     pub encrypted_metadata: String,
    //     pub media_type: String,
    //     pub file_size: usize,
    //     pub parent_folder_id: Uuid,
    // }
    try {
      const finalizeRes = await fetch('/api/drive/finish_streaming_upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temp_upload_id: temp_upload_id,
          encrypted_file_key: bufToB64(finalFileKey),
          encrypted_metadata: bufToB64(finalMetadata),
          media_type: file.type || 'application/octet-stream',
          file_size: file.size,
          parent_folder_id: activeFolderId

        }),
        signal: abortControllerRef.current.signal,
      });

      if (!finalizeRes.ok) throw new Error("Erreur lors de la finalisation de l'upload streaming");
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Upload annulé lors de la finalisation pour:', file.name);
        return false;
      }
      throw e;
    }

    console.log('Streaming terminé.');
    return true;
  };

  // Helper pour lire un blob en Promise
  const readChunkAsArrayBuffer = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(blob);
    });
  };

  const processFolder = async (folder) => {
    await _sodium.ready;
    const sodium = _sodium;

    const storageKeyHex = localStorage.getItem('storageKey');
    if (!storageKeyHex) {
      window.location.href = '/login';
      throw new Error('Clé de stockage manquante. Redirection vers la page de connexion.');
    }

    // 1. Préparer la Clé Maître de l'utilisateur (32 bytes)
    const rawStorageKey = sodium.from_hex(storageKeyHex);
    const userMasterKey = sodium.crypto_generichash(32, rawStorageKey);

    try {
      // --- ÉTAPE A : Déchiffrer la Clé du Dossier (FolderKey) ---
      // On a besoin de folder.encrypted_folder_key renvoyé par le SQL
      const encryptedKeyBuffer = sodium.from_base64(folder.encrypted_folder_key, sodium.base64_variants.ORIGINAL);

      const nonceKey = encryptedKeyBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextKey = encryptedKeyBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

      const folderKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextKey,
        null,
        nonceKey,
        userMasterKey // On utilise la clé de l'utilisateur ici
      );

      // --- ÉTAPE B : Déchiffrer les Métadonnées avec la FolderKey ---
      const encryptedMetaBuffer = sodium.from_base64(folder.encrypted_metadata, sodium.base64_variants.ORIGINAL);

      const nonceMeta = encryptedMetaBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextMeta = encryptedMetaBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

      const decryptedMetadataBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextMeta,
        null,
        nonceMeta,
        folderKey // On utilise la clé du dossier qu'on vient de trouver !
      );

      // On parse le JSON
      const metadata = JSON.parse(sodium.to_string(decryptedMetadataBytes));

      // On retourne l'objet complet fusionné pour l'affichage
      return {
        ...folder,
        name: metadata.name, // Le nom déchiffré
        created_at: metadata.created_at,
        updated_at: metadata.updated_at || metadata.created_at,
        // key
        encrypted_folder_key: folder.encrypted_folder_key,
        // ... autres infos du metadata si besoin
      };

    } catch (error) {
      console.error("Erreur déchiffrement dossier:", folder.id, error);
      return { ...folder, name: "Erreur déchiffrement" };
    }
  };

  // une boucle toute les 1s

  const processFile = async (file) => {
    await _sodium.ready;
    const sodium = _sodium;

    const storageKeyHex = localStorage.getItem('storageKey');
    if (!storageKeyHex) {
      window.location.href = '/login';
      throw new Error('Clé de stockage manquante. Redirection vers la page de connexion.');
    }

    // 1. Préparer la Clé Maître de l'utilisateur (32 bytes)
    const rawStorageKey = sodium.from_hex(storageKeyHex);
    const userMasterKey = sodium.crypto_generichash(32, rawStorageKey);

    try {
      // --- ÉTAPE A : Déchiffrer la Clé du Fichier (FileKey) ---
      const encryptedKeyBuffer = sodium.from_base64(file.encrypted_file_key, sodium.base64_variants.ORIGINAL);

      const nonceKey = encryptedKeyBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextKey = encryptedKeyBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

      const fileKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextKey,
        null,
        nonceKey,
        userMasterKey // On utilise la clé de l'utilisateur ici
      );

      // --- ÉTAPE B : Déchiffrer les Métadonnées avec la FileKey ---
      const encryptedMetaBuffer = sodium.from_base64(file.encrypted_metadata, sodium.base64_variants.ORIGINAL);

      const nonceMeta = encryptedMetaBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const ciphertextMeta = encryptedMetaBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

      const decryptedMetadataBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextMeta,
        null,
        nonceMeta,
        fileKey // On utilise la clé du fichier qu'on vient de trouver !
      );

      // On parse le JSON
      const metadata = JSON.parse(sodium.to_string(decryptedMetadataBytes));

      // On retourne l'objet complet fusionné pour l'affichage
      return {
        ...file,
        name: metadata.filename, // Le nom déchiffré
        total_size: metadata.filesize,
        type: metadata.filetype,
        // ... autres infos du metadata si besoin
      };

    } catch (error) {
      console.error("Erreur déchiffrement fichier:", file.id, error);
      return { ...file, name: "Erreur déchiffrement" };
    }
  };

  const getFolderStructure = async (id_parent) => {
    let url = `/api/drive/folders?parent_folder_id=${id_parent}`;
    if (id_parent) {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();

      if (data.status === 'success') { // Adapte selon ton retour API exact

        const storage_used = data.storage_used || 0;
        const storage_limit = data.storage_limit || 1;
        setStorageUsed(storage_used);
        setStorageLimit(storage_limit);

        // si le dossier est le root on appelle la focntion root
        if (data.is_root) {
          console.log("Dossier racine détecté.");
          const rootId = data.folders[0]?.folder_id;
          setActiveFolderId(rootId);
          setRootFolderId(rootId);
        }

        const decryptedFolders = [];

        for (const folder of data.folders) {
          // On appelle la fonction qui fait le double déchiffrement
          const cleanFolder = await processFolder(folder);
          console.log("Dossier déchiffré:", cleanFolder);
          decryptedFolders.push(cleanFolder);
        }

        setFolders(decryptedFolders);
      }
    }
    else {
      getRootFolder();
    }
  };

  const getFileStructure = async (id_parent) => {
    let url = `/api/drive/files?parent_folder_id=${id_parent}`;
    if (id_parent) {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();

      if (data.status === 'success') { // Adapte selon ton retour API exact
        // console.log("Fichiers reçus:", data);
        const decryptedFiles = [];

        for (const file of data.files) {
          // On appelle la fonction qui fait le double déchiffrement
          const cleanFile = await processFile(file);
          decryptedFiles.push(cleanFile);
        }
        
        console.log("Fichier déchiffré:", decryptedFiles);
        setFiles(decryptedFiles);
      }
    }
  }

  const getRootFolder = async () => {
    const res = await fetch('/api/drive/folders', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    if (data.status === 'success' && data.folders.length > 0) {
      const rootId = data.folders[0].folder_id;


      setActiveFolderId(rootId);
      setRootFolderId(rootId);

      const newUrl = new URL(window.location);
      newUrl.searchParams.set('folderId', rootId);
      window.history.pushState({}, '', newUrl);

      // CORRECTION ICI : On met un tableau d'objets
      setPath([{ id: rootId, name: 'Mon Drive' }]);

      return data.folders[0];
    }
    throw new Error('Impossible de récupérer le dossier racine.');
  };

  const loadFullPathFromFolderId = async (folderId) => {
    const urlParams = new URLSearchParams(window.location.search);
    const folderIdParam = urlParams.get('folderId');

    if (!folderIdParam) getRootFolder();
    else {
      let url = `/api/drive/full_path?folder_id=${folderIdParam}`;
      console.log("Fetching full path for folder ID:", folderIdParam);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        const fullPathArray = data.full_path;
        console.log("Full path data received:", fullPathArray);

        if (fullPathArray.length === 0) {
          // Si le chemin est vide, on charge la racine
          getRootFolder();
          return;
        }

        // verifier si le derner dossier du path a l'attribut is_root a true
        const lastFolder = fullPathArray[fullPathArray.length - 1];
        console.log("Last folder in path:", lastFolder);
        if (lastFolder.is_root) {
          getRootFolder();
          return;
        }

        const reconstructedPath = [];
        for (const item of fullPathArray) {
          // Déchiffrement du nom de chaque dossier dans le chemin
          const decryptedFolder = await processFolder(item);
          reconstructedPath.push({ id: item.folder_id, name: decryptedFolder.name });
        }

        setPath(reconstructedPath);
        setActiveFolderId(folderIdParam);
        return;
      }
      console.error("Erreur récupération full path:", data.message);

    };
  };

  // --- NAVIGATION & INTERFACE ---

  const navigateToSection = (sectionId) => {
    setActiveSection(sectionId);
    console.log("Navigation vers la section :", sectionId);
    if (sectionId === 'mon_drive') {
      // Retour à la racine (on utilise le rootFolderId stocké précédemment)
      if (rootFolderId) {
        setActiveFolderId(rootFolderId);
        setPath([{ id: rootFolderId, name: 'Mon Drive' }]);
        getFolderStructure(rootFolderId);
        getFileStructure(rootFolderId);
      } else {
        getRootFolder();
      }
    } else {

      // Sections spéciales : cacher les dossiers et fichiers
      setFolders([]);
      setFiles([]);
      setPath([]); // Vider le chemin car on n'est pas dans un dossier classique
    }

    // Mettre à jour l'URL sans recharger la page
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('folderId'); // Supprimer folderId pour les sections spéciales
    // Ajoute un hash pour indiquer la section active dans l'URL
    newUrl.hash = `#${sectionId}`;
    window.history.pushState({}, '', newUrl);

  };

  const handlePathClick = (item, index) => {
    // On garde le chemin du début (0) jusqu'à l'élément cliqué inclus (index + 1)
    const newPath = path.slice(0, index + 1);
    setPath(newPath);

    const newUrl = new URL(window.location);
    newUrl.searchParams.set('folderId', item.id);
    window.history.pushState({}, '', newUrl);


    // On charge le dossier correspondant
    setActiveFolderId(item.id);
  };


  const handleFolderClick = (folderId, folderName) => {
    if (!folderId || !folderName) return;
    if (activeFolderId === folderId) return;

    // cacher tout les dossiers, et les fichiers affichés

    // rajoute dans l'url le folderId
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('folderId', folderId);
    window.history.pushState({}, '', newUrl);

    // CORRECTION : On ajoute un objet au tableau existant
    setPath((prevPath) => [
      ...prevPath,
      { id: folderId, name: folderName }
    ]);

    setActiveFolderId(folderId);

  };


  const rename_folder = async (folderId, newName) => {
    let folder = document.getElementById(folderId);
    let folderName = folder.querySelector(".folder_name");
    let menu = document.getElementById("contextual_menu_folder");

    if (folderName) {
      // Hide le menu 
      menu.style.display = "none";

      folderName.classList.add("editing_folder_name");
      folderName.contentEditable = true;
      folderName.focus();

      // Sélectionner le texte (execCommand est un peu vieux mais fonctionne encore)
      document.execCommand('selectAll', false, null);

      // --- AJOUT : Bloquer la touche Entrée ---
      folderName.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault(); // Empêche le <br>
          folderName.blur();  // Simule le clic en dehors pour valider
        }
      };

      // --- AJOUT OPTIONNEL : Bloquer le collage de texte avec sauts de ligne ---
      folderName.onpaste = (e) => {
        e.preventDefault();
        // Récupère le texte brut sans formatage
        const text = (e.clipboardData || window.clipboardData).getData('text');
        // Insère le texte en remplaçant les sauts de ligne par des espaces
        document.execCommand('insertText', false, text.replace(/(\r\n|\n|\r)/gm, " "));
      };

      folderName.onblur = async () => {
        // Nettoyage des événements pour éviter les conflits futurs
        folderName.onkeydown = null;
        folderName.onpaste = null;

        folderName.contentEditable = false;
        let newName = folderName.innerText; // .innerText nettoie souvent mieux que .innerHTML
        let created_at = folder.getAttribute("data-created-at");
        let updated_at = new Date().toISOString();


        let metadata = {
          name: newName,
          created_at: created_at,
        };
        console.log(folder.getAttribute("data-encrypted-folder-key"));

        await _sodium.ready;
        const sodium = _sodium;

        const storageKeyHex = localStorage.getItem('storageKey');
        if (!storageKeyHex) {
          window.location.href = '/login';
          throw new Error('Clé de stockage manquante. Redirection vers la page de connexion.');
        }

        const rawStorageKey = sodium.from_hex(storageKeyHex);
        const userMasterKey = sodium.crypto_generichash(32, rawStorageKey);
        // Déchiffrer la clé du dossier
        const encryptedKeyBuffer = sodium.from_base64(folder.getAttribute("data-encrypted-folder-key"), sodium.base64_variants.ORIGINAL);
        const nonceKey = encryptedKeyBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const ciphertextKey = encryptedKeyBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

        const folderKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          ciphertextKey,
          null,
          nonceKey,
          userMasterKey
        );

        // Chiffrer les nouvelles métadonnées avec la clé du dossier
        const metadataStr = JSON.stringify(metadata);
        const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const encryptedMetadataBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
          sodium.from_string(metadataStr),
          null,
          null,
          nonceMeta,
          folderKey
        );
        const encryptedMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadataBlob]);
        const encryptedMetadataB64 = sodium.to_base64(encryptedMetadata, sodium.base64_variants.ORIGINAL);


        console.log("Renommer le dossier :", folderId, "en", newName);
        folderName.classList.remove("editing_folder_name");

        fetch('/api/drive/rename_folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_id: folderId,
            new_encrypted_metadata: encryptedMetadataB64
          }),
        })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              console.log("Dossier renommé avec succès.");
              folder.setAttribute("data-folder-name", newName);
              // Mettre à jour l'état des dossiers
              setFolders(prevFolders => prevFolders.map(f => f.folder_id === folderId ? { ...f, name: newName } : f));
              // Rafraîchir la vue du dossier courant
            } else {

              console.error("Erreur renommage dossier :", data.message);
            }
          })
          .catch(error => {
            console.error("Erreur lors de la requête de renommage :", error);
          });
      };

    } else {
      console.error("Element with class 'folder_name' not found in folder:", folderId);
    }
  };

  const delete_folder = async (folderId) => {
    console.log("Supprimer le dossier :", folderId);
    fetch('/api/drive/delete_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folder_id: folderId
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          console.log("Dossier supprimé avec succès.");
          // Mettre à jour l'état des dossiers
          setFolders(prevFolders => prevFolders.filter(f => f.folder_id !== folderId));
          // Rafraîchir la vue du dossier courant
          setTimeout(() => {
            getFolderStructure(activeFolderId);
            getFileStructure(activeFolderId);
          }, 500);
        } else {
          console.error("Erreur suppression dossier :", data.message);
        }
      })
      .catch(error => {
        console.error("Erreur lors de la requête de suppression :", error);
      });
  };

  const opent_menu_contextual_folder = (folderId, x, y) => {
    // creer une div qui s'affiche a la position x,y
    // avec des options comme renommer, supprimer, partager, etc.

    let menu = document.getElementById("contextual_menu_folder");
    menu.style.display = "flex";
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    // stocker l'id du dossier dans un data attribute
    menu.setAttribute("data-folder-id", folderId);

    document.addEventListener("click", function handler(event) {
      if (!menu.contains(event.target)) {
        menu.style.display = "none";
        document.removeEventListener("click", handler);

      }
    });

    let renameOption = menu.querySelector("#rename_folder_option");

    renameOption.onclick = () => {
      rename_folder(folderId);
    }

    let deleteOption = menu.querySelector("#delete_folder_option");
    deleteOption.onclick = () => {
      delete_folder(folderId);
      // close the menu
      menu.style.display = "none";
    }

    let shareOption = menu.querySelector("#share_folder_option");
    shareOption.onclick = () => {
      console.log("Partager le dossier :", folderId);
    }

  }

  const delete_file = async (fileId) => {
    console.log("Supprimer le fichier :", fileId);
    fetch('/api/drive/delete_file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: fileId
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          console.log("Fichier supprimé avec succès.");
          // Mettre à jour l'état des fichiers
          setFiles(prevFiles => prevFiles.filter(f => f.file_id !== fileId));
          // Rafraîchir la vue du dossier courant

          setTimeout(() => {
            getFolderStructure(activeFolderId);
            getFileStructure(activeFolderId);
          }, 500);
        } else {
          console.error("Erreur suppression fichier :", data.message);
        }
      })
      .catch(error => {
        console.error("Erreur lors de la requête de suppression :", error);
      });
  };

  const rename_file = async (fileId, newName) => {
    let file = document.getElementById(fileId);
    console.log("file element:", file);
    let fileName = file.querySelector(".file_name");
    let menu = document.getElementById("contextual_menu_folder");
    
    if (fileName) {
      // Hide le menu 
      menu.style.display = "none";

      fileName.classList.add("editing_file_name");
      fileName.contentEditable = true;
      fileName.focus();

      // Sélectionner le nom du fichier mais pas l'extension
      let nameParts = fileName.innerText.split('.');
      if (nameParts.length > 1) {
        let extension = nameParts.pop();
        let nameWithoutExt = nameParts.join('.');
        let range = document.createRange();
        let sel = window.getSelection();
        range.setStart(fileName.firstChild, 0);
        range.setEnd(fileName.firstChild, nameWithoutExt.length);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Si pas d'extension, sélectionner tout
        document.execCommand('selectAll', false, null);
      }

      // --- AJOUT : Bloquer la touche Entrée ---
      fileName.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault(); // Empêche le <br>
          fileName.blur();  // Simule le clic en dehors pour valider
        }
      };

      fileName.onblur = async () => {
        // Nettoyage des événements pour éviter les conflits futurs
        fileName.onkeydown = null;

        fileName.contentEditable = false;
        let newName = fileName.innerText; // .innerText nettoie souvent mieux que .innerHTML
        let created_at = file.getAttribute("data-created-at");
        let updated_at = new Date().toISOString();
        let metadata = {
          filename: newName,
          filesize: file.getAttribute("data-file-size"),
          filetype: file.getAttribute("data-file-type"),
        };

        await _sodium.ready;
        const sodium = _sodium;

        const storageKeyHex = localStorage.getItem('storageKey');
        if (!storageKeyHex) {
          window.location.href = '/login';
          throw new Error('Clé de stockage manquante. Redirection vers la page de connexion.');
        }

        const rawStorageKey = sodium.from_hex(storageKeyHex);
        const userMasterKey = sodium.crypto_generichash(32, rawStorageKey);
        // Déchiffrer la clé du fichier
        const encryptedKeyBuffer = sodium.from_base64(file.getAttribute("data-encrypted-file-key"), sodium.base64_variants.ORIGINAL);
        const nonceKey = encryptedKeyBuffer.slice(0, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const ciphertextKey = encryptedKeyBuffer.slice(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

        const fileKey = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
          null,
          ciphertextKey,
          null,
          nonceKey,
          userMasterKey
        );

        // Chiffrer les nouvelles métadonnées avec la FileKey
        const metadataStr = JSON.stringify(metadata);
        const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
        const encryptedMetadataBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
          sodium.from_string(metadataStr),
          null,
          null,
          nonceMeta,
          fileKey
        );
        const encryptedMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadataBlob]);
        const encryptedMetadataB64 = sodium.to_base64(encryptedMetadata, sodium.base64_variants.ORIGINAL);
        console.log("Renommer le fichier :", fileId, "en", newName);
        fileName.classList.remove("editing_file_name");

        fetch('/api/drive/rename_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_id: fileId,
            new_encrypted_metadata: encryptedMetadataB64
          }),
        })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              console.log("Fichier renommé avec succès.");
              file.setAttribute("data-file-name", newName);
              // Mettre à jour l'état des fichiers
              setFiles(prevFiles => prevFiles.map(f => f.file_id === fileId ? { ...f, name: newName } : f));
              // Rafraîchir la vue du dossier courant
            } else {

              console.error("Erreur renommage fichier :", data.message);
            }
          })
          .catch(error => {
            console.error("Erreur lors de la requête de renommage :", error);
          });
      };

    } else {
      console.error("Element with class 'file_name' not found in file:", fileId);
    }
  }

  const open_menu_contextual_file = (fileId, x, y) => {
    // creer une div qui s'affiche a la position x,y
    // avec des options comme renommer, supprimer, partager, etc.

    let menu = document.getElementById("contextual_menu_folder");
    menu.style.display = "flex";
    menu.style.left = x + "px";
    menu.style.top = y + "px";

    // stocker l'id du fichier dans un data attribute
    menu.setAttribute("data-file-id", fileId);

    document.addEventListener("click", function handler(event) {
      if (!menu.contains(event.target)) {
        menu.style.display = "none";
        document.removeEventListener("click", handler);

      }
    });

    let renameOption = menu.querySelector("#rename_folder_option");

    renameOption.onclick = () => {
      rename_file(fileId);
    }

    let deleteOption = menu.querySelector("#delete_folder_option");
    deleteOption.onclick = () => {
      delete_file(fileId);
      // close the menu
      menu.style.display = "none";
    }

    let shareOption = menu.querySelector("#share_folder_option");
    shareOption.onclick = () => {
      console.log("Partager le fichier :", fileId);
    }

  }

  const getUserInfo = async () => {
    try {
      const res = await fetch('/api/auth/info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.status === 'success' && data.user_info) {
        // Met à jour le nom d'utilisateur affiché (prénom + nom si dispo, sinon email)
        if (data.user_info.first_name && data.user_info.last_name) {
          console.log("Nom utilisateur récupéré :", `${data.user_info.first_name} ${data.user_info.last_name}`);
          setUserName(`${data.user_info.first_name} ${data.user_info.last_name}`);
        } else if (data.user_info.email) {
          setUserName(data.user_info.email);
        }
      } else {
        console.error("Erreur récupération info utilisateur :", data.message);
      }
    } catch (e) {
      console.error("Erreur lors de la récupération des infos utilisateur :", e);
    }
  };

  // --- EFFETS DE BORD ---

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
    } else {
      getUserInfo();
    }
  }, [token]);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      setActiveSection(hash);
    }

    if (hash === 'mon_drive') {
      console.log("Active Folder ID changed:", activeFolderId);
      if (activeFolderId === null) {
        loadFullPathFromFolderId();
        getFileStructure(activeFolderId);
      } else {
        getFolderStructure(activeFolderId);
        getFileStructure(activeFolderId);
      }
    } else if (hash === 'corbeille' || hash === 'favoris') {
      // Pour l'instant, on ne gère pas les fichiers spéciaux
      setFolders([]);
      setFiles([]);
    }else {
      // Par défaut, on charge le dossier actif
      if (activeFolderId === null){
        getRootFolder();
        getFolderStructure(activeFolderId);
        getFileStructure(activeFolderId);
        let newUrl = new URL(window.location);
        newUrl.hash = `#mon_drive`;
        window.history.pushState({}, '', newUrl);
      } else {
        getFolderStructure(activeFolderId);
        getFileStructure(activeFolderId);
      }
    }

    // mettre des folder pour le debug  



    const handleClickAnywhere = (event) => {
      if (event.target.closest('.folder_graph')) return;
      document.querySelectorAll('.folder_graph.selected_folder').forEach((el) => {
        el.classList.remove('selected_folder');
      });
    };

    document.addEventListener('click', handleClickAnywhere);

    return () => {
      document.removeEventListener('click', handleClickAnywhere);
    };





  }, [activeFolderId, token]);

  // Met à jour `contents` dès que `folders` ou `files` changent
  useEffect(() => {
    const unified = [
      ...folders.map((folder) => ({
        ...folder,
        id: folder.folder_id,
        type: 'folder',
        name: folder.name,
      })),
      ...files.map((file) => ({
        ...file,
        id: file.file_id,
        type: 'file',
        name: file.name,
      })),
    ];
    setContents(unified);
  }, [folders, files]);

  // Ajoutez ceci à l'intérieur de votre composant, avant le return
  const [selectedId, setSelectedId] = useState(null);

  // Fonction utilitaire pour gérer la sélection (évite la répétition)
  const handleSelection = (id) => {
    setSelectedId(id);
  };

  // --- RENDU (JSX) ---
  return (
    <div className="drive-container"> {/* J'ai retiré html/head/body pour integrer dans un composant */}

      <Header TITLE="GZDRIVE" userName={userName} ></Header>

      <section>
        <div id='contextual_menu_folder' >
          <div className="option_menu_contextual" id="rename_folder_option">
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M15.7279 9.57627L14.3137 8.16206L5 17.4758V18.89H6.41421L15.7279 9.57627ZM17.1421 8.16206L18.5563 6.74785L17.1421 5.33363L15.7279 6.74785L17.1421 8.16206ZM7.24264 20.89H3V16.6473L16.435 3.21231C16.8256 2.82179 17.4587 2.82179 17.8492 3.21231L20.6777 6.04074C21.0682 6.43126 21.0682 7.06443 20.6777 7.45495L7.24264 20.89Z"></path></svg>
            Renommer
          </div>
          <div className="option_menu_contextual" id="delete_folder_option">
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z"></path></svg>
            Supprimer
          </div>
          <div className="option_menu_contextual" id="share_folder_option">
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.58582L18.2071 8.79292L16.7929 10.2071L13 6.41424V16H11V6.41424L7.20711 10.2071L5.79289 8.79292L12 2.58582ZM3 18V14H5V18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18V14H21V18C21 19.6569 19.6569 21 18 21H6C4.34315 21 3 19.6569 3 18Z"></path></svg>
            Partager
          </div>
        </div>

        <div className="div_upload_progress" style={{ display: uploadingsFilesCount > 0 ? 'block' : 'none' }}>
          <div className="div_storage_used">
            <div className="storage_used_text">
              <span>{(storageUsed / (1024 ** 3)).toFixed(2)} GB</span> / <span>{(storageLimit / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
            <div className="storage_used_container">
              <div className={`storage_used_bar${(storageUsed / storageLimit) >= 0.95 ? ' full' : ''}`} style={{ width: `${(storageUsed / storageLimit) * 100}%` }}></div>
            </div>
          </div>
          {/* div pour annulé tout l'upload */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <a style={{ fontWeight: 'bold' }}>Importation en cours...</a>
            <button
              onClick={() => {
                // Annuler tous les uploads en cours
                stopallUploadsRef.current = true;
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
              }}
              style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'red', fontWeight: 'bold' }}
              title="Annuler l'importation"
            >
              Annuler
            </button>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <a style={{ display: totalFilesToUploadRef.current - nbFilesUploadedRef.current > 0 ? 'block' : 'none' }}>Fichier(s) en attente : {totalFilesToUploadRef.current - nbFilesUploadedRef.current}</a>
          </div>
          {curentUploadingFilesNames.map((fileName) => (
            <div key={fileName} style={{ marginBottom: '10px', display: UploadProcesses[fileName] === 100 ? 'none' : 'block' }}>
              <a>{fileName} - {UploadProcesses[fileName]}%</a>
              <div className="progress_bar_container">
                <div className="progress_bar_fill" style={{ width: `${UploadProcesses[fileName]}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        <div className="div_left_part">
          <nav>
            <ul>
              {/* Liste de navigation dynamique */}
              {[
                { id: 'mon_drive', label: 'Mon Drive' },
                { id: 'partages', label: 'Partagés avec moi' },
                { id: 'partages_par_moi', label: 'Partagés par moi' },
                { id: 'favoris', label: 'Favoris' },
                { id: 'corbeille', label: 'Corbeille' }
              ].map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className={activeSection === item.id ? 'active' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSection(item.id);
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          {/* div storage used en go sous forme d'une barre de progression */}
          <div className="div_storage_used">
            <div className="storage_used_container">
              <div className={`storage_used_bar${(storageUsed / storageLimit) >= 0.95 ? ' full' : ''}`} style={{ width: `${(storageUsed / storageLimit) * 100}%` }}></div>
            </div>
            <div className="storage_used_text">
              <span>{(storageUsed / (1024 ** 3)).toFixed(2)} GB</span> / <span>{(storageLimit / (1024 ** 3)).toFixed(2)} GB</span>
            </div>
          </div>
        </div>

        <div className="div_right_part">
          <div className="div_recher_filter">
            <div className="div_recherche">
              <div className="div_barre_bnt">
                {/* Bouton Recherche (SVG) */}
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 2C15.968 2 20 6.032 20 11C20 15.968 15.968 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2ZM11 18C14.8675 18 18 14.8675 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18ZM19.4853 18.0711L22.3137 20.8995L20.8995 22.3137L18.0711 19.4853L19.4853 18.0711Z"></path>
                </svg>

                <input type="text" placeholder="Rechercher dans votre drive..." />

                {/* Bouton Clear (SVG) */}
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path>
                </svg>

                {/* --- AJOUT : BOUTON UPLOAD --- */}

              </div>
              <button
                onClick={() => fileInputRef.current.click()}
                style={{ marginLeft: '10px', cursor: 'pointer', background: 'none', border: 'none' }}
                disabled={uploading}
                title="Uploader un fichier"
                id="btn_upload_file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM5 5V19H19V5H5ZM11 11V7H13V11H17V13H13V17H11V13H7V11H11Z"></path></svg>

              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                multiple
                maxSize={10485760}
              />

              {/* bouton pour rajouter un dossier */}
              <button
                onClick={() =>
                  newFolderFunction()
                }
                style={{ marginLeft: '10px', cursor: 'pointer', background: 'none', border: 'none' }}
                disabled={uploading}
                title="Créer un nouveau dossier"
                id="btn_new_folder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor"><path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5ZM4 5V19H20V7H11.5858L9.58579 5H4ZM11 12V9H13V12H16V14H13V17H11V14H8V12H11Z"></path></svg>

              </button>

              {/* bouton pour passer de l'affichage grid a list */}
              <button
                onClick={() => {
                  if (viewType === 'grid') {
                    setViewType('list');
                  } else {
                    setViewType('grid');
                  }
                }}
                style={{ marginLeft: '10px', cursor: 'pointer', background: 'none', border: 'none' }}
                disabled={uploading}
                title={viewType === 'grid' ? 'Passer en vue liste' : 'Passer en vue grille'}
                id="btn_toggle_view"
              >
                {viewType === 'grid' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H20V8H4V6ZM4 11H20V13H4V11ZM4 16H20V18H4V16Z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4H10V10H4V4ZM14 4H20V10H14V4ZM4 14H10V20H4V14ZM14 14H20V20H14V14Z"></path></svg>
                )}
              </button>
            </div>

            {/* <div className="div_filtres">
              {uploading && <span>Upload en cours...</span>}
            </div> */}
          </div>

          <div className="div_contenue">
            <div className="div_path_graphique">
              {path.map((part, index) => (
                <React.Fragment key={index}> {/* Line 1749 omitted */}
                  <div
                    className="div_folder_path_grap"
                    onClick={() => handlePathClick(part, index)} /* Lines 1752-1753 omitted */
                    style={{ cursor: 'pointer' }}
                    id={part.id}
                    consolelog={part}
                  /* Lines 1756-1757 omitted */
                  >
                    {/* Line 1758 omitted */}
                    <span style={{ fontWeight: index === path.length - 1 ? 'bold' : 'normal' }}>
                      {part.name}
                    </span>
                  </div>

                  {/* Line 1764 omitted */}
                  {index < path.length - 1 && (
                    <div className="div_folder_separator">
                      <span>/</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* =================================================================================
                VUE GRILLE (GRID)
                S'affiche uniquement si viewType est 'grid'
               ================================================================================= */}
            {viewType === 'grid' && (
              <>
                {/* --- DOSSIERS (GRILLE) --- */}
                <div className="div_contenue_folder" style={{ display: 'flex' }}>
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className={`folder_graph ${selectedId === folder.folder_id ? 'selected_folder' : ''}`}
                      id={folder.folder_id}
                      
                      // Data attributes conservés
                      data-folder-id={folder.id || ''}
                      data-folder-name={folder.name || ''}
                      data-folder-created-at={folder.created_at || ''}
                      data-folder-updated-at={folder.updated_at || ''}
                      data-encrypted-folder-key={folder.encrypted_folder_key || ''}
                      
                      onClick={() => handleSelection(folder.folder_id)}
                      onDoubleClick={() => handleFolderClick(folder.folder_id, folder.name)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleSelection(folder.folder_id);
                        opent_menu_contextual_folder(folder.folder_id, e.pageX, e.pageY);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"></path>
                      </svg>
                      <span className="folder_name">{folder.name}</span>
                    </div>
                  ))}

                  {folders.length === 0 && (
                    <div className="folder_graph_empty">
                      <span>Aucun dossier.</span>
                    </div>
                  )}
                </div>

                {/* --- FICHIERS (GRILLE) --- */}
                <div className="div_contenue_file" style={{ display: 'flex' }}>
                  {files.map((file) => (
                    <div
                      key={file.file_id}
                      className={`file_graph ${selectedId === file.file_id ? 'selected_file' : ''}`}
                      id={file.file_id}

                      // Data attributes conservés
                      data-file-id={file.file_id || ''}
                      data-file-name={file.name || ''}
                      data-file-size={file.size || ''}
                      data-file-type={file.type || ''}
                      data-file-created-at={file.created_at || ''}
                      data-file-updated-at={file.updated_at || ''}
                      data-encrypted-file-key={file.encrypted_file_key || ''}

                      onClick={() => handleSelection(file.file_id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleSelection(file.file_id);
                        open_menu_contextual_file(file.file_id, e.pageX, e.pageY);
                      }}
                      onDoubleClick={() => {
                        if (file.is_chunked) {
                          handleDownloadChunked(file.file_id, file.name);
                        } else {
                          handleDownload(file.file_id, file.name);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"></path>
                      </svg>
                      <span className='file_name'>{file.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* =================================================================================
                VUE LISTE (LIST)
                S'affiche uniquement si viewType est 'list'
               ================================================================================= */}
            {viewType === 'list' && (
              <div className='div_contenue_list' style={{ display: 'flex' }}>
                <div className="content_list_header">
                  <div className="header_name">Nom</div>
                  <div className="header_additional_info">
                    <span>Propriétaire</span>
                    <span>Taille</span>
                    <span>Créé le</span>
                    <span>Modifié le</span>
                  </div>
                </div>

                {contents.map((content) => {
                  // Détermination de l'ID unique et de la classe CSS selon le type
                  const currentId = content.type === 'folder' ? content.folder_id : content.file_id;
                  const isSelected = selectedId === currentId;
                  const selectionClass = isSelected ? (content.type === 'folder' ? 'selected_folder' : 'selected_file') : '';

                  return (
                    <div
                      key={content.id}
                      className={`content_graph_list ${selectionClass}`}
                      id={currentId}

                      // Data attributes conservés
                        // Data attributes selon le type (clean code)
                        {...(content.type === 'folder'
                        ? {
                          'data-folder-id': content.folder_id || '',
                          'data-folder-name': content.name || '',
                          'data-folder-created-at': content.created_at || '',
                          'data-folder-updated-at': content.updated_at || '',
                          'data-encrypted-folder-key': content.encrypted_folder_key || '',
                          }
                        : {
                          'data-file-id': content.file_id || '',
                          'data-file-name': content.name || '',
                          'data-file-size': content.total_size || '',
                          'data-file-type': content.type || '',
                          'data-file-created-at': content.created_at || '',
                          'data-file-updated-at': content.updated_at || '',
                          'data-encrypted-file-key': content.encrypted_file_key || '',
                          }
                        )}

                        onClick={() => handleSelection(currentId)}
                        onDoubleClick={() => {
                        if (content.type === 'file') {
                          if (content.is_chunked) {
                            handleDownloadChunked(content.file_id, content.name);
                          } else {
                            handleDownload(content.file_id, content.name);
                          }
                        } else if (content.type === 'folder') {
                          handleFolderClick(content.folder_id, content.name);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleSelection(currentId);
                        if (content.type === 'file') {
                          open_menu_contextual_file(content.file_id, e.pageX, e.pageY);
                        } else if (content.type === 'folder') {
                          opent_menu_contextual_folder(content.folder_id, e.pageX, e.pageY);
                        }
                      }}
                    >
                      <div className="icon_and_name">
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                          {content.type === 'folder' 
                            ? <path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"></path>
                            : <path d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"></path>
                          }
                        </svg>
                        <span className={content.type === 'file' ? 'file_name' : 'folder_name'}>{content.name}</span>
                      </div>
                      <div className="additional_info">
                        <span>{content.owner || ''}</span>
                        <span>
                          {(() => {
                            const size = content.total_size || 0;
                            if (size >= 1024 ** 3) return (size / (1024 ** 3)).toFixed(2) + ' GB';
                            if (size >= 1024 ** 2) return (size / (1024 ** 2)).toFixed(2) + ' MB';
                            if (size >= 1024) return (size / 1024).toFixed(2) + ' KB';
                            return size + ' B';
                          })()}
                        </span>
                        <span>
                          {new Date(content.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span>
                          {new Date(content.updated_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}