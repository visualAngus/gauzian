import { ref } from 'vue';

export function useNotification() {
  const notifications = ref([]);

  const addNotification = (objet) => {
    let message, title, duration;
    message = objet.message || '';
    title = objet.title || 'Notification';
    duration = objet.duration || 5000;
    
    const id = Date.now();
    notifications.value.push({ id, title, message });
    console.log("Notification added:", { id, title, message });
    setTimeout(() => {
      removeNotification(id);
    }, duration);
  };

  const removeNotification = (id) => {
    console.log("Removing notification with id:", id);
    console.log("Before removal, notifications:", notifications.value);
    notifications.value = notifications.value.filter(n => n.id !== id);
  };

  return {
    notifications,
    addNotification,
    removeNotification
  };
}