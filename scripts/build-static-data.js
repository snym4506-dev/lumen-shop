/* ==========================================================================
   Lumen — static catalogue snapshot
   Produces `client/public/data/catalog.json`, the read-only product dataset
   used by the GitHub Pages build. The React source is unchanged: the static
   API adapter (client/src/lib/staticApi.js) speaks the same JSON shape as the
   Express REST API, so every page keeps rendering from the same components.

   Source of truth, in order:
     1. data/lumen.db   (whatever the running shop currently holds)
     2. data/catalog.js (the canonical 50-product seed data)

   Run with: node scripts/build-static-data.js
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'client', 'public', 'data');
const OUT_FILE = path.join(OUT_DIR, 'catalog.json');
const PLACEHOLDER = '/assets/img/placeholder.svg';

function safeJson(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const priceOf = (product) =>
  product.salePrice !== null && product.salePrice !== undefined
    ? product.salePrice
    : product.price;

function resolveDbPath() {
  try {
    require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
  } catch {
    /* dotenv is optional here */
  }
  return process.env.DB_PATH
    ? path.resolve(ROOT, process.env.DB_PATH)
    : path.join(ROOT, 'data', 'lumen.db');
}

/* Same shape as `rowToProduct()` in server.js. */
function fromDatabase() {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) return null;

  let db;
  try {
    ({ db } = require('../db'));
  } catch {
    return null;
  }

  const rows = db
    .prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id ASC')
    .all();

  if (!rows.length) return null;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    price: row.price,
    salePrice: row.sale_price,
    currentPrice: row.sale_price !== null ? row.sale_price : row.price,
    onSale: row.sale_price !== null,
    discountPercent:
      row.sale_price !== null && row.price > 0
        ? Math.round((1 - row.sale_price / row.price) * 100)
        : 0,
    category: row.category,
    brand: row.brand,
    imageUrl: row.image_url,
    additionalImages: safeJson(row.additional_images),
    stockQuantity: row.stock_quantity,
    inStock: row.stock_quantity > 0,
    sku: row.sku,
    isFeatured: Boolean(row.is_featured),
    isActive: Boolean(row.is_active),
    rating: row.rating,
    reviewCount: row.review_count,
    colors: safeJson(row.colors),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

/* Mirrors what seed.js writes into SQLite. */
function fromSeed() {
  const { products } = require('../data/catalog');

  return products.map((item, index) => {
    const onSale = Boolean(item.salePrice && item.salePrice > item.price);
    const regularPrice = onSale ? item.salePrice : item.price;
    const salePrice = onSale ? item.price : null;
    const createdAt = item.createdAt;

    return {
      id: index + 1,
      name: item.name,
      slug: item.slug,
      description: item.description,
      shortDescription: item.short,
      price: regularPrice,
      salePrice,
      currentPrice: salePrice !== null ? salePrice : regularPrice,
      onSale: salePrice !== null,
      discountPercent:
        salePrice !== null && regularPrice > 0
          ? Math.round((1 - salePrice / regularPrice) * 100)
          : 0,
      category: item.category,
      brand: item.brand,
      imageUrl: item.imageUrl,
      additionalImages: item.additionalImages,
      stockQuantity: item.stock,
      inStock: item.stock > 0,
      sku: item.sku,
      isFeatured: Boolean(item.featured),
      isActive: true,
      rating: item.rating,
      reviewCount: item.reviews,
      colors: item.colors,
      createdAt,
      updatedAt: createdAt
    };
  });
}

function buildCategories(products) {
  const byCategory = new Map();

  // server.js picks the category image from the first product ordered by
  // is_featured DESC, rating DESC, id ASC.
  const ranked = [...products].sort(
    (a, b) =>
      Number(b.isFeatured) - Number(a.isFeatured) ||
      b.rating - a.rating ||
      a.id - b.id
  );

  for (const product of ranked) {
    const entry = byCategory.get(product.category);
    if (entry) {
      entry.count += 1;
      entry.minPrice = Math.min(entry.minPrice, priceOf(product));
      entry.maxPrice = Math.max(entry.maxPrice, priceOf(product));
    } else {
      byCategory.set(product.category, {
        name: product.category,
        slug: slugify(product.category),
        count: 1,
        imageUrl: product.imageUrl || PLACEHOLDER,
        minPrice: priceOf(product),
        maxPrice: priceOf(product)
      });
    }
  }

  return [...byCategory.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );
}

function buildBrands(products) {
  const byBrand = new Map();
  for (const product of products) {
    byBrand.set(product.brand, (byBrand.get(product.brand) || 0) + 1);
  }
  return [...byBrand.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

function writeStaticData() {
  const fromDb = fromDatabase();
  const products = fromDb || fromSeed();

  if (!products.length) {
    throw new Error('No products found — cannot build the static catalogue.');
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: fromDb ? 'database' : 'seed',
    count: products.length,
    products,
    categories: buildCategories(products),
    brands: buildBrands(products)
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload)}\n`, 'utf8');

  return {
    file: OUT_FILE,
    count: products.length,
    source: payload.source,
    categories: payload.categories.length,
    brands: payload.brands.length
  };
}

if (require.main === module) {
  const info = writeStaticData();
  console.log(
    `✓ Static catalogue: ${info.count} products · ${info.categories} categories · ` +
      `${info.brands} brands (source: ${info.source})`
  );
  console.log(`  → ${path.relative(ROOT, info.file)}`);
}

module.exports = { writeStaticData };
