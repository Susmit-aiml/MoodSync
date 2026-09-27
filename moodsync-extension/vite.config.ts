import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Custom plugin to ensure manifest.json is copied to dist
function copyManifestPlugin() {
  return {
    name: 'copy-manifest',
    closeBundle() {
      const srcManifest = resolve(__dirname, 'manifest.json');
      const distManifest = resolve(__dirname, 'dist/manifest.json');
      if (fs.existsSync(srcManifest)) {
        fs.mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
        const manifestContent = JSON.parse(fs.readFileSync(srcManifest, 'utf-8'));
        // In built dist, point to the bundled service worker
        manifestContent.background = {
          service_worker: 'service-worker.js',
          type: 'module',
        };
        fs.writeFileSync(distManifest, JSON.stringify(manifestContent, null, 2));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return 'service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
