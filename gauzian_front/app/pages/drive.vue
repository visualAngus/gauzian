<template>
  <ShareItemVue
    v-if="isSharing && shareItemTarget"
    :itemName="shareItemTarget.name"
    :itemId="shareItemTarget.id"
    @close="handleShareClose"
    @annuler="() => { isSharing = false }"
  />

  <div id="div_pannel_right_click" ref="rightClickPanel">
    <!-- Options quand c'est un dossier -->
    <a
      @click.stop="createFolder(); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset?.itemType === 'folder' &&
        activeFolderId !== 'corbeille'
      "
      >Nouveau dossier</a
    >
    <a
      @click.stop="downloadItem(rightClikedItem); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder') &&
        activeFolderId !== 'corbeille'
      "
      >Télécharger</a
    >
    <a
      @click.stop="renameItem(rightClikedItem); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder') &&
        activeFolderId !== 'corbeille'
      "
      >Renommer</a
    >
    <a
      @click.stop="restoreItem(rightClikedItem); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder') &&
        activeFolderId === 'corbeille'
      "
      >Restaurer</a
    >
    <a
      @click.stop="deleteItem(rightClikedItem); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder')
      "
      >Supprimer</a
    >
    <a
      @click.stop="shareItem(rightClikedItem); closeContextMenu()"
      v-if="
        rightClikedItem?.dataset &&
        (rightClikedItem.dataset.itemType === 'file' ||
          rightClikedItem.dataset.itemType === 'folder') &&
        activeFolderId !== 'corbeille'
      "
      >Partager</a
    >

    <!-- Options quand c'est l'espace vide -->
    <a
      @click.stop="createFolder(); closeContextMenu()"
      v-if="rightClikedItem === null && activeFolderId !== 'corbeille'"
      >Nouveau dossier</a
    >
    <a
      @click.stop="fileInput.click(); closeContextMenu()"
      v-if="rightClikedItem === null && activeFolderId !== 'corbeille'"
      >Importer des fichiers</a
    >
  </div>

  <!-- Panneau Upload/Download moderne -->
  <div
    class="transfer-panel"
    v-if="listUploadInProgress.length > 0 || listDownloadInProgress.length > 0"
  >
    <div class="transfer-header">
      <div class="transfer-title">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 2L16 6H13V12H11V6H8L12 2ZM2 20H22V22H2V20ZM13 16H11V14H13V16Z"
          />
        </svg>
        <span
          >Transferts ({{
            listToUpload.length +
            listUploadInProgress.length +
            listDownloadInProgress.length
          }})</span
        >
      </div>
      <div class="transfer-actions">
        <button
          class="btn-action"
          @click="pauseAllTransfers"
          v-if="!allTransfersPaused"
          title="Tout mettre en pause"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z" />
          </svg>
        </button>
        <button
          class="btn-action"
          @click="resumeAllTransfers"
          v-else
          title="Tout reprendre"
        >
          <svg
          loadPath,
          downloadFile,
          usedSpace,
          totalSpaceLeft
            fill="currentColor"
          >
            <path d="M7 5V19L17 12L7 5Z" />
          </svg>
        </button>
        <button
          class="btn-action btn-danger"
          @click="cancelAllTransfers"
          title="Tout annuler"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 10.5858L9.17157 7.75736L7.75736 9.17157L10.5858 12L7.75736 14.8284L9.17157 16.2426L12 13.4142L14.8284 16.2426L16.2426 14.8284L13.4142 12L16.2426 9.17157L14.8284 7.75736L12 10.5858Z"
            />
          </svg>
        </button>
        <button class="btn-collapse" @click="togglePanelCollapse">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            :class="{ rotated: isPanelCollapsed }"
          >
            <path
              d="M12 13.1716L16.9497 8.22186L18.3639 9.63607L12 16L5.63604 9.63607L7.05025 8.22186L12 13.1716Z"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="transfer-list" v-show="!isPanelCollapsed">
      <!-- Uploads -->
      <div
        class="transfer-item"
        v-for="file in listUploadInProgress"
        :key="file._uploadId"
      >
        <div class="transfer-icon upload-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 12.5858L16.2426 16.8284L14.8284 18.2426L13 16.4142V22H11V16.4142L9.17157 18.2426L7.75736 16.8284L12 12.5858ZM12 2C15.5934 2 18.5544 4.70761 18.9541 8.19395C21.2858 8.83154 23 10.9656 23 13.5C23 16.5376 20.5376 19 17.5 19H17V17H17.5C19.433 17 21 15.433 21 13.5C21 11.567 19.433 10 17.5 10C17.2912 10 17.0867 10.0183 16.8887 10.054C16.9616 9.7142 17 9.36158 17 9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9C7 9.36158 7.03838 9.7142 7.11205 10.0533C6.91331 10.0183 6.70879 10 6.5 10C4.567 10 3 11.567 3 13.5C3 15.433 4.567 17 6.5 17H7V19H6.5C3.46243 19 1 16.5376 1 13.5C1 10.9656 2.71424 8.83154 5.04648 8.19411C5.44561 4.70761 8.40661 2 12 2Z"
            />
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">{{ file.name }}</div>
          <div class="transfer-details">
            <span class="progress-text"
              >{{ Math.round(fileProgressMap[file._uploadId] || 0) }}%</span
            >
            <span class="transfer-status">{{
              getTransferStatus(file._uploadId, "upload")
            }}</span>
            <span class="transfer-speed">{{
              formatSpeed(transferSpeeds[file._uploadId])
            }}</span>
            <span class="transfer-eta" v-if="transferETAs[file._uploadId]">{{
              formatETA(transferETAs[file._uploadId])
            }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill upload-progress"
              :style="{ width: (fileProgressMap[file._uploadId] || 0) + '%' }"
            ></div>
          </div>
        </div>
        <div class="transfer-controls">
          <button
            class="btn-control"
            @click="togglePauseTransfer(file._uploadId, 'upload')"
            v-if="!isPaused(file._uploadId)"
            title="Pause"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z" />
            </svg>
          </button>
          <button
            class="btn-control"
            @click="togglePauseTransfer(file._uploadId, 'upload')"
            v-else
            title="Reprendre"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 5V19L17 12L7 5Z" />
            </svg>
          </button>
          <button
            class="btn-control btn-cancel"
            @click="abort_upload(file._uploadId)"
            title="Annuler"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Downloads -->
      <div
        class="transfer-item"
        v-for="file in listDownloadInProgress"
        :key="file._downloadId"
      >
        <div class="transfer-icon download-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M13 10H18L12 16L6 10H11V3H13V10ZM4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19Z"
            />
          </svg>
        </div>
        <div class="transfer-info">
          <div class="transfer-name">{{ file.name }}</div>
          <div class="transfer-details">
            <span class="transfer-status">{{
              getTransferStatus(file._downloadId, "download")
            }}</span>
            <span class="progress-text"
              >{{
                Math.round(downloadProgressMap[file._downloadId] || 0)
              }}%</span
            >
            <span class="transfer-speed">{{
              formatSpeed(transferSpeeds[file._downloadId])
            }}</span>
            <span class="transfer-eta" v-if="transferETAs[file._downloadId]">{{
              formatETA(transferETAs[file._downloadId])
            }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill download-progress"
              :style="{
                width: (downloadProgressMap[file._downloadId] || 0) + '%',
              }"
            ></div>
          </div>
        </div>
        <div class="transfer-controls">
          <button
            class="btn-control"
            @click="togglePauseTransfer(file._downloadId, 'download')"
            v-if="!isPaused(file._downloadId)"
            title="Pause"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z" />
            </svg>
          </button>
          <button
            class="btn-control"
            @click="togglePauseTransfer(file._downloadId, 'download')"
            v-else
            title="Reprendre"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 5V19L17 12L7 5Z" />
            </svg>
          </button>
          <button
            class="btn-control btn-cancel"
            @click="cancelDownload(file._downloadId)"
            title="Annuler"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                d="M12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Overlay pour fermer le sidebar en cliquant en dehors -->
  <div
    v-if="isSidebarOpen"
    class="sidebar-overlay"
    @click="isSidebarOpen = false"
  ></div>

  <main>
    <div class="div_left_section" :class="{ 'sidebar-open': isSidebarOpen }">
      <button
        @click="
          createFolder();
          isSidebarOpen = false;
        "
        id="create-folder-button"
        :disabled="activeFolderId === 'corbeille'"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"></path>
        </svg>
        Nouveau dossier
      </button>
      <!-- importer des fichiers -->

      <button
        @click="
          fileInput.click();
          isSidebarOpen = false;
        "
        id="import-files-button"
        :disabled="activeFolderId === 'corbeille'"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path
            d="M12 2L16 6H13V12H11V6H8L12 2ZM2 20H22V22H2V20ZM4 14H6V18H18V14H20V20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V14Z"
          />
        </svg>
        Importer des fichiers
      </button>

      <div class="div-autre-menu">
        <a
          @click="
            gohome();
            isSidebarOpen = false;
          "
          :class="{ active: activeFolderId !== 'corbeille' }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M19 21H5C4.44772 21 4 20.5523 4 20V11L1 11L11.3273 1.6115C11.7087 1.26475 12.2913 1.26475 12.6727 1.6115L23 11L20 11V20C20 20.5523 19.5523 21 19 21ZM6 19H18V9.15745L12 3.7029L6 9.15745V19Z"
            ></path>
          </svg>
          Accueil
        </a>
        <a
          @click="
            goToTrash();
            isSidebarOpen = false;
          "
          :class="{ active: activeFolderId === 'corbeille' }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M3 6H5H21V8H19.6667L18.6667 20C18.6667 21.1046 17.7712 22 16.6667 22H7.33333C6.22881 22 5.33333 21.1046 5.33333 20L4.33333 8H3V6ZM7.33333 20H16.6667L17.6667 8H6.33333L7.33333 20ZM9.33333 10H11.3333V18H9.33333V10ZM12.6667 10H14.6667V18H12.6667V10ZM10 4V2H14V4H19V6H5V4H10Z"
            ></path>
          </svg>
          Corbeille
        </a>
      </div>
      <div class="div_treeview">
        <FolderTreeNode
          :node="folderTree"
          :active-id="activeFolderId"
          @select="selectFolderFromTree"
          @toggle="toggleFolderNode"
          @context-menu="handleTreeContextMenu"
        />
        <FolderTreeNode
          :node="trashNode"
          :active-id="activeFolderId"
          @select="selectFolderFromTree"
          @toggle="toggleFolderNode"
          @context-menu="handleTreeContextMenu"
        />
      </div>

      <div class="div-utilisation-storage">
        <h4>Utilisation du stockage</h4>
        <div class="storage-bar">
          <div
            class="used-space"
            :style="{
              width: (usedSpace / maxspace) * 100 + '%',
            }"
          ></div>
        </div>
        <div class="storage-info">
          <span>{{ formatBytes(usedSpace) }} utilisés</span>
          <span>{{ formatBytes(totalSpaceLeft) }} libres</span>
        </div>
      </div>
    </div>

    <div class="mobile-header">
      <button class="hamburger-menu" @click="toggleSidebar" aria-label="Menu">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M3 18H21V16H3V18ZM3 13H21V11H3V13ZM3 8H21V6H3V8Z" />
        </svg>
      </button>
    </div>
    <div class="div_right_section">
      <!-- multiple files -->

      <div
        class="breadcrumb"
        ref="breadcrumbRef"
        @wheel.prevent="onBreadcrumbWheel"
      >
        <div class="breadcrumb-left">
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

        <button
          v-if="
            activeFolderId === 'corbeille' && liste_decrypted_items.length > 0
          "
          @click="emptyTrash()"
          id="empty-trash-button"
          class="breadcrumb-action"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"
            ></path>
          </svg>
          Vider la corbeille
        </button>
      </div>

      <div
        :class="['section_items', { is_empty: displayedDriveItems.length === 0 }]"
        @click.self="clearSelection"
        @contextmenu.self="openEmptySpaceMenu"
        v-dropzone="{
          inputRef: fileInput,
          onFiles: onFilesFromDrop,
          onOverChange: setIsOver,
          isDisabled: activeFolderId === 'corbeille',
        }"
      >
        <TransitionGroup
          name="file-list"
          tag="div"
          class="file-grid"
          @click.self="clearSelection"
          @contextmenu.self="openEmptySpaceMenu"
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
            @contextmenu="(item, event) => openItemMenu(item, event)"
            @move-start="handleDragStart"
            @moving="handleDragMove"
            @move-end="handleDragEnd"
            @select="({ item, event }) => selectItem(item, event)"
            @dotclick="(item, event) => openItemMenu(item, event)"
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
            @contextmenu="(item, event) => openItemMenu(item, event)"
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
      <span v-if="draggedItems.length > 1" class="drag-count"
        >+{{ draggedItems.length - 1 }}</span
      >
    </span>
  </div>

  <input
    ref="fileInput"
    type="file"
    style="display: none"
    multiple
    @change="handleFileInputChange"
  />
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "#imports";

