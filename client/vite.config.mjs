import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

export default defineConfig({
  root,
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/assets': 'http://localhost:3000'
    },
    fs: {
      // The design system and product photography live one level above client/.
      allow: [projectRoot]
    }
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/assets': 'http://localhost:3000'
    }
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    // Keep hashed bundles out of /assets, which Express uses for images and CSS.
    assetsDir: 'build',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      // Two HTML entries: the SPA shell and the server-rendered 404 shell.
      // Both mount the same React app; the 404 shell just starts with a
      // not-found document title so crawlers and status checks see it.
      input: {
        main: path.join(root, 'index.html'),
        notFound: path.join(root, '404.html')
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('react')) return 'react';
          return 'vendor';
        }
      }
    }
  }
});
