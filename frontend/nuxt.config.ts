export default defineNuxtConfig({
  compatibilityDate: '2026-11-04',

  devtools: {
    enabled: true,
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@clerk/nuxt',
  ],

  clerk: {
    publishableKey:
      process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.CLERK_PUBLISHABLE_KEY,
    proxyUrl: '/__clerk',
    signInUrl: '/login',
    signUpUrl: '/register',
    signInForceRedirectUrl: '/dashboard',
    signInFallbackRedirectUrl: '/dashboard',
    signUpForceRedirectUrl: '/auth/complete',
    signUpFallbackRedirectUrl: '/auth/complete',
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    clerk: {
      secretKey:
        process.env.NUXT_CLERK_SECRET_KEY ||
        process.env.CLERK_SECRET_KEY ||
        '',
    },
    apiBaseUrl:
      process.env.NUXT_API_BASE_URL ||
      process.env.NUXT_PUBLIC_API_BASE_URL ||
      'http://localhost:3001/api',
    public: {
      clerk: {
        publishableKey:
          process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
          process.env.CLERK_PUBLISHABLE_KEY ||
          '',
      },
      apiBase: '/api',
    },
  },
});
