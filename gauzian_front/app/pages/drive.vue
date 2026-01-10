<template>
  <div class="page"></div>
  <main>
    <!-- multiple files -->
    <input type="file" multiple @change="handleFileChange" />
    <button @click="createFolder">Create Folder</button>

    <div class="section_items">
      <div
        v-for="(item, index) in Liste_decrypted_items"
        :key="item.type + (item.folder_id || item.file_id) + index"
        class="item"
        @click="click_on_item(item)"
      >
        <span class="icon-wrapper">
          <svg v-if="item.type === 'folder'" viewBox="0 0 24 24" fill="currentColor"><path d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"></path></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"></path></svg>
        </span>
        <span class="filename">
          {{ item.metadata?.folder_name || item.metadata?.filename || 'Sans nom' }}
        </span>
        <span class="menu-dots">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </span>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
import { watch } from "vue";
definePageMeta({
  headerTitle: "GZDRIVE",
});

import {
  getKeyStatus,
  encryptWithStoredPublicKey,
  decryptWithStoredPrivateKey,
  generateDataKey,
  encryptSimpleDataWithDataKey,
  decryptSimpleDataWithDataKey,
  encryptDataWithDataKey,
} from "~/utils/crypto";

const API_URL = "https://gauzian.pupin.fr/api";

const etat = ref("login");
const loading = ref(false);

const autologin = async () => {
  console.log("Attempting auto-login...");
  try {
    const res = await fetch(`${API_URL}/autologin`, {
      method: "GET",
      credentials: "include",
    });
    if (res.ok) {
      let is_ok = await getKeyStatus();
      if (!is_ok) {
        console.warn(
          "Keys not found or invalid in IndexedDB during auto-login."
        );
        // window.location.href = "/login";
      }
      if (is_ok) {
        console.log("Auto-login successful, keys are valid.");
        etat.value = "drive";
        get_all_info();
      }
    } else {
      console.log("No valid session found for auto-login.");
      // window.location.href = "/login";
    }
  } catch (error) {
    console.error("Auto-login failed:", error);
    // If there's a crypto error (like invalid base64), clear any corrupted data and redirect to login
    if (error.message.includes("base64") || error.message.includes("crypto")) {
      console.warn(
        "Crypto error during auto-login, clearing corrupted data and redirecting to login"
      );
      // Optionally clear IndexedDB here if needed
    }
    // window.location.href = "/login";
  }
};

autologin();

useHead({
  title: "GZDRIVE | Drive",
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap",
    },
  ],
});

// drive logic

const totalSpaceLeft = ref(3 * 1024 * 1024 * 1024); // 3 GB in bytes
const usedSpace = ref(2 * 1024 * 1024 * 1024); // 2 GB in bytes
const listToUpload = ref([]);
const listUploadInProgress = ref([]);
const listUploaded = ref([]);
const simultaneousUploads = 3;

const activeFolderId = ref("root");
const Liste_decrypted_items = ref([]);
const displayType = ref("grid"); // 'grid' or 'list'


const click_on_item = (item) => {
  if (item.type === "folder") {
    // naviguer dans le dossier
    window.location.href = `/drive?folder_id=${item.folder_id}`;
  } else if (item.type === "file") {
    // télécharger le fichier
    console.log("Download file:", item.metadata?.filename || "Sans nom");
    // implémente la logique de téléchargement ici
  }
};

const formatBytes = (bytes) => {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
};

const handleFileChange = async (event) => {
  const files = event.target.files;
  var someSize = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    someSize += file.size;
    listToUpload.value.push(file);
  }
  if (someSize > totalSpaceLeft.value - usedSpace.value) {
    alert("Not enough space left to upload these files.");
    return;
  }
};

