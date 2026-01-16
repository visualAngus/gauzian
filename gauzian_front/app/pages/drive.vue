<template>
  <div id="div_pannel_right_click" ref="rightClickPanel">
    <a
      @click="createFolder()"
      v-if="rightClikedItem?.dataset?.itemType === 'folder'"
      >Nouveau dossier</a
    >
    <a
      @click="downloadItem(rightClikedItem)"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder')
      "
      >Télécharger</a
    >
    <a
      @click="renameItem(rightClikedItem)"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder')
      "
      >Renommer</a
    >
    <a
      @click="deleteItem(rightClikedItem)"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder')
      "
      >Supprimer</a
    >
  </div>

  <!-- Panneau Upload/Download moderne -->
  <div class="transfer-panel" v-if="listUploadInProgress.length > 0 || listDownloadInProgress.length > 0">
    <div class="transfer-header">
      <div class="transfer-title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L16 6H13V12H11V6H8L12 2ZM2 20H22V22H2V20ZM13 16H11V14H13V16Z"/>
        </svg>
        <span>Transferts ({{ listToUpload.length + listUploadInProgress.length + listDownloadInProgress.length }})</span>
      </div>
      <div class="transfer-actions">
        <button class="btn-action" @click="pauseAllTransfers" v-if="!allTransfersPaused" title="Tout mettre en pause">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z"/>
          </svg>
        </button>
        <button class="btn-action" @click="resumeAllTransfers" v-else title="Tout reprendre">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5V19L17 12L7 5Z"/>
          </svg>
        </button>
        <button class="btn-action btn-danger" @click="cancelAllTransfers" title="Tout annuler">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 10.5858L9.17157 7.75736L7.75736 9.17157L10.5858 12L7.75736 14.8284L9.17157 16.2426L12 13.4142L14.8284 16.2426L16.2426 14.8284L13.4142 12L16.2426 9.17157L14.8284 7.75736L12 10.5858Z"/>
          </svg>
        </button>
        <button class="btn-collapse" @click="togglePanelCollapse">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" :class="{ rotated: isPanelCollapsed }">
            <path d="M12 13.1716L16.9497 8.22186L18.3639 9.63607L12 16L5.63604 9.63607L7.05025 8.22186L12 13.1716Z"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div class="transfer-list" v-show="!isPanelCollapsed">
      <!-- Uploads -->
      <div class="transfer-item" v-for="file in listUploadInProgress" :key="file._uploadId">
        <div class="transfer-icon upload-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12.5858L16.2426 16.8284L14.8284 18.2426L13 16.4142V22H11V16.4142L9.17157 18.2426L7.75736 16.8284L12 12.5858ZM12 2C15.5934 2 18.5544 4.70761 18.9541 8.19395C21.2858 8.83154 23 10.9656 23 13.5C23 16.5376 20.5376 19 17.5 19H17V17H17.5C19.433 17 21 15.433 21 13.5C21 11.567 19.433 10 17.5 10C17.2912 10 17.0867 10.0183 16.8887 10.054C16.9616 9.7142 17 9.36158 17 9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9C7 9.36158 7.03838 9.7142 7.11205 10.0533C6.91331 10.0183 6.70879 10 6.5 10C4.567 10 3 11.567 3 13.5C3 15.433 4.567 17 6.5 17H7V19H6.5C3.46243 19 1 16.5376 1 13.5C1 10.9656 2.71424 8.83154 5.04648 8.19411C5.44561 4.70761 8.40661 2 12 2Z"/>
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">{{ file.name }}</div>
          <div class="transfer-details">
            <span class="progress-text">{{ Math.round(fileProgressMap[file._uploadId] || 0) }}%</span>
            <span class="transfer-status">{{ getTransferStatus(file._uploadId, 'upload') }}</span>
            <span class="transfer-speed">{{ formatSpeed(transferSpeeds[file._uploadId]) }}</span>
            <span class="transfer-eta" v-if="transferETAs[file._uploadId]">{{ formatETA(transferETAs[file._uploadId]) }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill upload-progress" :style="{ width: (fileProgressMap[file._uploadId] || 0) + '%' }"></div>
          </div>
        </div>
        <div class="transfer-controls">
          <button class="btn-control" @click="togglePauseTransfer(file._uploadId, 'upload')" v-if="!isPaused(file._uploadId)" title="Pause">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z"/>
            </svg>
          </button>
          <button class="btn-control" @click="togglePauseTransfer(file._uploadId, 'upload')" v-else title="Reprendre">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5V19L17 12L7 5Z"/>
            </svg>
          </button>
          <button class="btn-control btn-cancel" @click="abort_upload(file._uploadId)" title="Annuler">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Downloads -->
      <div class="transfer-item" v-for="file in listDownloadInProgress" :key="file._downloadId">
        <div class="transfer-icon download-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 10H18L12 16L6 10H11V3H13V10ZM4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19Z"/>
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">{{ file.name }}</div>
          <div class="transfer-details">
            <span class="transfer-status">{{ getTransferStatus(file._downloadId, 'download') }}</span>
            <span class="progress-text">{{ Math.round(downloadProgressMap[file._downloadId] || 0) }}%</span>
            <span class="transfer-speed">{{ formatSpeed(transferSpeeds[file._downloadId]) }}</span>
            <span class="transfer-eta" v-if="transferETAs[file._downloadId]">{{ formatETA(transferETAs[file._downloadId]) }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill download-progress" :style="{ width: (downloadProgressMap[file._downloadId] || 0) + '%' }"></div>
          </div>
        </div>
        <div class="transfer-controls">
          <button class="btn-control" @click="togglePauseTransfer(file._downloadId, 'download')" v-if="!isPaused(file._downloadId)" title="Pause">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z"/>
            </svg>
          </button>
          <button class="btn-control" @click="togglePauseTransfer(file._downloadId, 'download')" v-else title="Reprendre">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5V19L17 12L7 5Z"/>
            </svg>
          </button>
          <button class="btn-control btn-cancel" @click="cancelDownload(file._downloadId)" title="Annuler">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"/>
            </svg>
          </button>
        </div>
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

      <div class="div_treeview">
        <FolderTreeNode
          :node="folderTree"
          :active-id="activeFolderId"
          @select="selectFolderFromTree"
          @toggle="toggleFolderNode"
          @context-menu="handleTreeContextMenu"
        />
      </div>

      <div class="div_utilisation_storage">
        <h4>Utilisation du stockage</h4>
        <div class="storage-bar">
          <div
            class="used-space"
            :style="{
              width: ((usedSpace / (maxspace)) * 100) + '%',
            }"
          ></div>
        </div>
        <div class="storage-info">
          <span>{{ formatBytes(usedSpace) }} utilisés</span>
          <span>{{ formatBytes(totalSpaceLeft) }} libres</span>
        </div>
      </div>

    </div>

    <div class="div_right_section">
      <!-- multiple files -->

      <div class="breadcrumb">
        <div class="breadcrumb-item" :data-item-id="'root'" @click="gohome()">
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
            :data-item-id="pathItem.folder_id"
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
        @click.self="clearSelection"
        v-dropzone="{
          inputRef: fileInput,
          onFiles: onFilesFromDrop,
          onOverChange: setIsOver,
        }"
      >
        <TransitionGroup
          name="file-list"
          tag="div"
          class="file-grid"
          @click.self="clearSelection"
          @after-leave="onFileListAfterLeave"
        >
          <!-- Fichiers uploadés -->
          <FileItem
            v-for="item in displayedDriveItems"
            :key="
              'uploaded-' + item.type + '-' + (item.folder_id || item.file_id)
            "
            :item="item"
            status="uploaded"
            data-item-group="drive"
            @click="click_on_item(item, $event)"
            @move-start="handleDragStart"
            @moving="handleDragMove"
            @move-end="handleDragEnd"
            @select="({ item, event }) => selectItem(item, event)"
            @dotclick="openItemMenu(item)"
          />

          <!-- Fichiers en attente et en cours d'upload (avec clé stable) -->
          <FileItem
            v-for="item in pendingAndUploadingFiles"
            :key="item._uniqueId"
            :item="item"
            :status="item._status"
            :progress="item._progress"
            data-item-group="queue"
            @click="click_on_item(item)"
            @move-start="handleDragStart"
            @moving="handleDragMove"
            @move-end="handleDragEnd"
            @select="({ item, event }) => selectItem(item, event)"
          />
        </TransitionGroup>
      </div>
    </div>
  </main>

  <!-- Élément de drag qui suit la souris -->
  <div v-if="isDragging && activeItem" class="drag-ghost" :style="ghostStyle">
    <span class="icon-wrapper">
      <svg
        v-if="activeItem.type === 'folder'"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"
        ></path>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"
        ></path>
      </svg>
    </span>
    <span class="drag-label">
      {{
        activeItem.metadata?.folder_name ||
        activeItem.metadata?.filename ||
        "Item"
      }}
      <span v-if="draggedItems.length > 1" class="drag-count">+{{ draggedItems.length - 1 }}</span>
    </span>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useHead } from "#imports"; // Nécessaire si tu es sous Nuxt, sinon à retirer