// Composables
import { useAuth } from "~/composables/useAuth";
import { useLayout } from "~/composables/drive/useLayout";
import { useSelection } from "~/composables/drive/useSelection";
import { useDriveData } from "~/composables/drive/useDriveData";
import { useFileActions } from "~/composables/drive/useFileActions";
import { useTransfers } from "~/composables/drive/useTransfers";
import { useContextMenu } from "~/composables/drive/useContextMenu";

// Directives & Components
import dropzone from "~/directives/dropzone";
import FileItem from "~/components/FileItem.vue";
import ShareItemVue from "~/components/ShareItem.vue";
import FolderTreeNode from "~/components/FolderTreeNode.vue";

const vDropzone = dropzone;
const API_URL = "https://gauzian.pupin.fr/api";
const router = useRouter();

useHead({ title: "GZDRIVE | Drive" });
definePageMeta({ headerTitle: "GZDRIVE" });

// 1. Authentification
const { etat, autologin } = useAuth(API_URL);

// 2. Layout & Stockage
const { 
  isSidebarOpen, 
  toggleSidebar, 
  usedSpace, 
  maxspace, 
  totalSpaceLeft 
} = useLayout(
  API_URL,
);

// 3. Données Drive (Tree, Items, Navigation)
// Note: on injecte usedSpace ici si loadPath met à jour l'espace utilisé
const {
  activeFolderId,
  liste_decrypted_items,
  displayedDriveItems,
  full_path,
  folderTree,
  refreshTreeNode,
  expandTreeToCurrentPath,
  toggleFolderNode,
  selectFolderFromTree,
  loadTreeNode,
  loadPath,
  onFileListAfterLeave,
  get_all_info,
  breadcrumbRef,
  onBreadcrumbWheel,
  navigateToBreadcrumb,
  loadingDrive
} = useDriveData(router, API_URL, usedSpace); 

