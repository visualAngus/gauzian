/**
 * Composable pour récupérer l'URL de l'API backend
 *
 * Utilise la configuration runtime de Nuxt pour permettre
 * la configuration via NUXT_PUBLIC_API_URL sans rebuild
 *
 * @returns {string} URL de l'API backend (sans trailing slash)
 */
export function useApiUrl() {
  const config = useRuntimeConfig();
  return config.public.apiUrl;
}