import dropzone from "~/directives/dropzone";
import FileItem from "~/components/FileItem.vue";
import FolderTreeNode from "~/components/FolderTreeNode.vue";
import JSZip from "jszip";

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

const usedSpace = ref(0); // 2 GB in bytes
const maxspace = ref(3 * 1024 * 1024 * 1024); // 3 GB in bytes
const totalSpaceLeft = ref(maxspace.value - usedSpace.value);
const listToUpload = ref([]);
const listUploadInProgress = ref([]);
const listUploaded = ref([]);
const simultaneousUploads = 3;
const fileProgressMap = ref({});
const abortControllers = ref({}); // Map file_id -> AbortController
const downloadAbortControllers = ref({}); // Map download_id -> AbortController pour les downloads
let fileIdCounter = 0; // Compteur pour générer des IDs uniques
const rightClikedItem = ref(null);

const selectedItems = ref(new Set()); // Set des items sélectionnés (par id)
const selectedItemsMap = ref(new Map()); // Map id -> item pour récupérer les données

const folderTree = ref({
  folder_id: "root",
  metadata: { folder_name: "Mon Drive" },
  children: [],
  isExpanded: true,
  isLoaded: false,
  isLoading: false,
  parent_folder_id: null,
});

// Computed property pour combiner les fichiers en attente et en cours d'upload
const pendingAndUploadingFiles = computed(() => {
  return [
    ...listToUpload.value
      .filter(
        (file) => (file._targetFolderId || "root") === activeFolderId.value
      )
      .map((file) => ({
        ...file,
        _status: "pending",
        _name: file.name,
        _progress: 0,
      })),
    ...listUploadInProgress.value
      .filter(
        (file) => (file._targetFolderId || "root") === activeFolderId.value
      )
      .map((file) => ({
        ...file,
        _status: "uploading",
        _name: file.name,
        _progress: fileProgressMap.value[file._uploadId] || 0,
      })),
    ...listUploaded.value
      .filter(
        (file) => (file._targetFolderId || "root") === activeFolderId.value
      )
      .map((file) => ({
        ...file,
        _status: "uploaded",
        _name: file.name,
        _progress: 100,
      })),
  ];
});

const activeFolderId = ref("root");
const liste_decrypted_items = ref([]);
const displayedDriveItems = ref([]);
const full_path = ref([]);

// On garde les updates "diff" pour un refresh dans le même dossier,
// mais on fait un vrai "out -> in" lors de la navigation (changement de dossier).
const driveListTransition = ref({
  leaving: false,
  pendingLeaves: 0,
});
let queuedDriveItems = null;

const flushQueuedDriveItems = async () => {
  if (!queuedDriveItems) {
    driveListTransition.value.leaving = false;
    return;
  }

  const nextItems = queuedDriveItems;
  queuedDriveItems = null;
  driveListTransition.value.leaving = false;

  // Laisse Vue finaliser le retrait avant de ré-insérer.
  await nextTick();
  displayedDriveItems.value = [...nextItems];
};

