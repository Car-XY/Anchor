import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// The frontend lives in ./frontend and builds to ./frontend/dist, which Flask
// serves in production and Electron loads through Flask.
// In development, `npm run dev` serves it on :5173 and proxies /api to Flask.
export default defineConfig({
  root: 'frontend',
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:5000' },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
