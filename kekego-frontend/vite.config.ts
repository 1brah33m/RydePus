import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['pwa/icon-192.png'],
      manifest: {
        name: 'Rydepus - Campus Shuttle & Rides',
        short_name: 'Rydepus',
        description: 'Uber-inspired campus transportation and ride-sharing for students and drivers.',
        theme_color: '#000000',
        background_color: '#DBEAFE',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/pwa/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'rydepus-icons',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep the service worker out of `npm run dev` so edits always render
        // immediately. The PWA (prompt-based updates) only engages in builds.
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
  },
})