const applyDriveItemsForDisplay = async (items, { outIn = false } = {}) => {
  liste_decrypted_items.value = items;

  // Update standard: Vue/TransitionGroup fait le diff via les keys.
  if (!outIn) {
    displayedDriveItems.value = [...items];
    return;
  }

  // Out->in: on attend que tous les anciens items aient fini de sortir.
  queuedDriveItems = items;

  // Si rien n'est affiché, on affiche directement.
  if (
    displayedDriveItems.value.length === 0 &&
    !driveListTransition.value.leaving
  ) {
    displayedDriveItems.value = [...items];
    queuedDriveItems = null;
    return;
  }

  // Si une transition de suppression est déjà en cours, on garde juste la dernière liste demandée.
  if (driveListTransition.value.leaving) {
    return;
  }

  driveListTransition.value.leaving = true;
  driveListTransition.value.pendingLeaves = displayedDriveItems.value.length;
  displayedDriveItems.value = [];

  // Sécurité : si aucune transition n'est jouée, on flush quand même.
  await nextTick();
  if (driveListTransition.value.pendingLeaves === 0) {
    await flushQueuedDriveItems();
  }
};

const onFileListAfterLeave = async (el) => {
  // Le TransitionGroup contient aussi les items "queue" (pending/uploading).
  if (el?.dataset?.itemGroup !== "drive") return;
  if (!driveListTransition.value.leaving) return;

  driveListTransition.value.pendingLeaves = Math.max(
    0,
    driveListTransition.value.pendingLeaves - 1
  );

  if (driveListTransition.value.pendingLeaves === 0) {
    await flushQueuedDriveItems();
  }
};

const displayType = ref("grid"); // 'grid' or 'list'
const activeSection = ref("my_drive"); // 'my_drive', 'shared_with_me', 'recent', 'trash'
const loadingDrive = ref(true);

const router = useRouter();

const decryptFolderMetadata = async (folder) => {
  const encryptedMetadata = folder.encrypted_metadata;
  const decryptkey = await decryptWithStoredPrivateKey(
    folder.encrypted_folder_key
  );
  const metadataStr = await decryptSimpleDataWithDataKey(
    encryptedMetadata,
    decryptkey
  );
  const metadata = JSON.parse(metadataStr);
  metadata.encrypted_data_key = folder.encrypted_folder_key;
  return metadata;
};