// 4. Sélection Multiple
const { 
  selectedItems, 
  selectedItemsMap, 
  selectItem, 
  clearSelection 
} = useSelection(
  API_URL,
);

// 5. Transferts (Upload/Download)
const {
  listToUpload,
  listUploadInProgress,
  listUploaded,
  listDownloadInProgress,
  fileProgressMap,
  downloadProgressMap,
  transferSpeeds,
  transferETAs,
  allTransfersPaused,
  isPanelCollapsed,
  abortControllers,
  downloadAbortControllers,
  // Fonctions
  startUploads,
  pauseAllTransfers,
  resumeAllTransfers,
  cancelAllTransfers,
  togglePauseTransfer,
  abort_upload,
  cancelDownload,
  downloadItem,
  formatSpeed,
  formatETA,
  getTransferStatus,
  togglePanelCollapse,
  isPaused,
  downloadFile
} = useTransfers({
  API_URL,
  activeFolderId,
  loadPath, // Callback quand un upload est fini
  liste_decrypted_items,
});

// 6. Actions Fichiers (Drag&Drop, Renommer, Supprimer...)
const {
  fileInput,
  rightClickPanel,
  rightClikedItem,
  // Drag State
  isDragging,
  activeItem,
  draggedItems,
  ghostStyle,
  isSharing,
  shareItemTarget,
  // Fonctions
  createFolder,
  deleteItem,
  shareItem,
  shareItemServer,
  renameItem,
  restoreItem,
  emptyTrash,
  gohome,
  goToTrash,
  // Handlers
  click_on_item,
  openItemMenu,
  openEmptySpaceMenu,
  closeContextMenu,
  handleTreeContextMenu,
  handleFileInputChange,
  onFilesFromDrop,
  setIsOver,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  formatBytes,
} = useFileActions({
  API_URL,
  activeFolderId,
  listToUpload,
  listUploadInProgress,
  listUploaded,
  fileProgressMap,
  abortControllers,
  selectedItems,
  selectedItemsMap,
  refreshTreeNode,
  clearSelection,
  loadPath,
  downloadFile,
  usedSpace,
  totalSpaceLeft,
  liste_decrypted_items
});

