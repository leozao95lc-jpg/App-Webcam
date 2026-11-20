import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer do Electron. Carregado de arquivo em produção e de http://127.0.0.1:5174 em desenvolvimento.
export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  build: { outDir: 'dist-renderer', emptyOutDir: true, target: 'chrome130' },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