const loadTreeNode = async (node, preserveExpanded = false) => {
  if (!node) return;
  node.isLoading = true;

  try {
    const res = await fetch(
      `${API_URL}/drive/get_folder/${node.folder_id}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!res.ok) {
      throw new Error("Failed to get folder content for tree");
    }

    const resData = await res.json();
    const folders = resData.folder_contents.filter(
      (item) => item.type === "folder"
    );
    const childrenNodes = [];

    for (const folder of folders) {
      try {
        const metadata = await decryptFolderMetadata(folder);
        
        // Chercher si ce nœud existe déjà pour préserver son état
        const existingChild = node.children?.find(
          (child) => child.folder_id === folder.folder_id
        );

        childrenNodes.push({
          ...folder,
          metadata,
          children: existingChild?.children || [],
          isExpanded: preserveExpanded ? existingChild?.isExpanded || false : false,
          isLoaded: existingChild?.isLoaded || false,
          isLoading: false,
          parent_folder_id: node.folder_id,
        });
      } catch (error) {
        console.error(
          "Failed to decrypt metadata for tree folder:",
          folder.folder_id,
          error
        );
      }
    }

    node.children = childrenNodes;
    node.isLoaded = true;
  } catch (error) {
    console.error("Failed to load folder tree node:", node.folder_id, error);
  } finally {
    node.isLoading = false;
  }
};

const findNodeById = (node, id) => {
  if (!node) return null;
  if (node.folder_id === id) return node;
  if (!node.children) return null;

  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
};

const refreshTreeNode = async (folderId) => {
  const targetNode = findNodeById(folderTree.value, folderId);
  if (!targetNode) return;
  targetNode.isLoaded = false;
  // Passer true pour préserver l'état isExpanded des enfants
  await loadTreeNode(targetNode, true);
  targetNode.isExpanded = true;
};

const expandTreeToCurrentPath = async () => {
  if (!folderTree.value) return;

  let currentNode = folderTree.value;
  currentNode.isExpanded = true;

  if (!currentNode.isLoaded) {
    await loadTreeNode(currentNode);
  }

  for (const pathItem of full_path.value) {
    const targetId = pathItem.folder_id;
    if (!targetId) continue;

    let childNode =
      currentNode.children?.find((child) => child.folder_id === targetId) ||
      null;

    if (!childNode) {
      await loadTreeNode(currentNode);
      childNode =
        currentNode.children?.find((child) => child.folder_id === targetId) ||
        null;
    }

    if (!childNode) {
      break;
    }

    childNode.isExpanded = true;

    if (!childNode.isLoaded) {
      await loadTreeNode(childNode);
    }

    currentNode = childNode;
  }
};

const toggleFolderNode = async (node) => {
  node.isExpanded = !node.isExpanded;
  if (node.isExpanded && !node.isLoaded) {
    await loadTreeNode(node);
  }
};

const selectFolderFromTree = async (node) => {
  if (!node || !node.folder_id) return;
  activeFolderId.value = node.folder_id;
  router.push(`/drive?folder_id=${node.folder_id}`);
};

onMounted(async () => {
  await loadTreeNode(folderTree.value);
  await expandTreeToCurrentPath();
});

const click_on_item = (item, event) => {
  console.log("Item event:", item, event);
  if (item.type === "folder") {
    // naviguer dans le dossier
    router.push(`/drive?folder_id=${item.folder_id}`);
    activeFolderId.value = item.folder_id;
  } else if (item.type === "file") {
    // télécharger le fichier
    downloadFile(item);
  }
};

const listDownloadInProgress = ref([]);
const downloadProgressMap = ref({});
const transferSpeeds = ref({});
const transferETAs = ref({});
const pausedTransfers = ref(new Set());
const allTransfersPaused = ref(false);
const isPanelCollapsed = ref(false);
const transferStartTimes = ref({});
const transferLastProgress = ref({});
const transferLastUpdate = ref({});

const updateTransferStats = (transferId, progress, totalSize) => {
  const now = Date.now();
  
  if (!transferStartTimes.value[transferId]) {
    transferStartTimes.value[transferId] = now;
    transferLastProgress.value[transferId] = 0;
    transferLastUpdate.value[transferId] = now;
    return;
  }
  
  const timeDiff = (now - transferLastUpdate.value[transferId]) / 1000; // en secondes
  
  if (timeDiff > 0.5) { // Mise à jour toutes les 0.5 secondes
    const progressDiff = progress - (transferLastProgress.value[transferId] || 0);
    const bytesPerSecond = (totalSize * progressDiff / 100) / timeDiff;
    
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

const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond === 0) return '';
  const sizes = ['o/s', 'Ko/s', 'Mo/s', 'Go/s'];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return (bytesPerSecond / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
};

const formatETA = (seconds) => {
  if (!seconds || seconds === Infinity) return '';
  if (seconds < 60) return Math.round(seconds) + 's restantes';
  if (seconds < 3600) return Math.round(seconds / 60) + 'min restantes';
  return Math.round(seconds / 3600) + 'h restantes';
};

const getTransferStatus = (transferId, type) => {
  if (pausedTransfers.value.has(transferId)) return 'En pause';
  const progress = type === 'upload' ? fileProgressMap.value[transferId] : downloadProgressMap.value[transferId];
  if (progress >= 100) return 'Terminé';
  if (progress > 0) return 'En cours';
  return 'En attente';
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

const pauseAllTransfers = () => {
  allTransfersPaused.value = true;
  listUploadInProgress.value.forEach(file => pausedTransfers.value.add(file._uploadId));
  listDownloadInProgress.value.forEach(file => pausedTransfers.value.add(file._downloadId));
};

const resumeAllTransfers = () => {
  allTransfersPaused.value = false;
  pausedTransfers.value.clear();
};

const cancelAllTransfers = () => {
  if (confirm('Voulez-vous vraiment annuler tous les transferts en cours ?')) {
    [...listUploadInProgress.value].forEach(file => abort_upload(file._uploadId));
    [...listDownloadInProgress.value].forEach(file => cancelDownload(file._downloadId));
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
    d => d._downloadId !== downloadId
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
      signal: abortController.signal, // Ajouter le signal d'annulation
    });

    if (!fileInfoRes.ok) {
      throw new Error("Failed to fetch file info");
    }

    const fileInfo = await fileInfoRes.json();
    
    // Déchiffrer la clé du fichier
    const dataKey = await decryptWithStoredPrivateKey(fileInfo.encrypted_file_key);
    
    // Déchiffrer les métadonnées
    const decryptedMetadataStr = await decryptSimpleDataWithDataKey(
      fileInfo.encrypted_metadata,
      dataKey
    );
    const metadata = JSON.parse(decryptedMetadataStr);

    const chunks = fileInfo.chunks || [];
    const totalChunks = chunks.length;
    
    console.log(`Downloading ${totalChunks} chunks for file: ${metadata.filename}`);

    // Utiliser File System Access API si disponible, sinon accumuler en mémoire
    let fileHandle;
    let writable;
    let decryptedChunks = [];

    // Essayer d'utiliser l'API File System Access
    if ('showSaveFilePicker' in window) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: metadata.filename || filename,
          types: [{
            description: 'File',
            accept: { [metadata.mime_type || 'application/octet-stream']: [] },
          }],
        });
        writable = await fileHandle.createWritable();
      } catch (err) {
        console.log("User cancelled save dialog or API not available, falling back to memory");
      }
    }

    // Télécharger et déchiffrer chunk par chunk
    for (let i = 0; i < chunks.length; i++) {
      // Vérifier si en pause
      while (isPaused(downloadId)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const chunk = chunks[i];
      console.log(`Downloading chunk ${i + 1}/${totalChunks}`);

      // Télécharger le chunk
      const chunkRes = await fetch(`${API_URL}/drive/download_chunk/${chunk.s3_key}`, {
        method: "GET",
        credentials: "include",
        signal: abortController.signal, // Ajouter le signal d'annulation
      });

      if (!chunkRes.ok) {
        throw new Error(`Failed to download chunk ${i}`);
      }

      const chunkData = await chunkRes.json();
      
      // Déchiffrer le chunk
      const decryptedChunk = await decryptDataWithDataKey(
        chunkData.data,
        chunkData.iv,
        dataKey
      );

      // Écrire dans le fichier ou accumuler en mémoire
      if (writable) {
        await writable.write(decryptedChunk);
      } else {
        decryptedChunks.push(decryptedChunk);
      }

      // Mettre à jour la progression
      const progress = ((i + 1) / totalChunks) * 100;
      downloadProgressMap.value[downloadId] = progress;
      updateTransferStats(downloadId, progress, metadata.size);
    }

    // Finaliser l'écriture
    if (writable) {
      await writable.close();
      console.log("File written successfully using File System Access API");
    } else {
      // Créer un blob à partir des chunks et déclencher le téléchargement
      const blob = new Blob(decryptedChunks, { type: metadata.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = metadata.filename || filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Libérer la mémoire
      URL.revokeObjectURL(url);
    }

    console.log("Download completed successfully");
    
    // Nettoyer l'AbortController
    delete downloadAbortControllers.value[downloadId];
    
    // Retirer de la liste des téléchargements
    listDownloadInProgress.value = listDownloadInProgress.value.filter(
      d => d._downloadId !== downloadId
    );
    delete downloadProgressMap.value[downloadId];
    delete transferSpeeds.value[downloadId];
    delete transferETAs.value[downloadId];
    
  } catch (error) {
    console.error("Error downloading file:", error);
    
    // Ne pas afficher d'alerte si l'erreur est due à un abort
    if (error.name !== 'AbortError') {
      alert(`Erreur lors du téléchargement: ${error.message}`);
    }
    
    // Nettoyer l'AbortController
    delete downloadAbortControllers.value[downloadId];
    
    // Retirer de la liste des téléchargements en cas d'erreur
    listDownloadInProgress.value = listDownloadInProgress.value.filter(
      d => d._downloadId !== downloadId
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
  
  if (itemType === 'file') {
    // Télécharger un fichier unique
    const item = liste_decrypted_items.value.find(i => i.file_id === itemId);
    if (item) {
      downloadFile(item);
    }
  } else if (itemType === 'folder') {
    // Télécharger un dossier avec tout son contenu en ZIP
    downloadFolderAsZip(itemId, element.dataset.folderName);
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
    const contentsRes = await fetch(`${API_URL}/drive/folder_contents/${folderId}`, {
      method: "GET",
      credentials: "include",
      signal: abortController.signal, // Ajouter le signal d'annulation
    });

    if (!contentsRes.ok) {
      throw new Error("Failed to fetch folder contents");
    }

    const { contents } = await contentsRes.json();
    console.log(`Retrieved ${contents.length} items from folder`);

    // Créer un ZIP
    const zip = new JSZip();
    
    // Calculer le nombre total de chunks pour la progression précise
    const totalChunks = contents.reduce((sum, item) => {
      if (item.type === 'file') {
        return sum + (item.chunks?.length || 0);
      }
      return sum;
    }, 0);
    let processedChunks = 0;

    // Traiter chaque fichier
    for (const item of contents) {
      if (item.type === 'file') {
        try {
          // Déchiffrer la clé du fichier
          const dataKey = await decryptWithStoredPrivateKey(item.encrypted_file_key);
          
          // Déchiffrer les métadonnées
          const decryptedMetadataStr = await decryptSimpleDataWithDataKey(
            item.encrypted_metadata,
            dataKey
          );
          const metadata = JSON.parse(decryptedMetadataStr);
          
          // Télécharger et déchiffrer tous les chunks du fichier
          const decryptedChunks = [];
          for (let i = 0; i < item.chunks.length; i++) {
            // Vérifier si en pause
            while (isPaused(downloadId)) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const chunk = item.chunks[i];
            const chunkRes = await fetch(`${API_URL}/drive/download_chunk/${chunk.s3_key}`, {
              method: "GET",
              credentials: "include",
              signal: abortController.signal, // Ajouter le signal d'annulation
            });

            if (!chunkRes.ok) {
              throw new Error(`Failed to download chunk for file ${metadata.filename}`);
            }

            const chunkData = await chunkRes.json();
            const decryptedChunk = await decryptDataWithDataKey(
              chunkData.data,
              chunkData.iv,
              dataKey
            );
            decryptedChunks.push(decryptedChunk);
            
            // Mettre à jour la progression après chaque chunk
            processedChunks++;
            const progress = (processedChunks / totalChunks) * 100;
            downloadProgressMap.value[downloadId] = progress;
            updateTransferStats(downloadId, progress, totalChunks * 1024 * 1024); // Estimation de la taille
          }

          // Ajouter le fichier au ZIP
          const fileBlob = new Blob(decryptedChunks, { type: item.mime_type });
          zip.file(`${item.path}${metadata.filename}`, fileBlob);
          
          console.log(`Added file: ${metadata.filename} (${processedChunks}/${totalChunks} chunks)`);
        } catch (fileError) {
          console.error("Error processing file:", fileError);
        }
      }
    }

    // Générer le ZIP et le télécharger
    console.log("Generating ZIP file...");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
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
      d => d._downloadId !== downloadId
    );
    delete downloadProgressMap.value[downloadId];
    delete transferSpeeds.value[downloadId];
    delete transferETAs.value[downloadId];
    
  } catch (error) {
    console.error("Error downloading folder as ZIP:", error);
    
    // Ne pas afficher d'alerte si l'erreur est due à un abort
    if (error.name !== 'AbortError') {
      alert(`Erreur lors du téléchargement: ${error.message}`);
    }
    
    // Nettoyer l'AbortController
    delete downloadAbortControllers.value[downloadId];
    
    // Retirer de la liste des téléchargements en cas d'erreur
    listDownloadInProgress.value = listDownloadInProgress.value.filter(
      d => d._downloadId !== downloadId
    );
    delete downloadProgressMap.value[downloadId];
    delete transferSpeeds.value[downloadId];
    delete transferETAs.value[downloadId];
  }
}

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
  const sizes = ["octets", "Ko", "Mo", "Go", "To"];
  if (bytes === 0) return "0 octet";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};

// const handleFileChange = async (event) => {
//   const files = event.target.files;
//   var someSize = 0;
//   for (let i = 0; i < files.length; i++) {
//     const file = files[i];
//     someSize += file.size;
//     // Assigner un ID unique dès l'ajout
//     file._uniqueId = `file-${Date.now()}-${fileIdCounter++}`;
//     file._targetFolderId = activeFolderId.value; // Assigner le dossier cible
//     listToUpload.value.push(file);
//   }
//   if (someSize > totalSpaceLeft.value - usedSpace.value) {
//     alert("Not enough space left to upload these files.");
//     return;
//   }
// };

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
    // Vérifier si l'upload est en pause
    while (isPaused(file_id)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);

    const chunk = file.slice(start, end);

    // console.log(file);

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
    
    // Mise à jour des stats de transfert
    updateTransferStats(file_id, parseFloat(progress), file.size);

    // Petit délai pour éviter le rate limiting (50ms entre chaque chunk)
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

    const req = await fetch(`${API_URL}/drive/finalize_upload/${file_id}/${etat}`, {
      method: "POST",
      credentials: "include",
    });
    if (!req.ok) {
      throw new Error("Failed to finalize file upload");
    }
  } catch (error) {
    const req = await fetch(`${API_URL}/drive/finalize_upload/${file_id}/aborted`, {
      method: "POST",
      credentials: "include",
    });
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

  usedSpace.value = drive_info.used_space;

  full_path.value = [];

  // Reset des placeholders "uploaded" pour ce dossier pour éviter les doublons
  listUploaded.value = listUploaded.value.filter(
    (file) => (file._targetFolderId || "root") !== activeFolderId.value
  );

  const items = [
    ...(files_and_folders?.folders ?? []),
    ...(files_and_folders?.files ?? []),
  ];

  const decryptedItems = [];
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
        // rajouter dans les metatdata l'encrypted_data_key pour les futurs téléchargements
        metadata.encrypted_data_key = item.encrypted_file_key;
        decryptedItems.push({
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
        metadata.encrypted_data_key = item.encrypted_folder_key;
        decryptedItems.push({
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

  applyDriveItemsForDisplay(decryptedItems);

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

const loadPath = async ({ outIn = false } = {}) => {
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
  const drive_info = resData.drive_info;

  usedSpace.value = drive_info.used_space;
  
  //   si full path est vide on renvoie vers root pour etre sur et on reset le ?folder_id
  if (fullPathData.length === 0 && activeFolderId.value !== "root") {
    activeFolderId.value = "root";
    router.push(`/drive?folder_id=root`);
    return;
  }

  // Reset des placeholders "uploaded" pour ce dossier pour éviter les doublons
  listUploaded.value = listUploaded.value.filter(
    (file) => (file._targetFolderId || "root") !== activeFolderId.value
  );

  const items = [
    ...(files_and_folders?.folders ?? []),
    ...(files_and_folders?.files ?? []),
  ];

  const decryptedItems = [];
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
        // rajouter dans les metatdata l'encrypted_data_key pour les futurs téléchargements
        metadata.encrypted_data_key = item.encrypted_file_key;
        decryptedItems.push({
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
        metadata.encrypted_data_key = item.encrypted_folder_key;
        decryptedItems.push({
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

  await applyDriveItemsForDisplay(decryptedItems, { outIn });

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
  await refreshTreeNode(activeFolderId.value);

  // il faut reussir a seclection le nouveau dossier créé pour le renommer directement
  await nextTick();
  const id = resData.folder_id;
  const newFolderElement = document.querySelector(
    `.item[data-item-id="${id}"]`
  );

  console.log("New folder element:", newFolderElement);
  if (newFolderElement) {
    renameItem(newFolderElement);
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
  
  // Aussi retirer de la liste d'attente
  listToUpload.value = listToUpload.value.filter(f => f._uploadId !== file_id);
  listUploaded.value = listUploaded.value.filter(f => f._uploadId !== file_id);

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
const rightClickPanel = ref(null);

const setIsOver = (state) => {
  isOver.value = state;
};

// listener sur le click droit pour gérer le pannel
onMounted(() => {
  const onContextMenu = (e) => {
    e.preventDefault();

    const panel = rightClickPanel.value;
    if (!panel) return;

    // est ce qu'il y a un item sous le curseur ?
    const element_under_cursor = document.elementFromPoint(
      e.clientX,
      e.clientY
    );
    if (element_under_cursor && element_under_cursor.closest(".item")) {
      // on log l'item en question
      const item = element_under_cursor.closest(".item");
      console.log("Right click on item:", item);
      rightClikedItem.value = item;
    } else {
      rightClikedItem.value = null;
    }

    panel.style.display = "flex";
    panel.style.top = e.pageY + "px";
    panel.style.left = e.pageX + "px";
  };

  const handleTreeContextMenu = ({ node, event }) => {
    event.preventDefault();
    const panel = rightClickPanel.value;
    if (!panel) return;

    // Créer un élément virtuel pour le dossier du tree
    const virtualItem = document.createElement('div');
    virtualItem.setAttribute('data-item-type', 'folder');
    virtualItem.setAttribute('data-item-id', node.folder_id);
    virtualItem.setAttribute('data-folder-name', node.metadata?.folder_name || 'Dossier');
    
    rightClikedItem.value = virtualItem;

    panel.style.display = "flex";
    panel.style.top = event.pageY + "px";
    panel.style.left = event.pageX + "px";
  };

  const onClick = () => {
    const panel = rightClickPanel.value;
    if (!panel) return;
    if (panel.style.display === "flex") {
      panel.style.display = "none";
      rightClikedItem.value = null;
    }
  };

  window.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("click", onClick);

  onBeforeUnmount(() => {
    window.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("click", onClick);
  });
});

const openItemMenu = (item) => {
  const panel = rightClickPanel.value;
  if (!panel) return;

  rightClikedItem.value = item;

  // Positionner le menu près de l'élément cliqué
  const rect = event.currentTarget.getBoundingClientRect();
  panel.style.display = "flex";
  panel.style.top = rect.bottom + window.scrollY + "px";
  panel.style.left = rect.left + window.scrollX + "px";
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

const deleteItem = async (item) => {
  // Récupérer l'id depuis l'attribut data-item-id de l'élément DOM
  const itemId = item.dataset?.itemId;
  const itemType = item.dataset?.itemType;

  // Vérifier si cet item fait partie d'une sélection multiple
  let itemsToDelete = [];
  
  if (selectedItems.value.has(itemId) && selectedItems.value.size > 1) {
    // Supprimer tous les items sélectionnés
    itemsToDelete = Array.from(selectedItemsMap.value.values());
    const confirmMessage = `Voulez-vous vraiment supprimer ${itemsToDelete.length} éléments ?`;
    if (!confirm(confirmMessage)) {
      return;
    }
  } else {
    // Supprimer juste cet item
    itemsToDelete = [{
      type: itemType,
      file_id: itemType === "file" ? itemId : null,
      folder_id: itemType === "folder" ? itemId : null,
    }];
  }

  try {
    // Supprimer tous les items
    const deletePromises = itemsToDelete.map(async (itemToDelete) => {
      const id = itemToDelete.file_id || itemToDelete.folder_id;
      const type = itemToDelete.type;
      
      if (type === "file") {
        const res = await fetch(`${API_URL}/drive/delete_file`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ file_id: id }),
        });
        if (!res.ok) {
          throw new Error(`Failed to delete file ${id}`);
        }
      } else if (type === "folder") {
        const res = await fetch(`${API_URL}/drive/delete_folder`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folder_id: id }),
        });
        if (!res.ok) {
          throw new Error(`Failed to delete folder ${id}`);
        }
      }
    });

    await Promise.all(deletePromises);
    
    console.log(`Successfully deleted ${itemsToDelete.length} item(s)`);
    
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
            : { ...metadata, folder_name: newName }
        ),
        decryptkey
      );

      const endpoint =
        itemType === "file"
          ? `${API_URL}/drive/rename_file`
          : `${API_URL}/drive/rename_folder`;
      const body =
        itemType === "file"
          ? { file_id: itemId, new_encrypted_metadata: encryptedMetadata }
          : { folder_id: itemId, new_encrypted_metadata: encryptedMetadata };
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
      alert("Erreur lors du renommage de l'élément");
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

const isDragging = ref(false);
const activeItem = ref(null);
const draggedItems = ref([]); // Tous les items en cours de déplacement
const mousePos = ref({ x: 0, y: 0 });

const handleDragStart = (data) => {
  isDragging.value = true;
  activeItem.value = data.item;
  mousePos.value = { x: data.x, y: data.y };
  
  const itemId = data.item.type === "file" ? data.item.file_id : data.item.folder_id;
  
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

const handleDragMove = (data) => {
  // Cette fonction est appelée à chaque pixel bougé par la souris
  mousePos.value = { x: data.x, y: data.y };
};

const moveItem = async (item, targetFolderId) => {
  const itemId = item.file_id || item.folder_id;
  const itemType = item.type;
  
  const endpoint =
    itemType === "file"
      ? `${API_URL}/drive/move_file`
      : `${API_URL}/drive/move_folder`;

  const body =
    itemType === "file"
      ? { file_id: itemId, new_parent_folder_id: targetFolderId }
      : { folder_id: itemId, new_parent_folder_id: targetFolderId };

  const res = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to move ${itemType} ${itemId}`);
  }
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
    '.item[data-item-type="folder"]'
  );
  const folderTreeNodeElement = elementUnderMouse?.closest('.folder-three');

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

    console.log(`Moving ${draggedItems.value.length} item(s) to folder ${targetFolderId}`);

    // Déplacer tous les items
    const movePromises = draggedItems.value.map(item => moveItem(item, targetFolderId));
    await Promise.all(movePromises);

    console.log("All items moved successfully");
    
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

