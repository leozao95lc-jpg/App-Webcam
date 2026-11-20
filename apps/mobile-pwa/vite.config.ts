import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalável no iOS via "Adicionar à Tela de Início" (Safari). Sem App Store, sem Mac.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'iCam Studio 4K',
        short_name: 'iCam 4K',
        description: 'Transforma o iPhone em webcam para o computador e o OBS',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#0b0e13',
        theme_color: '#0b0e13',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        // Rotas de API e a CA nunca são substituídas pelo fallback de navegação.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /\.crt$/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { outDir: 'dist', sourcemap: true, target: 'es2022' },
});