const handleShareClose = async (contacts, accessLevel) => {
  if (!shareItemTarget?.value) {
    isSharing.value = false;
    return;
  }

  const contactsList = Array.isArray(contacts) ? contacts : [];

  if (contactsList.length === 0) {
    isSharing.value = false;
    shareItemTarget.value = null;
    return;
  }

  try {
    await shareItemServer(
      shareItemTarget.value.id,
      shareItemTarget.value.type,
      contactsList,
      accessLevel.value
    );

    // Succès
    const itemType = shareItemTarget.value.type === 'folder' ? 'dossier' : 'fichier';
    const contactCount = contactsList.length;
    const message = `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} partagé avec succès avec ${contactCount} contact${contactCount > 1 ? 's' : ''}`;

    console.log(message);
    alert(message); // TODO: Remplacer par un système de notifications plus élégant

    // Rafraîchir pour voir les changements
    await loadPath();

  } catch (error) {
    console.error("Error sharing item:", error);
    const errorMessage = error.message || "Erreur lors du partage de l'élément";
    alert(`Erreur: ${errorMessage}`);
    // Ne pas fermer le modal en cas d'erreur pour permettre de réessayer
    return;
  }

  isSharing.value = false;
  shareItemTarget.value = null;
};

// 7. Context Menu Global
const { showContextMenu, hideContextMenu } = useContextMenu();