const selectItem = (item, event) => {
  const itemId = item.type === "file" ? item.file_id : item.folder_id;
  const newSelectedItems = new Set(selectedItems.value);
  const newSelectedItemsMap = new Map(selectedItemsMap.value);
  console.log("Selecting item:", itemId, item);
  // afficher les keys de l'event pour debug
  console.log("Select item event keys:", {
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });

  // si ctrl ou cmd est appuyé on toggle l'item à la selection
  if (event.ctrlKey || event.metaKey) {
    if (newSelectedItems.has(itemId)) {
      newSelectedItems.delete(itemId);
      newSelectedItemsMap.delete(itemId);
    } else {
      newSelectedItems.add(itemId);
      newSelectedItemsMap.set(itemId, item);
    }
  } else {
    // Sinon, sélection simple (remplace la sélection précédente)
    newSelectedItems.clear();
    newSelectedItemsMap.clear();
    newSelectedItems.add(itemId);
    newSelectedItemsMap.set(itemId, item);
  }

  selectedItems.value = newSelectedItems;
  selectedItemsMap.value = newSelectedItemsMap;
};

const clearSelection = () => {
  selectedItems.value = new Set();
  selectedItemsMap.value = new Map();
};

// Style dynamique pour l'élément "fantôme" qui suit la souris
const ghostStyle = computed(() => ({
  position: "fixed",
  top: 0,
  left: 0,
  transform: `translate(${mousePos.value.x - 50}px, ${
    mousePos.value.y - 24
  }px)`,
  pointerEvents: "none", // Important pour ne pas bloquer les événements souris
  zIndex: 9999,
}));

