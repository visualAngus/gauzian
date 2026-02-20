import { ref, computed, watch } from "vue";
import { useFetchWithAuth } from '~/composables/useFetchWithAuth';

export function useInfoPanel({ API_URL, selectedItemsMap, formatBytes, addNotification, clearSelection, renameItem, downloadFile, deleteItem, shareItem }) {
    const { fetchWithAuth } = useFetchWithAuth();
    const infoPanelVisible = ref(false);
    const infoItem = ref(null);

    const formatDateField = (value) => {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString("fr-FR", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const fetchSharedUsers = async (item) => {
        if (!item) return [];
        const isFolder = item.type === "folder";
        const id = isFolder ? item.folder_id : item.file_id;
        if (!id) return [];

        const endpoint = isFolder
            ? `${API_URL}/drive/folder/${id}/InfoItem`
            : `${API_URL}/drive/file/${id}/InfoItem`;

        try {
            const res = await fetchWithAuth(endpoint, { method: "GET" });
            if (!res.ok) throw new Error("Failed to fetch shared users");
            const data = await res.json();
            const list = data.shared_users || data.sharedPersons || data.shared || data;
            if (!Array.isArray(list)) return [];
            return list.map((person) => ({
                username: person.username || person.name || person.email || String(person),
                permission: person.permission || person.access || person.role || "Accès",
                user_id: person.user_id || person.id || null,
            }));
        } catch (error) {
            console.error("Error fetching shared users", error);
            addNotification?.({
                title: "Partage",
                message: "Impossible de charger les partages.",
                duration: 3000,
            });
            return [];
        }
    };

    const buildInfo = async (itemEntry) => {
        if (!itemEntry) return null;
        const [fallbackId, item] = itemEntry;
        const meta = item?.metadata || {};
        const id = item.file_id || item.folder_id || fallbackId;
        const sizeRaw = item.folder_size || item.size || meta.file_size || meta.size;
        const size =
            sizeRaw !== null && sizeRaw !== undefined
                ? formatBytes(Number(sizeRaw))
                : "—";
        const sharedPersons = await fetchSharedUsers(item);

        return {
            id: String(id),
            name: meta.folder_name || meta.filename || item.name || item._name || "—",
            type: item.type === "folder" ? "Dossier" : meta.mime_type || meta.type || "Fichier",
            size,
            created: formatDateField(
                meta.created_at || meta.creation_date || meta.createdAt || item.created_at,
            ),
            modified: formatDateField(
                meta.modified_at || meta.updated_at || meta.updatedAt || item.updated_at,
            ),
            owner: meta.owner || meta.owner_name || meta.ownerName || item.owner || "—",
            sharedPersons,
        };
    };

    const infoItemData = computed(() => infoItem.value);

    const closeInfoPanel = () => {
        clearSelection?.();
        infoPanelVisible.value = false;
        infoItem.value = null;
    };

    const handleRevokeAccess = (sharedUser) => {
        const itemId = infoItem.value?.id;
        if (!itemId) {
            console.error("No item selected to revoke access from");
            return;
        }
        console.log("Revoking access for user:", sharedUser, "on item:", itemId);

        // Trouver l'élément DOM correspondant
        const req = fetchWithAuth('/drive/revoke-access', {
            method: "POST",
            body: JSON.stringify({
                item_type: selectedItemsMap.value.get(itemId)?.type || "file",
                item_id: itemId,
                contact_id : sharedUser.user_id,
            }),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Failed to revoke access");
                addNotification?.({
                    title: "Partage",
                    message: `Accès révoqué pour ${sharedUser.username}`,
                    duration: 3000,
                });
                // Mettre à jour la liste des partages dans le panneau d'info
                infoItem.value.sharedPersons = infoItem.value.sharedPersons.filter(
                    (person) => person.username !== sharedUser.username,
                );
            })
            .catch((error) => {
                console.error("Error revoking access", error);
                addNotification?.({
                    title: "Partage",
                    message: "Impossible de révoquer l'accès.",
                    duration: 3000,
                });
            });

    };

    const handleRenameItem = (itemId) => {
        // Récupérer l'item complet depuis selectedItemsMap
        const item = selectedItemsMap.value.get(itemId);
        if (!item) {
            console.error("Item not found in selectedItemsMap");
            return;
        }

        // Trouver l'élément DOM correspondant
        const element = document.querySelector(`.item[data-item-id="${itemId}"]`);
        if (!element) {
            console.error("DOM element not found for item:", itemId);
            addNotification?.({
                title: "Erreur",
                message: "Impossible de trouver l'élément à renommer",
                duration: 3000,
            });
            return;
        }

        // Ajouter les données nécessaires au dataset de l'élément
        element.dataset.itemId = itemId;
        element.dataset.itemType = item.type;
        element.dataset.itemMetadata = JSON.stringify({
            ...item.metadata,
            encrypted_data_key: item.encrypted_file_key || item.encrypted_folder_key,
        });

        // Appeler la fonction de renommage existante
        renameItem(element);
        closeInfoPanel();
    };

    const handleDownloadItem = (itemId) => {
        // Récupérer l'item complet depuis selectedItemsMap
        const item = selectedItemsMap.value.get(itemId);
        if (!item) {
            console.error("Item not found in selectedItemsMap");
            return;
        }

        // downloadFile attend un objet directement
        if (item.type === "file") {
            downloadFile(item);
            closeInfoPanel();
        } else {
            addNotification?.({
                title: "Téléchargement",
                message: "Le téléchargement de dossiers n'est pas encore supporté",
                duration: 3000,
            });
        }
    };

    const handleDeleteItem = (itemId) => {
        // Récupérer l'item complet depuis selectedItemsMap
        const item = selectedItemsMap.value.get(itemId);
        if (!item) {
            console.error("Item not found in selectedItemsMap");
            return;
        }

        // Trouver l'élément DOM correspondant
        const element = document.querySelector(`.item[data-item-id="${itemId}"]`);
        if (!element) {
            console.error("DOM element not found for item:", itemId);
            addNotification?.({
                title: "Erreur",
                message: "Impossible de trouver l'élément à supprimer",
                duration: 3000,
            });
            return;
        }

        // Ajouter les données nécessaires au dataset de l'élément
        element.dataset.itemId = itemId;
        element.dataset.itemType = item.type;

        // Appeler la fonction de suppression existante
        deleteItem(element);
        closeInfoPanel();
    };

    const handleShareItem = (itemId) => {
        // Récupérer l'item complet depuis selectedItemsMap
        const item = selectedItemsMap.value.get(itemId);
        if (!item) {
            console.error("Item not found in selectedItemsMap");
            return;
        }

        // Trouver l'élément DOM correspondant
        const element = document.querySelector(`.item[data-item-id="${itemId}"]`);
        if (!element) {
            console.error("DOM element not found for item:", itemId);
            addNotification?.({
                title: "Erreur",
                message: "Impossible de trouver l'élément à partager",
                duration: 3000,
            });
            return;
        }

        // Ajouter les données nécessaires au dataset de l'élément
        element.dataset.itemId = itemId;
        element.dataset.itemType = item.type;
        element.dataset.itemMetadata = JSON.stringify(item.metadata);
        element.dataset.folderName = item.metadata?.folder_name;
        element.dataset.fileName = item.metadata?.filename;

        // Appeler la fonction de partage existante
        shareItem(element);
        closeInfoPanel();
    };

    // Note: n'ouvre plus automatiquement le panneau lors d'une simple sélection.
    // Appel explicite via `openInfoPanel` est requis (ex: depuis le menu contextuel).

    const openInfoPanel = async () => {
        const map = selectedItemsMap?.value;
        if (!map) return;
        const first = map.entries().next();
        if (first.done) {
            infoPanelVisible.value = false;
            infoItem.value = null;
            return;
        }
        infoPanelVisible.value = true;
        infoItem.value = await buildInfo(first.value);
    };

    return {
        infoPanelVisible,
        infoItemData,
        closeInfoPanel,
        handleRevokeAccess,
        handleRenameItem,
        handleDownloadItem,
        handleDeleteItem,
        handleShareItem,
        openInfoPanel,
    };
}
