import React, { useState, useEffect, useRef } from 'react';
import _sodium from 'libsodium-wrappers';
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
  // varible qui contient l'id du dossier dans lequel on est
  const [activeFolderId, setActiveFolderId] = useState(null); // ID du dossier actif
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  // root id
  const [rootFolderId, setRootFolderId] = useState(null);

  // États pour l'upload (venant de votre code React)
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null); // Pour déclencher l'input file caché

  // --- LOGIQUE METIER (Encryption / Upload / Download) ---

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      encodeAndSend(selectedFile);
    }
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
  };
  // --- NOUVELLE VERSION DE encodeAndSend ---
  const encodeAndSend = async (selectedFile) => {
    setUploading(true);
    console.log('Début du processus...');

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
        await uploadLargeFileStreaming(selectedFile, sodium, encryptionKey);
      } else {
        console.log(`Fichier <= 0.9Mo (${selectedFile.size}). Passage en mode Simple.`);
        await uploadSmallFile(selectedFile, sodium, encryptionKey);
      }

      // 3. Fin commune
      console.log('Succès upload global.');
      setUploading(false);
      setTimeout(() => {
        getFolderStructure(activeFolderId);
        getFileStructure(activeFolderId);
      }, 500);

    } catch (error) {
      console.error('Erreur globale upload:', error);
      alert(`Erreur: ${error.message}`);
      setUploading(false);
    }
  };

  // --- LOGIQUE FICHIERS < 0.9 Mo (En mémoire) ---
  const uploadSmallFile = async (file, sodium, encryptionKey) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const fileBytes = new Uint8Array(event.target.result);

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
          });

          if (!response.ok) throw new Error('Erreur API Upload Simple');
          resolve();

        } catch (e) { reject(e); }
      };

      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  // --- LOGIQUE FICHIERS > 0.9 Mo (Streaming par Chunks) ---
  const uploadLargeFileStreaming = async (file, sodium, encryptionKey) => {
    // 1. Préparation des clés et métadonnées
    const fileKey = sodium.randombytes_buf(32);

    const metadata = JSON.stringify({
      filename: file.name,
      filesize: file.size,
      filetype: file.type,
    });

    // Chiffrement Metadata
    const nonceMeta = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedMetadata = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      sodium.from_string(metadata), null, null, nonceMeta, fileKey
    );
    const finalMetadata = new Uint8Array([...nonceMeta, ...encryptedMetadata]);

    // Chiffrement FileKey (ATTENTION: Il faudra sûrement l'envoyer au serveur lors de l'ouverture ou de la fermeture)
    const nonceKey = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const encryptedFileKey = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      fileKey, null, null, nonceKey, encryptionKey
    );
    const finalFileKey = new Uint8Array([...nonceKey, ...encryptedFileKey]);

    // 2. Initialisation de l'upload sur le serveur
    // Note : J'ajoute encrypted_file_key ici, assurez-vous que votre API Rust /open_streaming_upload le gère
    // ou stockez-le dans encrypted_metadata si vous préférez.
    const openRes = await fetch('/api/drive/open_streaming_upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_metadata: bufToB64(finalMetadata),
        encrypted_file_key: bufToB64(finalFileKey),
        media_type: file.type || 'application/octet-stream',
        file_size: file.size, // Taille originale approximative
        parent_folder_id: activeFolderId
      })
    });

    if (!openRes.ok) throw new Error("Impossible d'initialiser l'upload streaming");
    const { temp_upload_id } = await openRes.json();
    console.log('Upload streaming initialisé, ID:', temp_upload_id);

    // 3. Boucle de lecture et d'envoi par chunks
    const CHUNK_SIZE = 1024 * 1024; // 1 Mo par morceau
    let offset = 0;
    let chunkIndex = 0;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    while (offset < file.size) {
      // Lecture JUSTE du morceau nécessaire (pas de charge mémoire inutile)
      const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
      const chunkBuffer = await readChunkAsArrayBuffer(chunkBlob);

      const chunkBytes = new Uint8Array(chunkBuffer);

      // Chiffrement du morceau
      const nonceChunk = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const encryptedChunkBlob = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        chunkBytes, null, null, nonceChunk, fileKey
      );
      // Concaténation Nonce + Données chiffrées
      const finalChunk = new Uint8Array([...nonceChunk, ...encryptedChunkBlob]);

      // Envoi du morceau
      console.log(`Envoi chunk ${chunkIndex + 1}/${totalChunks}`);
      const uploadRes = await fetch('/api/drive/upload_chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temp_upload_id: temp_upload_id,
          chunk_index: chunkIndex,
          total_chunks: totalChunks,
          encrypted_chunk: bufToB64(finalChunk)
        })
      });

      if (!uploadRes.ok) throw new Error(`Erreur upload chunk ${chunkIndex}`);

      offset += CHUNK_SIZE;
      chunkIndex++;
    }

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
        
      })
    });

    if (!finalizeRes.ok) throw new Error("Erreur lors de la finalisation de l'upload streaming");

    console.log('Streaming terminé.');
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
        size: metadata.filesize,
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

        const decryptedFolders = [];

        for (const folder of data.folders) {
          // On appelle la fonction qui fait le double déchiffrement
          const cleanFolder = await processFolder(folder);
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
        console.log("Fichiers reçus:", data);
        const decryptedFiles = [];

        for (const file of data.files) {
          // On appelle la fonction qui fait le double déchiffrement
          const cleanFile = await processFile(file);
          decryptedFiles.push(cleanFile);
        }

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
      setActiveSection('mon_drive');

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

    if (sectionId === 'mon_drive') {
      // Retour à la racine (on utilise le rootFolderId stocké précédemment)
      if (rootFolderId) {
        setActiveFolderId(rootFolderId);
        setPath([{ id: rootFolderId, name: 'Mon Drive' }]);
      }
    } else {
      // Pour les autres sections (Corbeille, etc.), on peut simuler un path
      // Note: id null ou spécifique si vous gérez des vues spéciales
      const formatName = sectionId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      setPath([{ id: sectionId, name: formatName }]);
      // Ici il faudra probablement une logique pour charger les fichiers "Favoris" ou "Corbeille" au lieu de getFolderStructure
    }
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
      let folder = document.getElementById(folderId);
      let folderName = folder.querySelector(".folder_name");

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
    }
    let deleteOption = menu.querySelector("#delete_folder_option");
    deleteOption.onclick = () => {
      console.log("Supprimer le dossier :", folderId);
    }

    let shareOption = menu.querySelector("#share_folder_option");
    shareOption.onclick = () => {
      console.log("Partager le dossier :", folderId);
    }

  }


  useEffect(() => {
    if (activeFolderId === null) {
      loadFullPathFromFolderId();
      getFileStructure(activeFolderId);
    } else {
      getFolderStructure(activeFolderId);
      getFileStructure(activeFolderId);
    }

    // ajouter un folder a la main pour le dev
    setFolders((prevFolders) => [
      ...prevFolders,
      { folder_id: 'dev_folder', name: 'Dossier Dev' }
    ]);

    // si on clique quelque part sur la page

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



  }, [activeFolderId]);
  // --- RENDU (JSX) ---
  return (
    <div className="drive-container"> {/* J'ai retiré html/head/body pour integrer dans un composant */}

      <header>
        <h1><a href="/">GZDRIVE</a></h1>
        <div className="div_user_profil">
          {!imageLoadedState && <div className="div_profil_custom"></div>}
          <img
            className={`user-image ${imageLoadedState ? 'loaded' : ''}`}
            src="/images/user_profile.png" // Assurez-vous que l'image est dans le dossier 'public'
            alt="User Profile"
            onLoad={() => setImageLoadedState(true)}
          />
        </div>
      </header>

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
                maxSize={10485760}
              />

              {/* bouton pour rajouter un dossier */}
              <button
                onClick={() => newFolderFunction()}
                style={{ marginLeft: '10px', cursor: 'pointer', background: 'none', border: 'none' }}
                disabled={uploading}
                title="Créer un nouveau dossier"
                id="btn_new_folder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '22px', height: '22px', cursor: 'pointer' }} viewBox="0 0 24 24" fill="currentColor"><path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5ZM4 5V19H20V7H11.5858L9.58579 5H4ZM11 12V9H13V12H16V14H13V17H11V14H8V12H11Z"></path></svg>

              </button>
            </div>

            <div className="div_filtres">
              {uploading && <span>Upload en cours...</span>}
            </div>
          </div>

          <div className="div_contenue">
            <div className="div_path_graphique">
              {path.map((part, index) => (
                <React.Fragment key={index}> {/* Utiliser index ou part.id comme key */}
                  <div
                    className="div_folder_path_grap"
                    onClick={() => handlePathClick(part, index)} // Appel de la nouvelle fonction
                    style={{ cursor: 'pointer' }}
                    id={part.id}
                    consolelog={part}
                  // mettre des param
                  >
                    {/* On affiche bien part.name */}
                    <span style={{ fontWeight: index === path.length - 1 ? 'bold' : 'normal' }}>
                      {part.name}
                    </span>
                  </div>

                  {/* Séparateur (ne pas l'afficher après le dernier élément) */}
                  {index < path.length - 1 && (
                    <div className="div_folder_separator">
                      <span>/</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>


            <div className="div_contenue_folder">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="folder_graph"
                  id={folder.folder_id}

                  data-folder-id={folder.id || ''}
                  data-folder-name={folder.name || ''}
                  data-folder-created-at={folder.created_at || ''}
                  data-folder-updated-at={folder.updated_at || ''}
                  data-encrypted-folder-key={folder.encrypted_folder_key || ''}
                  onClick={() => {
                    console.log("Dossier cliqué :", folder);
                    // Enlever la classe 'selected_folder' de tous les dossiers
                    document.querySelectorAll('.folder_graph.selected_folder').forEach((el) => {
                      el.classList.remove('selected_folder');
                    });
                    // Ajouter la classe 'selected_folder' au dossier cliqué
                    document.getElementById(folder.folder_id).classList.add('selected_folder');
                  }}
                  onDoubleClick={() => handleFolderClick(folder.folder_id, folder.name)}
                  style={{ cursor: 'pointer' }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    opent_menu_contextual_folder(folder.folder_id, e.pageX, e.pageY);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"></path>
                  </svg>
                  <span className="folder_name">{folder.name}</span>
                </div>
              ))}

              {/* Un exemple statique si la liste est vide pour tester l'affichage */}
              {folders.length === 0 && (
                <div className="folder_graph">
                  <span>Aucun dossier dans ce répertoire.</span>
                </div>
              )}
            </div>
            <div className="div_contenue_file">
              {files.map((file) => (
                <div
                  key={file.file_id}
                  className="file_graph"
                  id={file.file_id}
                  onClick={() => handleDownload(file.file_id)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"></path></svg>
                  <span>{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}