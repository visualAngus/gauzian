<template>
  <div class="div_pannel_up_dow_load" v-if="listUploadInProgress.length > 0">
    <h3>Upload/Download Panel</h3>
      <div
        class="fichier"
        v-for="(file, index) in listUploadInProgress"
        :key="index"
      >
        <div class="div_info_up">
          <span class="nom_fichier">{{ file.name }}</span>
          <div class="div_barre">
            <div
              class="barre_progress"
              :style="{ width: (fileProgressMap[file._uploadId] || 0) + '%', transition: 'width 0.5s ease' }"
            ></div>
            <span v-if="fileProgressMap[file._uploadId] < 100" class="loading-spinner"></span>
          </div>
        </div>
        <div class="div_cancel">
          <button class="btn_cancel" @click="abort_upload(file._uploadId)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>

  <main>
    <div class="div_left_section">
      <button @click="createFolder" id="create-folder-button">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path>
        </svg>
        Nouveau dossier
      </button>
      <!-- <div class="drop-zone" :class="{ 'is-over': isOver }">
        Dépose fichiers ou dossiers
        <input
          ref="fileInput"
          type="file"
          multiple
          webkitdirectory
          class="hidden"
          @change="onNativeChange"
        />
      </div> -->
    </div>

    <div class="div_right_section">
      <!-- multiple files -->

      <div class="breadcrumb">
        <div class="breadcrumb-item" @click="gohome()">
          <svg
            class="home-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M19 21H5C4.44772 21 4 20.5523 4 20V11L1 11L11.3273 1.6115C11.7087 1.26475 12.2913 1.26475 12.6727 1.6115L23 11L20 11V20C20 20.5523 19.5523 21 19 21ZM6 19H18V9.15745L12 3.7029L6 9.15745V19Z"
            ></path>
          </svg>
          <span v-if="activeSection == 'my_drive'"> Mon Drive </span>
        </div>

        <template
          v-for="(pathItem, index) in full_path"
          :key="pathItem.folder_id"
        >
          <svg
            class="separator"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M13.1717 12.0007L8.22192 7.05093L9.63614 5.63672L16.0001 12.0007L9.63614 18.3646L8.22192 16.9504L13.1717 12.0007Z"
            ></path>
          </svg>
          <div
            class="breadcrumb-item"
            :class="{ active: index === full_path.length - 1 }"
            @click="navigateToBreadcrumb(pathItem, index)"
          >
            <span>{{
              pathItem.metadata?.folder_name || "Dossier sans nom"
            }}</span>
          </div>
        </template>
      </div>

      <div
        class="section_items"
        v-dropzone="{
          inputRef: fileInput,
          onFiles: onFilesFromDrop,
          onOverChange: setIsOver,
        }"
      >
        <TransitionGroup name="file-list" tag="div" class="file-grid">
          <!-- Fichiers uploadés -->
          <FileItem
            v-for="item in liste_decrypted_items"
            :key="'uploaded-' + (item.folder_id || item.file_id)"
            :item="item"
            status="uploaded"
            @click="click_on_item(item)"
          />

          <!-- Fichiers en attente -->
          <FileItem
            v-for="(item, index) in listToUpload"
            :key="'pending-' + item.name + '-' + index"
            :item="item"
            status="pending"
            @click="click_on_item(item)"
          />

          <!-- Fichiers en cours d'upload -->
          <FileItem
            v-for="item in listUploadInProgress"
            :key="'uploading-' + item._uploadId"
            :item="item"
            status="uploading"
            :progress="fileProgressMap[item._uploadId] || 0"
            @click="click_on_item(item)"
          />
        </TransitionGroup>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
import { watch } from "vue";
import dropzone from "~/directives/dropzone";
import FileItem from "~/components/FileItem.vue";

const vDropzone = dropzone;
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
const fileProgressMap = ref({});
const abortControllers = ref({}); // Map file_id -> AbortController

const activeFolderId = ref("root");
const liste_decrypted_items = ref([]);
const full_path = ref([]);

const displayType = ref("grid"); // 'grid' or 'list'
const activeSection = ref("my_drive"); // 'my_drive', 'shared_with_me', 'recent', 'trash'
const loadingDrive = ref(true);

