import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // A missing VITE_API_BASE_URL silently ships a bundle pointing at 127.0.0.1,
  // which works on the build machine and fails on every real device. Fail the
  // build instead so it cannot reach production unnoticed. Development is
  // exempt: there the localhost fallback is the intended behaviour.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiBase = env.VITE_API_BASE_URL?.trim() ?? ''

  // In development the localhost fallback in src/services/apiClient.ts is what
  // we want, so only enforce these for real builds. `npm run dev` must work with
  // no configuration at all.
  if (!apiBase && mode !== 'development') {
    throw new Error(
      'VITE_API_BASE_URL is not set.\n' +
        'Set it before building, e.g. VITE_API_BASE_URL=https://your-api.example.com/api/v1\n' +
        'It is inlined into the bundle at build time; setting it on the host after the build has no effect.',
    )
  }
  if (apiBase.startsWith('http://') && mode !== 'development') {
    throw new Error(
      `VITE_API_BASE_URL is http:// (${apiBase}). ` +
        'An HTTPS page cannot call an HTTP API -- browsers block it as mixed content. Use https://.',
    )
  }

  return {
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
  }
})