import { ref } from 'vue';
import { getKeyStatus } from '~/utils/crypto';

export function useAuth(API_URL) {
  const etat = ref("login");
  const loading = ref(false);

  const autologin = async (onSuccess) => {
    console.log("Attempting auto-login...");
    try {
      const res = await fetch(`${API_URL}/autologin`, {
        method: "GET",
        credentials: "include",
      });
      if (res.ok) {
        let is_ok = await getKeyStatus();
        if (!is_ok) {
          console.warn("Keys not found or invalid in IndexedDB during auto-login.");
        }
        if (is_ok) {
          console.log("Auto-login successful.");
          etat.value = "drive";
          // On appelle la fonction de chargement du drive une fois connecté
          if (onSuccess) onSuccess();
        }
      } else {
        console.log("No valid session found for auto-login.");
        etat.value = "login";
        window.location.href = "/login";
      }
    } catch (error) {
      console.error("Auto-login failed:", error);
      etat.value = "login";
      window.location.href = "/login";
    }
  };

  return {
    etat,
    loading,
    autologin
  };
}