import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { PWA_CACHE_ID, PWA_UPDATE_POLICY } from './src/pwa/policy.js'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: PWA_UPDATE_POLICY.registerType,
      injectRegister: PWA_UPDATE_POLICY.injectRegister,
      workbox: {
        cacheId: PWA_CACHE_ID,
        globIgnores: ['**/ocr/**', '**/three.module-*.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: PWA_UPDATE_POLICY.skipWaiting,
        clientsClaim: PWA_UPDATE_POLICY.clientsClaim,
      },
      includeAssets: [
        'favicon.ico',
        'favicon-32.png',
        'favicon-48.png',
        'otoneuro-apple-touch-icon.png',
        'otoneuro-app-192.png',
        'otoneuro-app-512.png',
        'otoneuro-app-maskable-192.png',
        'otoneuro-app-maskable-512.png',
        'otoneuro-mark.png',
        'otoneuro-horizontal.png',
      ],
      manifest: {
        name: 'ONUr Beta',
        short_name: 'ONUr',
        description: 'Aplicación clínica de Otoneuro Uruguay para sesiones, seguimiento y trazabilidad vestíbulo-visual.',
        theme_color: '#171717',
        background_color: '#F7F6F4',
        display: 'standalone',
        lang: 'es',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'otoneuro-app-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'otoneuro-app-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'otoneuro-app-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'otoneuro-app-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