// --- Logique "Glue" (Spécifique à la vue qui combine les états) ---

// Calcul combiné des fichiers à afficher (ceux du drive + ceux en cours d'upload)
const pendingAndUploadingFiles = computed(() => {
  return [
    ...listToUpload.value
      .filter((file) => (file._targetFolderId || "root") === activeFolderId.value)
      .map((file) => ({ ...file, _status: "pending", _name: file.name, _progress: 0 })),
    ...listUploadInProgress.value
      .filter((file) => (file._targetFolderId || "root") === activeFolderId.value)
      .map((file) => ({ ...file, _status: "uploading", _name: file.name, _progress: fileProgressMap.value[file._uploadId] || 0 })),
    ...listUploaded.value
      .filter((file) => (file._targetFolderId || "root") === activeFolderId.value)
      .map((file) => ({ ...file, _status: "uploaded", _name: file.name, _progress: 100 })),
  ];
});

// Initialisation
const activeSection = ref("my_drive"); // Simple ref UI locale

// Démarrage
autologin(() => {
    // Callback succès login : on charge les données
    get_all_info(); 
});

onMounted(async () => {
  // Initialisation Tree
  await loadTreeNode(folderTree.value);
  await expandTreeToCurrentPath();
  
  // Setup URL params
  const urlParams = new URLSearchParams(window.location.search);
  const folderIdFromUrl = urlParams.get("folder_id");
  if (folderIdFromUrl) {
    activeFolderId.value = folderIdFromUrl;
  }

  // Fermer le menu contextuel au clic n'importe où
  const closeContextMenu = () => {
    if (rightClickPanel.value) {
      rightClickPanel.value.style.display = "none";
    }
  };
  document.addEventListener("click", closeContextMenu);
  
  // Nettoyer l'événement au démontage
  onBeforeUnmount(() => {
    document.removeEventListener("click", closeContextMenu);
  });
});



watch(
  selectedItems,
  (newSelectedItems) => {
    // Nettoyer l'ancienne sélection
    const allItems = document.querySelectorAll(".item");
    allItems.forEach((item) => {
      item.classList.remove("selected-item");
    });

    // Appliquer la nouvelle sélection visuelle
    newSelectedItems.forEach((itemId) => {
      const domItem = document.querySelector(`.item[data-item-id="${itemId}"]`);
      if (domItem) {
        domItem.classList.add("selected-item");
      }
    });
  },
  { deep: true }
);

</script>
<style src="~/assets/css/drive.css"></style>

