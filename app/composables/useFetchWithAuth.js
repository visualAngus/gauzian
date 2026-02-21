/**
 * useFetchWithAuth
 * Helper pour faire des appels API avec Authorization header automatique
 */
export const useFetchWithAuth = () => {
  const { authToken, logout } = useAuth();
  const apiUrl = useApiUrl();

  /**
   * Fetch avec Authorization header automatique
   * @param {string} endpoint - Endpoint API (ex: '/files/list' ou URL complète)
   * @param {RequestInit} options - Options fetch standard
   * @returns {Promise<Response>}
   */
  const fetchWithAuth = async (endpoint, options = {}) => {
    // 1. Construction des headers
    const headers = {
      ...(options.headers || {})
    };

    // 2. Ajouter Authorization si token disponible
    if (authToken.value) {
      headers['Authorization'] = `Bearer ${authToken.value}`;
    }

    // 3. Pour FormData, ne pas définir Content-Type (auto par navigateur)
    //    Pour les autres cas, définir application/json par défaut
    if (!(options.body instanceof FormData)) {
      // Seulement si pas déjà défini
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
    // Note: Pour FormData, le navigateur ajoute automatiquement
    // Content-Type: multipart/form-data; boundary=...
    // Il ne faut JAMAIS le définir manuellement

    // 4. Merger options
    const fetchOptions = {
      ...options,
      headers
    };

    // 5. SUPPRIMER credentials: 'include' si présent (migration)
    delete fetchOptions.credentials;

    // 6. Construire URL complète
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${apiUrl}${endpoint}`;

    // 7. Appel fetch
    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (error) {
      // Propager l'AbortError tel quel pour que withRetry/workers puissent détecter l'annulation
      if (error.name === 'AbortError') {
        throw error;
      }
      // Erreur réseau (backend down, CORS, timeout, etc.)
      console.error('Network error:', error);
      throw new Error('Cannot connect to server');
    }

    // 8. Gestion erreur 401 (token expiré/invalide)
    if (response.status === 401) {
      console.warn('Session expirée (401), redirection vers login');
      await logout();
      throw new Error('Session expirée');
    }

    // 9. Validation du status HTTP
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    // 10. Retourner la response (le code appelant gère le reste)
    return response;
  };

  return { fetchWithAuth };
};
