import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
          cacheId: 'onur-beta-0.1.0-beta.30',
        globIgnores: ['**/ocr/**', '**/three.module-*.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
      },
      includeAssets: ['onur-mark.svg', 'onur-192.png', 'onur-512.png'],
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
            src: 'onur-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'onur-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