watch(
  [listToUpload, listUploadInProgress],
  () => {
    startUploads();
  },
  { deep: true }
);

watch(
  full_path,
  () => {
    if (!full_path.value.length) return;
    expandTreeToCurrentPath();
  },
  { deep: true }
);

// watch sur selectedItems pour mettre à jour le DOM

watch(
  selectedItems,
  (newSelectedItems) => {
    const allItems = document.querySelectorAll(".item");
    allItems.forEach((item) => {
      item.classList.remove("selected-item");
    });

    // Ajouter la classe selected-item à tous les items sélectionnés
    newSelectedItems.forEach((itemId) => {
      const domItem = document.querySelector(`.item[data-item-id="${itemId}"]`);
      if (domItem) {
        domItem.classList.add("selected-item");
      }
    });
  },
  { deep: true }
);

// un watch sur activeFolderId pour recharger le path
watch(activeFolderId, () => {
  if (!loadingDrive.value) {
    console.log("Active folder changed to:", activeFolderId.value);
    loadPath({ outIn: true });
  }
});

// si l'url change (folder_id) on met a jour activeFolderId
watch(
  () => route.query.folder_id,
  (newFolderId) => {
    if (newFolderId && newFolderId !== activeFolderId.value) {
      activeFolderId.value = newFolderId;
    } else if (!newFolderId && activeFolderId.value !== "root") {
      activeFolderId.value = "root";
    }
  }
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
}

