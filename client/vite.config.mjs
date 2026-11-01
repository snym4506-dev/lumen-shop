import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

/* `LUMEN_TARGET=static` is set by scripts/build-static.js for the GitHub Pages
   build. That build reads a JSON snapshot instead of the Express API, uses
   hash routing and writes to client/dist-pages so it never clobbers the
   server build in client/dist. */
const staticBuild = process.env.LUMEN_TARGET === 'static';
const base = staticBuild ? process.env.LUMEN_BASE || '/lumen-shop/' : '/';
const outDir = path.join(root, staticBuild ? 'dist-pages' : 'dist');

function copyStorefrontAssets() {
  return {
    name: 'lumen-copy-storefront-assets',
    apply: 'build',
    closeBundle() {
      if (!staticBuild) return;

      // Product photography and the fallback image live outside client/.
      fs.cpSync(path.join(projectRoot, 'assets', 'img'), path.join(outDir, 'assets', 'img'), {
        recursive: true
      });

      // GitHub Pages should serve the files exactly as built.
      fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    }
  };
}

export default defineConfig({
  root,
  base,
  plugins: [react(), copyStorefrontAssets()],
  define: {
    'import.meta.env.VITE_STATIC': JSON.stringify(staticBuild ? 'true' : 'false')
  },
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
    port: staticBuild ? 4174 : 4173,
    strictPort: true,
    // The static build ships its own images, so only the server build needs
    // the /assets proxy.
    proxy: staticBuild
      ? {}
      : {
          '/api': 'http://localhost:3000',
          '/assets': 'http://localhost:3000'
        }
  },
  build: {
    outDir,
    emptyOutDir: true,
    // Keep hashed bundles out of /assets, which the storefront uses for images.
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
