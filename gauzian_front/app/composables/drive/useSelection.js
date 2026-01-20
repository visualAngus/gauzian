import { ref } from 'vue';

export function useSelection(API_URL,click_on_item) {
  const selectedItems = ref(new Set());
  const selectedItemsMap = ref(new Map());

  const selectItem = (item, event) => {

    const itemId = item.type === "file" ? item.file_id : item.folder_id;
    const newSelectedItems = new Set(selectedItems.value);
    const newSelectedItemsMap = new Map(selectedItemsMap.value);

    // Gestion Ctrl / Meta
    if (event.ctrlKey || event.metaKey) {
      if (newSelectedItems.has(itemId)) {
        newSelectedItems.delete(itemId);
        newSelectedItemsMap.delete(itemId);
      } else {
        newSelectedItems.add(itemId);
        newSelectedItemsMap.set(itemId, item);
      }
    } else {
      // Sélection simple
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

  return {
    selectedItems,
    selectedItemsMap,
    selectItem,
    clearSelection
  };
}