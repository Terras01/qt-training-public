import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // In development the Vue app runs on Vite; API calls go to the Node server.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
