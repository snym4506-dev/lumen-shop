/* ==========================================================================
   Lumen — GitHub Pages build
   - writes the static catalogue snapshot (client/public/data/catalog.json)
   - runs Vite with LUMEN_TARGET=static → client/dist-pages
   - sets the correct base path for a GitHub project page

   Usage:
     npm run build:pages      build the static site
     npm run preview:pages    build, then serve it at http://localhost:4174
   ========================================================================== */
'use strict';

const path = require('node:path');
const { writeStaticData } = require('./build-static-data.js');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'client', 'vite.config.mjs');
const previewMode = process.argv.includes('--preview');

/* GitHub Actions exposes GITHUB_REPOSITORY as "owner/repo". A project page is
   served from /<repo>/, while <owner>.github.io is served from the root. */
function defaultBase() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  const name = repo.split('/')[1];
  if (!name) return '/lumen-shop/';
  if (name.toLowerCase().endsWith('.github.io')) return '/';
  return `/${name}/`;
}

async function main() {
  const info = writeStaticData();
  console.log(
    `✓ Static catalogue: ${info.count} products · ${info.categories} categories · ` +
      `${info.brands} brands (source: ${info.source})`
  );

  process.env.LUMEN_TARGET = 'static';
  process.env.LUMEN_BASE = process.env.LUMEN_BASE || defaultBase();

  const { build, preview } = await import('vite');

  if (previewMode) {
    const server = await preview({ configFile: CONFIG_FILE });
    server.printUrls();
    return;
  }

  console.log(`  base path: ${process.env.LUMEN_BASE}`);
  await build({ configFile: CONFIG_FILE });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