const initializeFileInDB = async (file, folder_id) => {
  const dataKey = await generateDataKey();
  const encryptedFileKey = await encryptWithStoredPublicKey(dataKey);
  console.log(file);
  const metadata = {
    filename: file.name,
    size: file.size,
    mime_type: file.type,
    last_modified: file.lastModified,
  };

  const stringifiedMetadata = JSON.stringify(metadata);
  console.log("Stringified Metadata:", stringifiedMetadata);

  const encryptedMetadata = await encryptSimpleDataWithDataKey(
    stringifiedMetadata,
    dataKey
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
  return [resData.file_id, dataKey];
};

const uploadFile = async (file, file_id, dataKey) => {
  const chunkSize = 1 * 1024 * 1024; // 1 MB (réduit pour éviter stack overflow)
  const totalChunks = Math.ceil(file.size / chunkSize);

  // Limite le nombre d'envois simultanés pour ne pas tuer le navigateur
  // 3 à 5 est généralement un bon chiffre.
  const CONCURRENCY_LIMIT = 3;

  // Cette fonction gère l'upload d'un index précis
  const uploadChunkByIndex = async (index) => {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);

    const chunk = file.slice(start, end);

    const { cipherText, iv } = await encryptDataWithDataKey(chunk, dataKey);
    console.log(cipherText, iv);
    // envoi du chunk au backend
    const body = {
      file_id: file_id,
      index: index,
      chunk_data: cipherText,
      iv: iv,
    };
    const res = await fetch(`${API_URL}/drive/upload_chunk`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Failed to upload chunk ${index}`);
    }
    console.log(
      `Uploaded chunk ${index + 1}/${totalChunks} for file ${file.name}`
    );
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
        console.error(`Echec chunk ${index}`, err);
        // Optionnel : remettre dans la queue pour réessayer
        // queue.push(index);
      }
    }
  };

  // On lance 'CONCURRENCY_LIMIT' workers en parallèle
  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, totalChunks); i++) {
    workers.push(worker());
  }

  // On attend que tous les workers aient fini
  await Promise.all(workers);

  console.log(`Finished uploading file: ${file.name}`);
};

// use effect on listToUpload to start upload

const get_all_info = async () => {
  console.log("Fetching all drive info...");

  // dans l'url ?folder_id=xxx
  const urlParams = new URLSearchParams(window.location.search);
  const id_parent_folder = urlParams.get("folder_id") || "root";

  activeFolderId.value = id_parent_folder;

  const res = await fetch(
    `${API_URL}/drive/get_all_drive_info/${id_parent_folder}`,
    {
      method: "GET",
      credentials: "include",
    }
  );
  if (!res.ok) {
    throw new Error("Failed to get all drive info");
  }
  const resData = await res.json();
  const drive_info = resData.drive_info;
  const files_and_folders = resData.files_and_folders;
  const user_info = resData.user_info;

  const items = [
    ...(files_and_folders?.folders ?? []),
    ...(files_and_folders?.files ?? []),
  ];

  for (const item of items) {
    if (item.type === "file") {
      try {
        const encryptedMetadata = item.encrypted_metadata;
        const decryptkey = await decryptWithStoredPrivateKey(
          item.encrypted_file_key
        );
        const metadataStr = await decryptSimpleDataWithDataKey(
          encryptedMetadata,
          decryptkey
        );
        const metadata = JSON.parse(metadataStr);
        Liste_decrypted_items.value.push({
          ...item,
          metadata: metadata,
        });
      } catch (err) {
        console.error(
          "Failed to decrypt metadata for file:",
          item.file_id,
          err
        );
      }
    } else if (item.type === "folder") {
      try {
        const encryptedMetadata = item.encrypted_metadata;
        const decryptkey = await decryptWithStoredPrivateKey(
          item.encrypted_folder_key
        );
        const metadataStr = await decryptSimpleDataWithDataKey(
          encryptedMetadata,
          decryptkey
        );
        const metadata = JSON.parse(metadataStr);
        Liste_decrypted_items.value.push({
          ...item,
          metadata: metadata,
        });
      } catch (err) {
        console.error(
          "Failed to decrypt metadata for folder:",
          item.folder_id,
          err
        );
      }
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
    dataKey
  );
  const res = await fetch(`${API_URL}/drive/create_folder`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
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
  // Optionnel : rafraîchir la liste des fichiers/dossiers
};

const startUploads = async () => {
  while (
    listUploadInProgress.value.length < simultaneousUploads &&
    listToUpload.value.length > 0
  ) {
    const file = listToUpload.value.shift();
    listUploadInProgress.value.push(file);

    const [file_id, dataKey] = await initializeFileInDB(file, null);

    uploadFile(file, file_id, dataKey).then(() => {
      listUploadInProgress.value = listUploadInProgress.value.filter(
        (f) => f !== file
      );
      listUploaded.value.push(file);
      startUploads();
    });
  }
};

watch(
  [listToUpload, listUploadInProgress],
  () => {
    startUploads();
  },
  { deep: true }
);
</script>

<style>

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
}

body {
  font-family: "Roboto", "Segoe UI", sans-serif; /* Police style Google */
  background-color: #fff;
  padding: 20px;
}

.section_items {
  /* Utilisation de Grid pour un alignement responsive comme le Drive */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 15px;
  width: 100%;
  max-width: 1200px;
}

.item {
  /* Dimensions et forme */
  height: 48px;
  border-radius: 12px; /* Les coins arrondis typiques de Material 3 */
  background-color: #eff3f8; /* La couleur exacte bleu/gris clair de Drive */

  /* Flexbox pour aligner icone - texte - menu */
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 12px;

  /* Transition douce pour le survol */
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  user-select: none; /* Empêche de sélectionner le texte comme du Word */
}

/* Effet au survol de la souris */
.item:hover {
  background-color: #e2e7ed; /* Un peu plus sombre au survol */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Gestion des icônes principales (Dossier/Fichier) */
.item .icon-wrapper svg {
  width: 20px;
  height: 20px;
  color: #444746; /* Gris foncé Google */
  margin-right: 12px;
  flex-shrink: 0; /* Empêche l'icône de s'écraser */
}

/* Le texte (Nom du fichier) */
.item .filename {
  flex-grow: 1; /* Prend toute la place disponible au milieu */
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f; /* Noir doux */
  text-decoration: none;

  /* Coupe le texte avec "..." si le nom est trop long */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Les trois petits points à droite */
.item .menu-dots {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  margin-left: 8px;
}

.item .menu-dots svg {
  width: 18px;
  height: 18px;
  color: #444746;
  transform: rotate(90deg);
}

.item .menu-dots:hover {
  background-color: rgba(0, 0, 0, 0.08);
}
</style>
