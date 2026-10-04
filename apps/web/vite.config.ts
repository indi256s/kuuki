import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const publicAsset = (name: string) => readFileSync(fileURLToPath(new URL(`./public/${name}`, import.meta.url)))

export default defineConfig(({ mode }) => ({
  base: mode === 'legacy' ? '/legacy/' : '/',
  publicDir: mode === 'legacy' ? false : undefined,
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'legacy' ? [{
      name: 'legacy-public-assets',
      transformIndexHtml: (html: string) => html.replace(/\s*<link rel="manifest"[^>]*\/>/, ''),
      generateBundle(this: { emitFile: (file: { type: 'asset'; fileName: string; source: Uint8Array }) => void }) {
        for (const name of ['kuuki.svg', 'apple-touch-icon.png']) {
          this.emitFile({ type: 'asset', fileName: name, source: publicAsset(name) })
        }
      },
    }] : []),
    ...(mode === 'legacy' ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['kuuki.svg', 'apple-touch-icon.png'],
      manifest: false, // Use our custom manifest.webmanifest
      workbox: {
        // Precache only critical static assets, use runtime caching for chunks
        globPatterns: ['**/*.{html,ico,png,svg}', '**/manifest*.{json,webmanifest}'],
        globIgnores: ['**/activate.html', '**/activate.js'],
        navigateFallbackDenylist: [/^\/activate(?:\.html|\.js)$/],
        runtimeCaching: [
          // Runtime cache for JS/CSS chunks — NetworkFirst ensures fresh hashed
          // assets are fetched after deploys (StaleWhileRevalidate served stale
          // index.html referencing old hashes that no longer exist on the server)
          {
            urlPattern: ({ url }) => /\.(?:js|css)$/.test(url.pathname) && url.pathname !== '/activate.js',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              networkTimeoutSeconds: 3,
            },
          },
          // Font caching
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    })]),
  ],
  build: {
    outDir: mode === 'legacy' ? 'dist-legacy' : 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Router (changes rarely, ~50 kB)
          // Note: React/React-DOM are bundled into main chunk since they're used everywhere
          'router': ['react-router-dom'],
          
          // React Query (changes rarely, ~50 kB)
          'react-query': ['@tanstack/react-query'],
          
          // Heavy chart library (~200 kB, lazy-loaded via AnalysisDeck)
          'recharts': ['recharts'],
          
          // Map library (~80 kB, used on dashboard)
          'maps': ['react-simple-maps'],
          
          // UI component library (~120 kB)
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-accordion',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-label',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
          ],
          
          // Form libraries (~60 kB)
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // i18n (~40 kB)
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          
          // Utilities (small, can group)
          'utils': ['clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'],
          
          // State management (~15 kB)
          'state': ['zustand'],

          // Data package (app-specific, changes with app logic)
          'data': ['@kuuki/data'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}))
