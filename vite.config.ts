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
      registerType: 'autoUpdate',
      workbox: {
        cacheId: 'onur-beta-0.1.0-beta.49',
        globIgnores: ['**/ocr/**', '**/three.module-*.js'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: ['otoneuro-mark.png', 'otoneuro-mark-192.png', 'otoneuro-mark-512.png', 'otoneuro-horizontal.png'],
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
            src: 'otoneuro-mark-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'otoneuro-mark-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
