import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Для GitHub Pages проект живёт в подпапке /family-hub/ (значение задаёт CI).
  // Локально и на других хостингах — корень '/'.
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Краткий путь к src/: import ... from '@/config/firebase'
      '@': path.resolve(__dirname, './src'),
    },
  },
});
