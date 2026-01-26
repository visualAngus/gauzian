// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/theme.css'],
  
  // Configuration de sécurité
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          // Anti-ClickJacking
          'X-Frame-Options': 'DENY',
          
          // Suppression de l'information du serveur
          'X-Powered-By': '',
          
          // Prévention du MIME-sniffing
          'X-Content-Type-Options': 'nosniff',
          
          // Protection XSS (pour les navigateurs anciens)
          'X-XSS-Protection': '1; mode=block',
          
          // Politique de référent
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          
          // Permissions Policy (anciennement Feature-Policy)
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          
          // Content Security Policy
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Nuxt nécessite unsafe-inline/eval en dev
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self' https://gauzian.pupin.fr http://localhost:*",
            "frame-ancestors 'none'", // Anti-ClickJacking moderne
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; ')
        }
      }
    }
  }
})