/* --- Cible les éléments en édition --- */
.filename[contenteditable="true"],
.foldername[contenteditable="true"] {
  /* Pour Firefox : barre fine, couleur grise sur fond transparent */
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
  white-space: nowrap; /* Force le texte sur une ligne pour scroller horizontalement */
  overflow-x: auto;
}

/* --- WEBKIT (Chrome, Edge, Safari) --- */

/* 1. La taille globale de la scrollbar : on met 3px pour que ça prenne zéro place */
.filename[contenteditable="true"]::-webkit-scrollbar,
.foldername[contenteditable="true"]::-webkit-scrollbar {
  height: 3px;
}

/* 2. IMPORTANT : On supprime les flèches (boutons) gauche/droite */
.filename[contenteditable="true"]::-webkit-scrollbar-button,
.foldername[contenteditable="true"]::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

/* 3. Le fond de la barre (track) : totalement transparent */
.filename[contenteditable="true"]::-webkit-scrollbar-track,
.foldername[contenteditable="true"]::-webkit-scrollbar-track {
  background: transparent;
}

/* 4. La partie mobile (thumb) : arrondie et discrète */
.filename[contenteditable="true"]::-webkit-scrollbar-thumb,
.foldername[contenteditable="true"]::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2); /* Gris clair transparent */
  border-radius: 10px; /* Forme de pilule */
}

/* 5. Au survol de la barre, on la fonce légèrement pour montrer qu'elle est active */
.filename[contenteditable="true"]::-webkit-scrollbar-thumb:hover,
.foldername[contenteditable="true"]::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
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

  flex: 0 0 300px;
  padding-left: 25px;
  padding-right: 25px;
}