const router = useRouter();

const click_on_item = (item) => {
  if (item.type === "folder") {
    // naviguer dans le dossier
    router.push(`/drive?folder_id=${item.folder_id}`);
    activeFolderId.value = item.folder_id;
  } else if (item.type === "file") {
    // télécharger le fichier
    console.log("Download file:", item.metadata?.filename || "Sans nom");
    // implémente la logique de téléchargement ici
  }
};

const navigateToBreadcrumb = (pathItem, index) => {
  console.log("Navigating to breadcrumb:", pathItem, index);
  if (index !== full_path.value.length - 1 && pathItem.folder_id) {
    router.push(`/drive?folder_id=${pathItem.folder_id}`);
    activeFolderId.value = pathItem.folder_id;
  }
};

const gohome = () => {
  router.push(`/drive?folder_id=root`);
  activeFolderId.value = "root";
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
  console.log("fileeeeeeee", file);
  console.log("folder_id", folder_id);
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

  // Créer un AbortController pour ce fichier
  const abortController = new AbortController();
  abortControllers.value[file_id] = abortController;

  // Limite le nombre d'envois simultanés pour ne pas tuer le navigateur
  // 3 à 5 est généralement un bon chiffre.
  const CONCURRENCY_LIMIT = 3;

  // Cette fonction gère l'upload d'un index précis
  const uploadChunkByIndex = async (index) => {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);

    const chunk = file.slice(start, end);

    console.log(file);

    const { cipherText, iv } = await encryptDataWithDataKey(chunk, dataKey);
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
      signal: abortController.signal, // Ajouter le signal d'annulation
    });
    if (!res.ok) {
      throw new Error(`Failed to upload chunk ${index}`);
    }
    // Met à jour la progression - Utiliser la réactivité Vue correctement
    const progress = Math.min((end / file.size) * 100, 100).toFixed(2);
    fileProgressMap.value = {
      ...fileProgressMap.value,
      [file_id]: parseFloat(progress),
    };
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
    // On lance 'CONCURRENCY_LIMIT' workers en parallèle
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, totalChunks); i++) {
      workers.push(worker());
    }

    // On attend que tous les workers aient fini
    await Promise.all(workers);

    console.log(`Finished uploading file: ${file.name}`);
  } finally {
    // Nettoyer l'AbortController
    delete abortControllers.value[file_id];
  }
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
  const fullPathData = resData.full_path;

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
        liste_decrypted_items.value.push({
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
        liste_decrypted_items.value.push({
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

  for (const pathItem of fullPathData) {
    const encryptedMetadata = pathItem.encrypted_metadata;
    const decryptkey = await decryptWithStoredPrivateKey(
      pathItem.encrypted_folder_key
    );
    const metadataStr = await decryptSimpleDataWithDataKey(
      encryptedMetadata,
      decryptkey
    );
    const metadata = JSON.parse(metadataStr);
    full_path.value.push({
      ...pathItem,
      metadata: metadata,
    });
    console.log("Full path item:", full_path.value);
  }
  loadingDrive.value = false;
};

const loadPath = async () => {
  // dans l'url ?folder_id=xxx
  const res = await fetch(
    `${API_URL}/drive/get_file_folder/${activeFolderId.value}`,
    {
      method: "GET",
      credentials: "include",
    }
  );
  if (!res.ok) {
    throw new Error("Failed to get file/folder info");
  }
  const resData = await res.json();
  const files_and_folders = resData.files_and_folders;
  const fullPathData = resData.full_path;

  const items = [
    ...(files_and_folders?.folders ?? []),
    ...(files_and_folders?.files ?? []),
  ];
  liste_decrypted_items.value = []; // reset
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
        liste_decrypted_items.value.push({
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
        liste_decrypted_items.value.push({
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

  // Mettre à jour le breadcrumb sans le vider complètement pour éviter le clignotement
  const newFullPath = [];
  for (const pathItem of fullPathData) {
    const encryptedMetadata = pathItem.encrypted_metadata;
    const decryptkey = await decryptWithStoredPrivateKey(
      pathItem.encrypted_folder_key
    );
    const metadataStr = await decryptSimpleDataWithDataKey(
      encryptedMetadata,
      decryptkey
    );
    const metadata = JSON.parse(metadataStr);
    newFullPath.push({
      ...pathItem,
      metadata: metadata,
    });
  }
  // Remplacer en une seule opération pour éviter le clignotement
  full_path.value = newFullPath;
  console.log("Full path updated:", full_path.value);
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
  // Rafraîchir la liste des fichiers/dossiers
  await loadPath();
};

const startUploads = async () => {
  while (
    listUploadInProgress.value.length < simultaneousUploads &&
    listToUpload.value.length > 0
  ) {
    const fileObject = listToUpload.value.shift();
    const file = fileObject;
    const targetFolderId = fileObject._targetFolderId || activeFolderId.value;

    listUploadInProgress.value.push(file);

    const [file_id, dataKey] = await initializeFileInDB(file, targetFolderId);

    // Initialiser la progression
    fileProgressMap.value[file_id] = 0;
    file._uploadId = file_id;
    file.status = "uploading";

    uploadFile(file, file_id, dataKey)
      .then(async () => {
        listUploadInProgress.value = listUploadInProgress.value.filter(
          (f) => f !== file
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
        }
        console.log(listUploadInProgress.value);
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
          (f) => f !== file
        );
        delete fileProgressMap.value[file_id];
        startUploads();
      });
  }
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
    (f) => f._uploadId === file_id
  );
  if (fileIndex !== -1) {
    listUploadInProgress.value.splice(fileIndex, 1);
    console.log(`Removed file from upload queue`);
  }

  // 3. Nettoyer la progression
  delete fileProgressMap.value[file_id];

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
      `Failed to notify server about aborting upload for file ID ${file_id}`
    );
    return;
  }


  setTimeout(() => {
    
      console.log(`Upload for file ID ${file_id} has been aborted.`);
  }, 100);

};

const fileInput = ref(null);
const isOver = ref(false);

const setIsOver = (state) => {
  isOver.value = state;
};

const onNativeChange = (event) => {
  const files = event.target.files;
  console.log("input files", files);
};

// Récupérer ou créer les dossiers depuis le chemin du fichier
const getOrCreateFolderHierarchy = async (
  relativePath,
  parentFolderId = "root"
) => {
  const pathParts = relativePath.split("/").slice(0, -1); // Exclure le nom du fichier

  if (pathParts.length === 0) {
    return parentFolderId; // Le fichier est à la racine
  }

  let currentParentId = parentFolderId;

  for (const folderName of pathParts) {
    // Vérifier si le dossier existe déjà
    const existingFolder = foldersList.value.find(
      (f) => f.name === folderName && f.parent_folder_id === currentParentId
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
            parent_folder_id: currentParentId,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to create folder");
        }

        const resData = await res.json();
        const newFolderId = resData.folder_id;

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

// Liste plate de tous les dossiers
const foldersList = ref([]);

const onFilesFromDrop = async (files) => {
  let someSize = 0;
  const filesToUpload = [];

  // Phase 1: Parser les fichiers et calculer la taille + créer les dossiers
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    someSize += file.size;

    // Vérifier la taille
    if (someSize > totalSpaceLeft.value - usedSpace.value) {
      alert("Not enough space left to upload these files.");
      return;
    }

    // Extraire le chemin et créer les dossiers
    if (file.webkitRelativePath) {
      const targetFolderId = await getOrCreateFolderHierarchy(
        file.webkitRelativePath,
        activeFolderId.value
      );
      filesToUpload.push({ file, targetFolderId });
    } else {
      // Fichier sans chemin, upload dans le dossier actif
      filesToUpload.push({ file, targetFolderId: activeFolderId.value });
    }
  }

  // Phase 2: Ajouter les fichiers à la liste d'upload
  for (const { file, targetFolderId } of filesToUpload) {
    // Conserver l'objet File natif pour garder size/type/lastModified
    file._targetFolderId = targetFolderId;
    file.status = "pending";
    listToUpload.value.push(file);
  }

  console.log("Dossiers créés:", foldersList.value);
  console.log("Fichiers prêts pour upload:", filesToUpload);
};
watch(
  [listToUpload, listUploadInProgress],
  () => {
    startUploads();
  },
  { deep: true }
);

// un watch sur activeFolderId pour recharger le path
watch(activeFolderId, () => {
  if (!loadingDrive.value) {
    console.log("Active folder changed to:", activeFolderId.value);
    loadPath();
  }
});
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
}
main {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 5px;
  width: 100%;
  height: calc(100vh - 128px);
}

/* quand on s'appret a drop des fichiers */

.div_left_section {
  height: 100%;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;

  flex: 0 0 200px;
}

.div_right_section {
  position: relative;
  flex: 1;

  border-radius: 25px;
  padding-left: 25px;
  padding-right: 25px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  height: 100%;
}

#create-folder-button {
  margin-bottom: 20px;
  padding: 10px 15px;
  background-color: #333333;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;

  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-left: 35px;
  margin-top: 12px;
}
#create-folder-button:hover {
  background-color: #555555;
}
#create-folder-button svg {
  width: 16px;
  height: 16px;
  fill: white;
}

