import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Central de Monitoramento de Chamados RPA',
        short_name: 'RPA Minerva',
        description:
          'Dashboard de gestão e monitoramento de chamados RPA da Minerva Foods.',
        theme_color: '#1D2E40',
        background_color: '#1D2E40',
        display: 'standalone',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/(minervafoods|wiki\.minervafoods)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'minerva-assets',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/glpi': {
        target: 'https://central.minervafoods.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/glpi/, '/apirest.php'),
        secure: false,
      },
    },
  },
});
