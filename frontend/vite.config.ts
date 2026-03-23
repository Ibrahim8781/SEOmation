import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          if (id.includes('recharts')) {
            return 'charts-vendor';
          }
          if (id.includes('axios') || id.includes('zod') || id.includes('dayjs')) {
            return 'app-vendor';
          }
          return 'vendor';
        }
      }
    }
  }
});