.section_items {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 25px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  grid-auto-rows: 60px;
  gap: 15px;
  width: 100%;
}

.section_items.is-over {
  border: 2px dashed #548d61;
}

.section_items.is-over::after {
  content: "Déposez vos fichiers ici";
  font-weight: 800;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24px;
  color: #548d61;
  background-color: rgba(255, 255, 255, 0.8);
  padding: 10px 20px;
  border-radius: 12px;
  pointer-events: none;
}

/* Transitions pour les fichiers */
.file-list-move {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-list-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-list-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.file-list-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.breadcrumb {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  margin-bottom: 20px;
  padding: 12px 0;
}

.breadcrumb-item {
  height: 40px;
  padding: 0 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.15s ease;
  cursor: pointer;
}

.breadcrumb-item:not(.active):hover {
  background-color: #eff3f8;
}

.breadcrumb-item.active {
  cursor: default;
  color: #1f1f1f;
  font-weight: 800;
}

.breadcrumb-item span {
  font-size: 18px;
  color: #444746;
  white-space: nowrap;
  user-select: none;
}

.breadcrumb-item.active span {
  color: #1f1f1f;
  font-weight: 800;
}

.breadcrumb-item .home-icon {
  width: 22px;
  height: 22px;
  color: #444746;
}

.breadcrumb .separator {
  width: 22px;
  height: 22px;
  color: #5f6368;
  opacity: 0.6;
  flex-shrink: 0;
}

.drop-zone {
  border: 2px dashed #888;
  padding: 1.5rem;
  text-align: center;
}
.drop-zone.is-over {
  border-color: #0a8;
  background: #f3fffb;
}
.hidden {
  display: none;
}

/* div_pannel_up_dow_load */
.div_pannel_up_dow_load {
  position: fixed;
  bottom: -5px;
  left: 0;
  width: 350px;
  min-height: 50px;
  max-height: 350px;
  background-color: #333333;
  border-radius: 0 15px 0 0;

  border-bottom: 1px solid #ddd;
  z-index: 1000;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  color: white;
}

.div_pannel_up_dow_load h3 {
  padding: 10px;
}

.div_liste_fichier {
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;

  padding-bottom: 10px;
  padding-left: 10px;
}

.fichier {
  width: 100%;
  padding: 5px 0;
  border-bottom: 1px solid #555555;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}




.div_info_up {
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}

.nom_fichier {
  font-size: 14px;
  margin-bottom: 5px;
}

.div_barre {
  width: 98%;
  height: 10px;
  background-color: #555555;
  border-radius: 5px;
  overflow: hidden;
}

.barre_progress {
  height: 100%;
  background-color: #4c8eaf;
  border-radius: 5px 0 0 5px;
  transition: width 0.3s ease;
}

.div_cancel {
  height: 100%;
  margin-right: 5px;
}
.btn_cancel {
  background: none;
  border: none;
  cursor: pointer;
  color: white;

  display: flex;
  align-items: center;
  justify-content: center;
}
.btn_cancel svg {
  width: 22px;
  height: 22px;
  fill: white;
}

/* lorsque le btn est hover le svg devien rouge */
.btn_cancel:hover svg {
  fill: #ff4444;
}
</style>
