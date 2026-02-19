// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/theme.css'],

  // Configuration runtime (accessible client-side)
  runtimeConfig: {
    public: {
      // La variable NUXT_PUBLIC_API_URL sera automatiquement mappée ici
      // Valeur par défaut pour le développement local
      apiUrl: 'https://gauzian.pupin.fr/api'
    }
  },

  // Configuration de sécurité
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          // HSTS
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
          // Anti-ClickJacking
          'X-Frame-Options': 'DENY',
          
          // Suppression de l'information du serveur
          'X-Powered-By': '',
          
          // Prévention du MIME-sniffing
          'X-Content-Type-Options': 'nosniff',
          
          // X-XSS-Protection retiré (obsolète, CSP le remplace)
          
          // Politique de référent
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          
          // Permissions Policy (anciennement Feature-Policy)
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          
          // Content Security Policy
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'", // unsafe-eval retiré (non nécessaire en production)
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            // Support multi-environnements : local, K8s, Clever Cloud
            "connect-src 'self' https://gauzian.pupin.fr https://*.cleverapps.io http://localhost:*",
            "frame-ancestors 'none'", // Anti-ClickJacking moderne
            "base-uri 'self'",
            "form-action 'self'"
          ].join('; ')
        }
      }
    }
  }
})