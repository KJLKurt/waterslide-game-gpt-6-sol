import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = repository ? `/${repository}/` : './';

export default defineConfig({
  base,
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'Splashline Racers', short_name: 'Splashline',
      description: 'A pocket-sized water slide race.',
      start_url: '.', scope: '.', display: 'standalone',
      background_color: '#dff7ff', theme_color: '#087bbd',
      orientation: 'any',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true
    }
  })]
});
