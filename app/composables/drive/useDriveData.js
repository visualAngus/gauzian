import { ref, watch, nextTick } from 'vue';
import { useFetchWithAuth } from '~/composables/useFetchWithAuth';
import { decryptWithStoredPrivateKey, decryptSimpleDataWithDataKey } from '~/utils/crypto';

export function useDriveData(router, API_URL, usedSpace, listUploaded, addNotification,maxspace) {
    const { fetchWithAuth } = useFetchWithAuth();
    const activeFolderId = ref("root");
    const liste_decrypted_items = ref([]);
    const displayedDriveItems = ref([]);
    const full_path = ref([]);
    const loadingDrive = ref(true);
    const driveListTransition = ref({ leaving: false, pendingLeaves: 0 });
    let queuedDriveItems = null;

    const folderTree = ref({
        folder_id: "root",
        metadata: { folder_name: "Mon Drive" },
        children: [],
        isExpanded: true,
        isLoaded: false,
        isLoading: false,
        parent_folder_id: null,
    });


    const refreshTreeNode = async (folderId) => {
        const targetNode = findNodeById(folderTree.value, folderId);
        if (!targetNode) return;
        targetNode.isLoaded = false;
        // Passer true pour préserver l'état isExpanded des enfants
        await loadTreeNode(targetNode, true);
        targetNode.isExpanded = true;
    };

    const decryptFolderMetadata = async (folder) => {
        const encryptedMetadata = folder.encrypted_metadata;
        const decryptkey = await decryptWithStoredPrivateKey(
            folder.encrypted_folder_key,
        );
        const metadataStr = await decryptSimpleDataWithDataKey(
            encryptedMetadata,
            decryptkey,
        );
        const metadata = JSON.parse(metadataStr);
        metadata.encrypted_data_key = folder.encrypted_folder_key;
        return metadata;
    };


    const expandTreeToCurrentPath = async () => {
        if (!folderTree.value) return;

        let currentNode = folderTree.value;
        currentNode.isExpanded = true;

        if (!currentNode.isLoaded) {
            await loadTreeNode(currentNode);
        }

        for (const pathItem of full_path.value) {
            if (!pathItem) continue;
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
        if (!node?.folder_id) return;
        activeFolderId.value = node.folder_id;
        router.push(`/drive?folder_id=${node.folder_id}`);
    };

    const loadTreeNode = async (node, preserveExpanded = false) => {
        if (!node) return;
        node.isLoading = true;

        try {
            const res = await fetchWithAuth(`/drive/get_folder/${node.folder_id}`, {
                method: "GET",
            });

            if (!res.ok) {
                throw new Error("Failed to get folder content for tree");
            }

            const resData = await res.json();
            const parentId = node.folder_id === "root" ? null : node.folder_id;
            const folders = resData.folder_contents.filter(
                (item) => item.type === "folder" && item.parent_folder_id === parentId,
            );
            const childrenNodes = [];

            for (const folder of folders) {
                try {
                    const metadata = await decryptFolderMetadata(folder);

                    // Chercher si ce nœud existe déjà pour préserver son état
                    const existingChild = node.children?.find(
                        (child) => child.folder_id === folder.folder_id,
                    );

                    childrenNodes.push({
                        ...folder,
                        metadata,
                        children: existingChild?.children || [],
                        isExpanded: preserveExpanded
                            ? existingChild?.isExpanded || false
                            : false,
                        isLoaded: existingChild?.isLoaded || false,
                        isLoading: false,
                        parent_folder_id: node.folder_id,
                    });
                } catch (error) {
                    console.error(
                        "Failed to decrypt metadata for tree folder:",
                        folder.folder_id,
                        error,
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

    const flushQueuedDriveItems = async () => {
        if (!queuedDriveItems) {
            driveListTransition.value.leaving = false;
            return;
        }
        const nextItems = queuedDriveItems;
        queuedDriveItems = null;
        driveListTransition.value.leaving = false;
        await nextTick();
        displayedDriveItems.value = [...nextItems];
    };

    const applyDriveItemsForDisplay = async (items, { outIn = false } = {}) => {
        liste_decrypted_items.value = items;
        if (!outIn) {
            displayedDriveItems.value = [...items];
            return;
        }
        queuedDriveItems = items;
        if (displayedDriveItems.value.length === 0 && !driveListTransition.value.leaving) {
            displayedDriveItems.value = [...items];
            queuedDriveItems = null;
            return;
        }
        if (driveListTransition.value.leaving) return;

        driveListTransition.value.leaving = true;
        driveListTransition.value.pendingLeaves = displayedDriveItems.value.length;
        displayedDriveItems.value = [];
        await nextTick();
        if (driveListTransition.value.pendingLeaves === 0) {
            await flushQueuedDriveItems();
        }
    };

    const onFileListAfterLeave = async (el) => {
        if (el?.dataset?.itemGroup !== "drive") return;
        if (!driveListTransition.value.leaving) return;
        driveListTransition.value.pendingLeaves = Math.max(0, driveListTransition.value.pendingLeaves - 1);
        if (driveListTransition.value.pendingLeaves === 0) {
            await flushQueuedDriveItems();
        }
    };

    // --- Fonction utilitaire TreeView ---
    // (A mettre DANS le composable, pas dans le .vue)
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


    // Helper: decrypt file metadata
    const decryptFileMetadata = async (item) => {
        try {
            item.parent_folder_id = null;
            const encryptedMetadata = item.encrypted_metadata;
            const decryptkey = await decryptWithStoredPrivateKey(item.encrypted_file_key);
            const metadataStr = await decryptSimpleDataWithDataKey(encryptedMetadata, decryptkey);
            const metadata = JSON.parse(metadataStr);
            metadata.encrypted_data_key = item.encrypted_file_key;
            return { ...item, metadata };
        } catch (err) {
            console.error("Failed to decrypt metadata for file:", item.file_id, err);
            return null;
        }
    };

    // Helper: decrypt folder metadata
    const decryptFolderMetadataItem = async (item) => {
        try {
            item.parent_folder_id = null;
            const encryptedMetadata = item.encrypted_metadata;
            const decryptkey = await decryptWithStoredPrivateKey(item.encrypted_folder_key);
            const metadataStr = await decryptSimpleDataWithDataKey(encryptedMetadata, decryptkey);
            const metadata = JSON.parse(metadataStr);
            metadata.encrypted_data_key = item.encrypted_folder_key;
            return { ...item, metadata };
        } catch (err) {
            console.error("Failed to decrypt metadata for folder:", item.folder_id, err);
            return null;
        }
    };

    // Helper: decrypt path items
    const decryptPathItems = async (pathItems) => {
        const newFullPath = [];
        for (const pathItem of pathItems) {
            if (!pathItem?.encrypted_folder_key || !pathItem?.encrypted_metadata) {
                console.warn("Invalid pathItem in loadPath:", pathItem);
                continue;
            }
            try {
                const encryptedMetadata = pathItem.encrypted_metadata;
                const decryptkey = await decryptWithStoredPrivateKey(pathItem.encrypted_folder_key);
                const metadataStr = await decryptSimpleDataWithDataKey(encryptedMetadata, decryptkey);
                const metadata = JSON.parse(metadataStr);
                newFullPath.push({ ...pathItem, metadata });
            } catch (error) {
                console.error("Failed to decrypt pathItem in loadPath:", pathItem, error);
            }
        }
        return newFullPath;
    };

    // Helper: update used space and maxspace
    const updateDriveInfo = (drive_info) => {
        usedSpace.value = drive_info.used_space;
        if (maxspace && drive_info.storage_limit_bytes) {
            maxspace.value = drive_info.storage_limit_bytes;
        }
    };

    // Le backend (get_file_folder) filtre déjà les enfants directs au niveau SQL.
    // Aucun filtre client-side nécessaire : folders filtrés par parent_folder_id, files par folder_id.
    const filterItemsByParent = (files_and_folders) => [
        ...(files_and_folders?.folders ?? []),
        ...(files_and_folders?.files ?? []),
    ];

    const loadPath = async ({ outIn = false } = {}) => {
        const res = await fetchWithAuth(`/drive/get_file_folder/${activeFolderId.value}`, { method: "GET" });
        if (!res.ok) throw new Error("Failed to get file/folder info");
        const resData = await res.json();

        // Special folders
        if (activeFolderId.value === "corbeille" || activeFolderId.value === "shared_with_me") {
            const files_and_folders = resData.files_and_folders;
            const drive_info = resData.drive_info;
            updateDriveInfo(drive_info);

            let items = [];
            let fullPathLabel = "";
            if (activeFolderId.value === "corbeille") {
                items = [...(files_and_folders?.files ?? [])];
                fullPathLabel = "Corbeille";
            } else {
                items = [
                    ...(files_and_folders?.folders ?? []),
                    ...(files_and_folders?.files ?? []),
                ];
                fullPathLabel = "Partagés avec moi";
            }

            const decryptedItemsPromises = items
                .filter(item => item.type === "file" || item.type === "folder")
                .map(item => item.type === "file"
                    ? decryptFileMetadata(item)
                    : decryptFolderMetadataItem(item)
                );
            const decryptedItems = await Promise.all(decryptedItemsPromises);
            full_path.value = [
                {
                    folder_id: activeFolderId.value,
                    metadata: { folder_name: fullPathLabel },
                },
            ];
            await applyDriveItemsForDisplay(decryptedItems.filter(Boolean), { outIn });
            return;
        }

        // Normal folders
        const files_and_folders = resData.files_and_folders;
        const fullPathData = resData.full_path;
        const drive_info = resData.drive_info;
        updateDriveInfo(drive_info);

        // Redirect if full path is empty and not root
        if (fullPathData.length === 0 && activeFolderId.value !== "root") {
            activeFolderId.value = "root";
            router.push(`/drive?folder_id=root`);
            return;
        }

        // Reset uploaded placeholders for this folder
        if (listUploaded?.value) {
            listUploaded.value = listUploaded.value.filter(
                file => (file._targetFolderId || "root") !== activeFolderId.value
            );
        }

        const items = filterItemsByParent(files_and_folders);

        const decryptedItemsPromises = items
            .filter(item => item.type === "file" || item.type === "folder")
            .map(item => item.type === "file"
                ? decryptFileMetadata(item)
                : decryptFolderMetadataItem(item)
            );
        const decryptedItems = await Promise.all(decryptedItemsPromises);
        await applyDriveItemsForDisplay(decryptedItems, { outIn });

        // Update breadcrumb
        full_path.value = await decryptPathItems(fullPathData);
    };
    const get_all_info = async () => {
        // dans l'url ?folder_id=xxx
        const urlParams = new URLSearchParams(window.location.search);
        const id_parent_folder = urlParams.get("folder_id") || "root";

        const res = await fetchWithAuth(`/drive/get_drive_info`, { method: "GET" });
        if (!res.ok) {
            throw new Error("Failed to get drive info");
        }
        const drive_info = await res.json();

        usedSpace.value = drive_info.used_space;
        if (maxspace && drive_info.storage_limit_bytes) {
            maxspace.value = drive_info.storage_limit_bytes;
        }

        // Charger les items via get_file_folder (filtre SQL correct par parent_folder_id)
        // Si activeFolderId n'a pas changé (cas root au démarrage), le watcher ne se déclenche pas
        // → on appelle loadPath explicitement. Sinon le watcher s'en charge.
        const prevFolderId = activeFolderId.value;
        activeFolderId.value = id_parent_folder;
        if (prevFolderId === id_parent_folder) {
            await loadPath();
        }

        loadingDrive.value = false;
    };

    const breadcrumbRef = ref(null);

    const onBreadcrumbWheel = (event) => {
        const breadcrumb = breadcrumbRef.value;
        if (!breadcrumb) return;

        // Récupérer la direction du scroll
        const deltaY = event.deltaY || 0;

        // Convertir le scroll vertical en scroll horizontal
        // Positif = vers la droite, négatif = vers la gauche
        breadcrumb.scrollLeft += deltaY;
    };

    const navigateToBreadcrumb = (pathItem, index) => {
        console.log("Navigating to breadcrumb:", pathItem, index);
        if (index !== full_path.value.length - 1 && pathItem.folder_id) {
            router.push(`/drive?folder_id=${pathItem.folder_id}`);
            activeFolderId.value = pathItem.folder_id;
            addNotification({
                title: "Navigation",
                message: `Vous avez navigué vers "${pathItem.metadata.folder_name}".`,
                duration: 3000,
            });
        }
    };

    watch(activeFolderId, () => {
        // On évite de recharger si on est déjà en train de charger (loadingDrive est défini dans ce fichier ?)
        // Si loadingDrive n'est pas dispo ici, retire la condition pour l'instant
        // console.log("Active folder changed to:", activeFolderId.value);
        loadPath({ outIn: true });
    });

    // --- WATCHER 2 : Arborescence (Breadcrumb) ---
    // Quand le chemin change (ex: on clique sur un dossier), on déplie l'arbre à gauche
    watch(
        full_path,
        () => {
            if (!full_path.value.length) return;
            expandTreeToCurrentPath();
        },
        { deep: true }
    );
    return {
        activeFolderId,
        liste_decrypted_items,
        displayedDriveItems,
        full_path,
        folderTree,
        breadcrumbRef,
        onBreadcrumbWheel,
        navigateToBreadcrumb,
        applyDriveItemsForDisplay,
        decryptFolderMetadata,
        refreshTreeNode,
        expandTreeToCurrentPath,
        toggleFolderNode,
        selectFolderFromTree,
        loadTreeNode,
        loadPath,
        get_all_info,
        loadingDrive,
        driveListTransition,
        onFileListAfterLeave,

    };
}