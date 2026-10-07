import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Базовый путь для деплоя подпапкой (GitHub Pages /family-hub/).
  // VITE_BASE_URL=/ — для корневых доменов (Vercel, Netlify, свой хостинг).
  base: process.env.VITE_BASE_URL ?? '/family-hub/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Краткий путь к src/: import ... from '@/config/supabase'
      '@': path.resolve(__dirname, './src'),
    },
  },
});