.div_right_section {
  position: relative;
  flex: 1;

  border-radius: 25px;
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
  font-weight: 600;
  font-family: "Roboto", "Segoe UI", sans-serif;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10px;
  /* margin-left: 35px; */
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
  opacity: 0 !important;
  transform: scale(0.8) !important;
}

.file-list-leave-to {
  opacity: 0 !important;
  transform: scale(0.8) !important;
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

.barre_download {
  background-color: #4caf50;
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

/* div_pannel_right_click */

#div_pannel_right_click {
  position: absolute;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1001;
  width: 200px;

  padding: 5px 8px;

  display: none;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 5px;
}

#div_pannel_right_click a {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  text-decoration: none;
  color: #333333;
  font-size: 14px;

  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}
#div_pannel_right_click a:hover {
  background-color: #f0f0f0;
}

/* Élément de drag qui suit la souris */
.drag-ghost {
  position: fixed;
  background-color: #eff3f8;
  border-radius: 12px;
  padding: 0 12px;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  z-index: 9999;
  opacity: 0.9;
}

.drag-ghost .icon-wrapper {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #444746;
  flex-shrink: 0;
}

.drag-ghost svg {
  width: 100%;
  height: 100%;
}

.drag-label {
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.drag-count {
  background-color: #4c8eaf;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.selected-item {
  background-color: #d0e6ff !important;
}

/* div_treeview */

.div_treeview {
  width: 100%;
  height: 80%;
  min-height: 400px;
  overflow-y: auto;
  padding: 10px;
  padding-left: 12px;

  overflow: auto;
}
.folder-three {
  width: 100%;
  height: fit-content;
}

.three-folder-name {
  font-family: "Roboto", "Segoe UI", sans-serif;
  font-size: 15px;
  /* font-weight: 600; */
  color: #333333;
  text-decoration: none;
  padding: 3px 20px;
  border-radius: 5px;
}
.three-folder-name:hover {
  text-decoration: underline;
  cursor: pointer;
}

.select_folder_three {
  background-color: #e6f0ff;
}


.div_enfants {
  margin-left: 15px;
  margin-top: 5px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 5px;
}

.div_name_bnt {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}
.div_name_bnt svg {
  width: 16px;
  height: 16px;
  fill: #555555;
  cursor: pointer;
  transform: translateY(4px);
}

.tree-toggle {
  background: none;
  border: none;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin-right: 6px;
  margin-top: 0px;
  color: #555555;
  cursor: pointer;
}

.tree-toggle:hover {
  color: #222222;
}

.is-active-folder .three-folder-name {
  font-weight: 700;
}

.div_utilisation_storage {

display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;

  /* background-color: #f7f7f7; */
  height: 20%;
  width: 100%;
  border-radius: 10px;
  padding: 16px 12px;
  box-shadow: 0 2px 8px rgba(76, 142, 175, 0.08);
  margin-top: 18px;
}

.div_utilisation_storage h4 {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}

.storage-bar {
  width: 100%;
  height: 18px;
  background-color: #e0e0e0;
  border-radius: 9px;
  overflow: hidden;
  display: flex;
  flex-direction: row;
}

.used-space {
  height: 100%;
  background-color: #4c8eaf;
  border-radius: 9px 0 0 9px;
  transition: width 0.3s ease;
}

.free-space {
  height: 100%;
  background-color: #d7eaf6;
  border-radius: 0 9px 9px 0;
  transition: width 0.3s ease;
}

.storage-info {
  margin-top: 8px;
  display: flex;
  flex-direction: row;
  gap: 16px;
  font-size: 13px;
  color: #555;
}

/* Panneau de transferts moderne */
.transfer-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 420px;
  max-height: 600px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
  transition: all 0.3s ease;
}

.transfer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.transfer-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 15px;
}

.transfer-title svg {
  width: 20px;
  height: 20px;
}

.transfer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-action, .btn-collapse {
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.btn-action:hover, .btn-collapse:hover {
  background: rgba(255, 255, 255, 0.25);
}

.btn-action svg, .btn-collapse svg {
  width: 18px;
  height: 18px;
}

.btn-collapse svg.rotated {
  transform: rotate(180deg);
}

.btn-danger {
  background: rgba(244, 67, 54, 0.8);
}

.btn-danger:hover {
  background: rgba(244, 67, 54, 1);
}

.transfer-list {
  overflow-y: auto;
  max-height: 500px;
  padding: 12px;
}

.transfer-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: #f8f9fa;
  border-radius: 10px;
  margin-bottom: 10px;
  transition: all 0.2s ease;
}

.transfer-item:hover {
  background: #f0f2f5;
}

.transfer-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.upload-icon {
  background: linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%);
  color: #555;
}

.download-icon {
  background: linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%);
  color: #555;
}

.transfer-icon svg {
  width: 22px;
  height: 22px;
}

.transfer-info {
  flex: 1;
  min-width: 0;
}

.transfer-name {
  font-weight: 600;
  font-size: 14px;
  color: #222;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-details {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #666;
  flex-wrap: nowrap;
  overflow: hidden;
}

.transfer-details span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transfer-status {
  font-weight: 500;
  color: #5b9bd5;
}

.transfer-speed {
  color: #888;
}

.transfer-eta {
  color: #999;
  font-style: italic;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.upload-progress {
  background: linear-gradient(90deg, #5b9bd5 0%, #4a8fc5 100%);
}

.download-progress {
  background: linear-gradient(90deg, #5b9bd5 0%, #4a8fc5 100%);
}

.progress-text {
  font-size: 12px;
  font-weight: 700;
  color: #5b9bd5;
  min-width: 30px;
}

.transfer-controls {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-control {
  background: #ffffff;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #555;
}

.btn-control:hover {
  background: #f5f5f5;
  border-color: #5b9bd5;
  color: #5b9bd5;
}

.btn-control.btn-cancel {
  color: #f44336;
  border-color: #f44336;
}

.btn-control.btn-cancel:hover {
  background: #f443361a;
  border-color: #f44336;
}

.btn-control svg {
  width: 16px;
  height: 16px;
}

</style>
