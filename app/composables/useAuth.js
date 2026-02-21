import { ref, computed, readonly } from 'vue';
import {
  decryptPrivateKeyPemWithPassword,
  encryptPrivateKeyPemWithPassword,
  generateRsaKeyPairPem,
  saveUserKeysToIndexedDb,
  getKeyStatus,
  generateRecordKey,
  clearAllKeys
} from '~/utils/crypto';

// Clé de storage
const TOKEN_STORAGE_KEY = 'gauzian_auth_token';

/**
 * Composable useAuth
 * Gère l'authentification avec JWT dans localStorage
 */
export const useAuth = () => {
  // État global partagé (useState DANS useAuth pour SSR-safe)
  const authToken = useState('authToken', () => null);
  const isAuthenticated = useState('isAuthenticated', () => false);
  const user = useState('authUser', () => null);

  // IMPORTANT : Lire localStorage EXPLICITEMENT à chaque appel
  // (la factory useState n'est pas fiable pour localStorage lors de hard refresh)
  if (import.meta.client && !authToken.value) {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      authToken.value = storedToken;
    }
  }

  const apiUrl = useApiUrl();

  /**
   * Login utilisateur
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const login = async (email, password) => {
    try {
      // 1. Envoyer requête login au backend
      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
        // Note: credentials: 'include' retiré (migration Authorization header)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();

      // 2. Vérifier que le backend retourne le token + champs crypto
      if (!data.token) {
        throw new Error('Backend did not return token');
      }

      // 3. Stocker token dans localStorage
      if (import.meta.client) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      authToken.value = data.token;

      // 4. Déchiffrer et stocker clés crypto dans IndexedDB
      if (data.encrypted_private_key && data.private_key_salt && data.iv && data.public_key) {
        const privateKeyPem = await decryptPrivateKeyPemWithPassword({
          encrypted_private_key: data.encrypted_private_key,
          private_key_salt: data.private_key_salt,
          iv: data.iv,
          password: password
        });

        await saveUserKeysToIndexedDb(privateKeyPem, data.public_key);
      }

      // 5. Mettre à jour l'état d'authentification
      isAuthenticated.value = true;
      user.value = {
        id: data.user_id,
        email: email
      };

      if (import.meta.dev) {
        console.log('Login successful, token stored in localStorage');
      }
    } catch (error) {
      if (import.meta.dev) {
        console.error('Login failed:', error);
      }
      throw error;
    }
  };

  /**
   * Register utilisateur
   * @param {string} username
   * @param {string} email
   * @param {string} password
   * @returns {Promise<string>} Recovery key (à télécharger)
   */
  const register = async (username, email, password) => {
    try {
      // 1. Générer paire de clés RSA-4096
      const { publicKey, privateKey } = await generateRsaKeyPairPem();

      // 2. Générer record key (pour métadonnées)
      const recovery_key_data = await generateRecordKey(privateKey);

      // 3. Sauvegarder clés dans IndexedDB
      await saveUserKeysToIndexedDb(privateKey, publicKey);

      // 4. Chiffrer clé privée avec mot de passe
      const cryptoPayload = await encryptPrivateKeyPemWithPassword(
        privateKey,
        password
      );

      // 5. Envoyer requête register au backend
      const response = await fetch(`${apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          public_key: publicKey,
          encrypted_private_key: cryptoPayload.encrypted_private_key,
          private_key_salt: cryptoPayload.private_key_salt,
          iv: cryptoPayload.iv,
          encrypted_record_key: recovery_key_data.encrypted_private_key_reco
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Register failed');
      }

      const data = await response.json();

      // 6. Vérifier que le backend retourne le token
      if (!data.token) {
        throw new Error('Backend did not return token');
      }

      // 7. Stocker token dans localStorage (auto-login après register)
      if (import.meta.client) {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      }
      authToken.value = data.token;

      // 8. Mettre à jour l'état d'authentification
      isAuthenticated.value = true;
      user.value = {
        id: data.user_id,
        email: email,
        username: username
      };

      if (import.meta.dev) {
        console.log('Register successful, token stored in localStorage');
      }

      // 9. Retourner recovery key pour téléchargement
      return recovery_key_data.recovery_key;
    } catch (error) {
      if (import.meta.dev) {
        console.error('Register failed:', error);
      }
      throw error;
    }
  };

  /**
   * Logout utilisateur
   * Efface token localStorage + clés IndexedDB
   */
  const logout = async () => {
    try {
      // 1. Notifier le backend (blacklist token Redis)
      if (authToken.value) {
        // Note: fetchWithAuth sera créé dans Phase 3, pour l'instant on peut utiliser fetch direct
        await fetch(`${apiUrl}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken.value}`
          }
        }).catch(err => {
          // Ignorer les erreurs (401 si token déjà expiré)
          if (import.meta.dev) {
            console.warn('Logout backend call failed:', err);
          }
        });
      }

      // 2. Effacer localStorage
      if (import.meta.client) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      authToken.value = null;

      // 3. Effacer IndexedDB (clés crypto)
      await clearAllKeys();

      // 4. Reset état authentification
      isAuthenticated.value = false;
      user.value = null;

      if (import.meta.dev) {
        console.log('Logout successful, token and keys cleared');
      }

      // 5. Rediriger vers login
      navigateTo('/login');
    } catch (error) {
      if (import.meta.dev) {
        console.error('Logout error:', error);
      }
      // Même en cas d'erreur, nettoyer l'état local
      if (import.meta.client) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      authToken.value = null;
      isAuthenticated.value = false;
      user.value = null;
      navigateTo('/login');
    }
  };

  /**
   * Valider la session (vérifier si token localStorage encore valide)
   * @returns {Promise<boolean>} true si session valide
   */
  const validateSession = async () => {
    const token = authToken.value;

    if (!token) {
      isAuthenticated.value = false;
      return false;
    }

    try {
      // Vérifier si token encore valide (appel autologin backend)
      const response = await fetch(`${apiUrl}/autologin`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Vérifier aussi que les clés crypto sont présentes dans IndexedDB
        const keysOk = await getKeyStatus();

        if (!keysOk) {
          if (import.meta.dev) {
            console.warn('Token valid but crypto keys missing in IndexedDB');
          }
          // Token valide mais clés absentes → forcer logout
          await logout();
          return false;
        }

        // Session valide
        isAuthenticated.value = true;
        if (import.meta.dev) {
          console.log('Session validated successfully');
        }
        return true;
      } else {
        // Token expiré ou invalide
        if (import.meta.dev) {
          console.warn('Session validation failed (401)');
        }
        await logout();
        return false;
      }
    } catch (error) {
      if (import.meta.dev) {
        console.error('Session validation error:', error);
      }
      // Erreur réseau → considérer session invalide
      await logout();
      return false;
    }
  };

  return {
    // État (readonly pour éviter mutations externes)
    isAuthenticated: readonly(isAuthenticated),
    authToken: readonly(authToken),
    user: readonly(user),

    // Actions
    login,
    register,
    logout,
    validateSession
  };
};
