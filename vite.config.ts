import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Proxy para contornar CORS durante desenvolvimento
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
