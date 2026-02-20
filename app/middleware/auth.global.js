/**
 * Middleware global d'authentification
 * Vérifie la session utilisateur avant chaque navigation
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
    // Désactiver en développement local
  if (import.meta.dev) return;
  // Uniquement côté client (pas SSR)
  if (import.meta.server) return;

  const { isAuthenticated, validateSession } = useAuth();

  // Pages publiques (pas besoin d'auth)
  const publicPages = ['/login', '/'];
  if (publicPages.includes(to.path)) {
    // Si va vers /login et déjà authentifié, rediriger vers /drive
    if (to.path === '/login' && isAuthenticated.value) {
      return navigateTo('/drive');
    }
    // Autoriser accès aux pages publiques (index.vue gère sa propre redirection)
    return;
  }

  // Pages protégées : vérifier session
  if (!isAuthenticated.value) {
    // Tenter restauration depuis localStorage
    console.log('Session not active, attempting to restore from localStorage...');
    const restored = await validateSession();

    if (!restored) {
      // Pas de session valide → redirect login
      console.warn('No valid session, redirecting to /login');
      return navigateTo('/login');
    }
  }

  // Session valide, continuer
});
