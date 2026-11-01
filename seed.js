/* ==========================================================================
   Lumen — database seeder
   - downloads one primary + two alternate photos per product into
     assets/img/products (cached on subsequent runs)
   - recreates the products table contents with exactly 50 products
   Run with: npm run seed
   ========================================================================== */
'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { products } = require('./data/catalog');
const { db, DB_PATH } = require('./db');

const IMG_DIR = path.join(__dirname, 'assets', 'img', 'products');
const PLACEHOLDER = path.join(__dirname, 'assets', 'img', 'placeholder.svg');

const VARIANTS = [
  { suffix: '', params: 'auto=format&fit=crop&w=1000&h=1000&q=82' },
  { suffix: '-2', params: 'auto=format&fit=crop&w=1400&h=900&crop=entropy&q=80' },
  { suffix: '-3', params: 'auto=format&fit=crop&w=900&h=1200&crop=entropy&q=80' }
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'LumenSeed/2.0 (+https://lumen.shop)' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.startsWith('image/')) throw new Error(`unexpected content-type: ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) throw new Error('image response too small');
  await fs.promises.writeFile(destination, buffer);
}

async function ensureImage(source, suffix, params, destination) {
  try {
    const stat = await fs.promises.stat(destination).catch(() => null);
    if (stat && stat.size > 1024) return 'cached';
  } catch {
    /* fall through to download */
  }

  const url = `https://images.unsplash.com/photo-${source}?${params}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await download(url, destination);
      return 'downloaded';
    } catch (error) {
      if (attempt === 3) {
        await fs.promises.copyFile(PLACEHOLDER, destination);
        return `fallback (${error.message})`;
      }
      await sleep(400 * attempt);
    }
  }
  return 'fallback';
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function seedDatabase() {
  const regularPrice = (item) =>
    item.salePrice && item.salePrice > item.price ? item.salePrice : item.price;
  const salePrice = (item) =>
    item.salePrice && item.salePrice > item.price ? item.price : null;

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM products');
    try {
      db.exec("DELETE FROM sqlite_sequence WHERE name = 'products'");
    } catch {
      /* sqlite_sequence is created lazily */
    }

    const insert = db.prepare(`
      INSERT INTO products (
        name, slug, description, short_description, price, sale_price,
        category, brand, image_url, additional_images, stock_quantity, sku,
        is_featured, is_active, rating, review_count, colors, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, 1, ?, ?, ?, ?, ?
      )
    `);

    for (const item of products) {
      insert.run(
        item.name,
        item.slug,
        item.description,
        item.short,
        regularPrice(item),
        salePrice(item),
        item.category,
        item.brand,
        item.imageUrl,
        JSON.stringify(item.additionalImages),
        item.stock,
        item.sku,
        item.featured ? 1 : 0,
        item.rating,
        item.reviews,
        JSON.stringify(item.colors),
        item.createdAt,
        item.createdAt
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function main() {
  await fs.promises.mkdir(IMG_DIR, { recursive: true });

  const tasks = [];
  for (const item of products) {
    for (const variant of VARIANTS) {
      tasks.push({
        source: item.source,
        params: variant.params,
        destination: path.join(IMG_DIR, `${item.slug}${variant.suffix}.jpg`),
        label: `${item.slug}${variant.suffix}`
      });
    }
  }

  console.log(`→ Downloading ${tasks.length} product images (cached files are skipped)…`);
  let done = 0;
  const results = await pool(tasks, 4, async (task) => {
    const result = await ensureImage(task.source, task.suffix, task.params, task.destination);
    done += 1;
    if (done % 15 === 0 || done === tasks.length) {
      process.stdout.write(`  ${done}/${tasks.length}\n`);
    }
    return result;
  });

  const failures = results.filter((result) => result.startsWith('fallback'));
  if (failures.length) {
    console.warn(`  ! ${failures.length} image(s) fell back to the local placeholder.`);
  }

  seedDatabase();

  const total = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const byCategory = db
    .prepare('SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY category')
    .all();

  console.log(`\n✓ Seeded ${total} products into ${DB_PATH}`);
  console.log(`  ${byCategory.map((row) => `${row.category}: ${row.count}`).join(' · ')}`);

  if (total !== 50) {
    throw new Error(`Expected exactly 50 products, found ${total}`);
  }

  db.close();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
