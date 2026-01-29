import { ref, computed } from 'vue';

export function useLayout(API_URL, addNotification) {
  const isSidebarOpen = ref(false);
  
  // Gestion du stockage
  const usedSpace = ref(0);
  const maxspace = ref(3 * 1024 * 1024 * 1024); // 3 GB
  const totalSpaceLeft = computed(() => maxspace.value - usedSpace.value);

  if (addNotification) {
    if (totalSpaceLeft.value < 0.1 * maxspace.value) {
      addNotification({ message: "Attention : Votre espace de stockage est presque plein.", title: "Espace de stockage faible", duration: 8000 });
    }
  }

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