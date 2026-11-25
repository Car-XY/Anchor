import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// frontend/ builds to frontend/dist, which flask serves.
// npm run dev runs on :5173 and proxies /api through to flask on :5000
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
