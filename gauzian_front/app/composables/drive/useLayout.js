import { ref, computed } from 'vue';

export function useLayout(API_URL) {
  const isSidebarOpen = ref(false);
  
  // Gestion du stockage
  const usedSpace = ref(0);
  const maxspace = ref(3 * 1024 * 1024 * 1024); // 3 GB
  const totalSpaceLeft = computed(() => maxspace.value - usedSpace.value);

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value;
  };

  return {
    isSidebarOpen,
    toggleSidebar,
    usedSpace,
    maxspace,
    totalSpaceLeft
  };
}