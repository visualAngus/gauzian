// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  
  modules: [
    '@pinia/nuxt',
  ],
  
  css: [
    './app/styles.main.css',
  ],
  
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Gauzian',
      meta: [
        { name: 'description', content: 'Votre espace sécurisé' }
      ]
    }
  },
  
  components: {
    dirs: [
      '~/app/components'
    ]
  }
})
