import { ref } from 'vue';

export function useContextMenu() {
    const contextMenuVisible = ref(false);

    return {
        contextMenuVisible,
    };
}