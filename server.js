/* ==========================================================================
   Lumen — Node/Express server
   - serves the static storefront and the dynamic /products pages
   - exposes a REST API backed by SQLite (node:sqlite)
   - protects admin mutations with an API key (x-api-key / Bearer)
   ========================================================================== */
'use strict';

require('dotenv').config();

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const { db, DB_PATH } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_API_KEY = (process.env.ADMIN_API_KEY || '').trim();
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const PUBLIC_DIR = __dirname;
const DIST_DIR = path.join(PUBLIC_DIR, 'client', 'dist');
const SPA_INDEX = path.join(DIST_DIR, 'index.html');
const SPA_404 = path.join(DIST_DIR, '404.html');

/* --------------------------------------------------------------------------
   CORS
   -------------------------------------------------------------------------- */
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, server-to-server) send no Origin.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) {
        // Same-origin by default. During local development the frontend is
        // served by this same server, so no cross-origin access is required.
        return callback(null, false);
      }
      return callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
    maxAge: 86400
  })
);

/* --------------------------------------------------------------------------
   General middleware
   -------------------------------------------------------------------------- */
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Gzip/Brotli the SPA bundles and JSON responses. Hashed assets are already
// compressed on disk, so skip them there.
app.use(compression());

/* --------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const ok = (res, data, meta, status = 200) => {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
};

const fail = (res, status, code, message, details) =>
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });

const safeJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const stripTags = (value) =>
  String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

const sanitizeText = (value) => stripTags(value);
const sanitizeSingleLine = (value) => stripTags(value).replace(/\s*\n+\s*/g, ' ');

const slugify = (value) =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const isValidSlug = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
const isValidSku = (value) => /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(value);

const isSafeUrl = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 600) return false;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseStringArray = (value, { max = 8, maxLength = 600 } = {}) => {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : null;
  if (!list) return null;
  const cleaned = list
    .map((entry) => sanitizeSingleLine(entry))
    .filter(Boolean)
    .slice(0, max);
  if (cleaned.some((entry) => entry.length > maxLength)) return null;
  return cleaned;
};

const parseColors = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 8);
  if (cleaned.some((entry) => !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(entry))) return null;
  return cleaned;
};

const toInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const toBoolean = (value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true') return true;
    if (normalized === '0' || normalized === 'false') return false;
    return null;
  }
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
};

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

function rowToProduct(row) {
  const salePrice = row.sale_price;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    price: row.price,
    salePrice,
    currentPrice: salePrice !== null ? salePrice : row.price,
    onSale: salePrice !== null,
    discountPercent:
      salePrice !== null && row.price > 0
        ? Math.round((1 - salePrice / row.price) * 100)
        : 0,
    category: row.category,
    brand: row.brand,
    imageUrl: row.image_url,
    additionalImages: safeJson(row.additional_images, []),
    stockQuantity: row.stock_quantity,
    inStock: row.stock_quantity > 0,
    sku: row.sku,
    isFeatured: Boolean(row.is_featured),
    isActive: Boolean(row.is_active),
    rating: row.rating,
    reviewCount: row.review_count,
    colors: safeJson(row.colors, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function uniqueSlug(base, excludeId = 0) {
  const root = base || 'product';
  let candidate = root;
  let counter = 2;
  while (db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(candidate, excludeId)) {
    candidate = `${root.slice(0, 72)}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function uniqueSku(base, excludeId = 0) {
  let candidate = base;
  let counter = 2;
  while (db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(candidate, excludeId)) {
    candidate = `${base.slice(0, 32)}-${counter}`;
    counter += 1;
  }
  return candidate;
}

function generateSku(category) {
  const prefix = (slugify(category).replace(/-/g, '').slice(0, 3) || 'GEN').toUpperCase();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return uniqueSku(`LUM-${prefix}-${suffix}`);
}

function getRawProduct(idOrSlug) {
  const asNumber = Number(idOrSlug);
  if (Number.isInteger(asNumber) && asNumber > 0) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(asNumber);
  }
  return db.prepare('SELECT * FROM products WHERE slug = ?').get(String(idOrSlug));
}

/* --------------------------------------------------------------------------
   Validation
   -------------------------------------------------------------------------- */
const CAMEL_TO_SNAKE = {
  shortDescription: 'short_description',
  salePrice: 'sale_price',
  imageUrl: 'image_url',
  additionalImages: 'additional_images',
  stockQuantity: 'stock_quantity',
  reviewCount: 'review_count',
  isFeatured: 'is_featured',
  isActive: 'is_active'
};

const ALLOWED_PRODUCT_KEYS = new Set([
  'name', 'slug', 'description', 'short_description', 'shortDescription', 'price',
  'sale_price', 'salePrice', 'category', 'brand', 'image_url', 'imageUrl',
  'additional_images', 'additionalImages', 'stock_quantity', 'stockQuantity',
  'sku', 'is_featured', 'isFeatured', 'is_active', 'isActive', 'rating',
  'review_count', 'reviewCount', 'colors'
]);

function unknownFields(body) {
  return Object.keys(body || {}).filter((key) => !ALLOWED_PRODUCT_KEYS.has(key));
}

function validateProduct(input, { partial = false, existing = null } = {}) {
  const errors = [];
  const values = {};
  const addError = (field, message) => errors.push({ field, message });

  // Accept both camelCase and snake_case field names, and normalise to the
  // database's snake_case columns before merging with an existing row.
  const normalized = {};
  for (const [key, value] of Object.entries(input || {})) {
    normalized[CAMEL_TO_SNAKE[key] || key] = value;
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(normalized, key);

  const source = partial && existing ? { ...existing, ...normalized } : normalized;
  const provided = (key) => (partial ? has(key) : true);

  const name = sanitizeSingleLine(source.name ?? '');
  if (provided('name')) {
    if (!name) addError('name', 'Name is required.');
    else if (name.length > 120) addError('name', 'Name must be 120 characters or fewer.');
    else values.name = name;
  }

  const shortDescription = sanitizeSingleLine(source.short_description ?? '');
  if (provided('short_description')) {
    if (!shortDescription) addError('short_description', 'Short description is required.');
    else if (shortDescription.length > 300) addError('short_description', 'Short description must be 300 characters or fewer.');
    else values.short_description = shortDescription;
  }

  const description = sanitizeText(source.description ?? '');
  if (provided('description')) {
    if (!description) addError('description', 'Description is required.');
    else if (description.length < 10) addError('description', 'Description must be at least 10 characters.');
    else if (description.length > 5000) addError('description', 'Description must be 5000 characters or fewer.');
    else values.description = description;
  }

  const category = sanitizeSingleLine(source.category ?? '');
  if (provided('category')) {
    if (!category) addError('category', 'Category is required.');
    else if (category.length > 60) addError('category', 'Category must be 60 characters or fewer.');
    else values.category = category;
  }

  const brand = sanitizeSingleLine(source.brand ?? '');
  if (provided('brand')) {
    if (!brand) addError('brand', 'Brand is required.');
    else if (brand.length > 60) addError('brand', 'Brand must be 60 characters or fewer.');
    else values.brand = brand;
  }

  const price = Number(source.price);
  if (provided('price')) {
    if (!Number.isFinite(price) || price < 0) addError('price', 'Price must be a number greater than or equal to 0.');
    else if (price > 1000000) addError('price', 'Price is unrealistically high.');
    else values.price = Math.round(price * 100) / 100;
  }

  const rawSalePrice = source.sale_price;
  if (provided('sale_price')) {
    if (rawSalePrice === null || rawSalePrice === '' || rawSalePrice === undefined) {
      values.sale_price = null;
    } else {
      const salePrice = Number(rawSalePrice);
      if (!Number.isFinite(salePrice) || salePrice < 0) {
        addError('sale_price', 'Sale price must be a number greater than or equal to 0.');
      } else {
        values.sale_price = Math.round(salePrice * 100) / 100;
      }
    }
  }

  const imageUrl = sanitizeSingleLine(source.image_url ?? '');
  if (provided('image_url')) {
    if (!imageUrl) addError('image_url', 'Image URL is required.');
    else if (!isSafeUrl(imageUrl)) addError('image_url', 'Image URL must be an http(s) URL or a path beginning with /.');
    else values.image_url = imageUrl;
  }

  if (provided('additional_images')) {
    const additional = parseStringArray(source.additional_images, { max: 8, maxLength: 600 });
    if (additional === null) {
      addError('additional_images', 'Additional images must be an array of up to 8 valid URLs.');
    } else if (additional.some((entry) => !isSafeUrl(entry))) {
      addError('additional_images', 'Each additional image must be an http(s) URL or a path beginning with /.');
    } else {
      values.additional_images = additional;
    }
  }

  const stockRaw = source.stock_quantity;
  if (provided('stock_quantity')) {
    if (stockRaw === undefined || stockRaw === null || stockRaw === '') {
      values.stock_quantity = 0;
    } else {
      const stock = toInteger(stockRaw);
      if (stock === null || stock < 0) addError('stock_quantity', 'Stock quantity must be a whole number greater than or equal to 0.');
      else values.stock_quantity = stock;
    }
  }

  const sku = sanitizeSingleLine(source.sku ?? '').toUpperCase();
  if (provided('sku')) {
    if (!sku) {
      values.sku = null; // generated after validation
    } else if (!isValidSku(sku)) {
      addError('sku', 'SKU must be 3–40 characters using letters, numbers and hyphens.');
    } else {
      values.sku = sku;
    }
  }

  const ratingRaw = source.rating;
  if (provided('rating')) {
    if (ratingRaw === undefined || ratingRaw === null || ratingRaw === '') {
      values.rating = 0;
    } else {
      const rating = Number(ratingRaw);
      if (!Number.isFinite(rating) || rating < 0 || rating > 5) addError('rating', 'Rating must be between 0 and 5.');
      else values.rating = Math.round(rating * 10) / 10;
    }
  }

  const reviewRaw = source.review_count;
  if (provided('review_count')) {
    if (reviewRaw === undefined || reviewRaw === null || reviewRaw === '') {
      values.review_count = 0;
    } else {
      const reviewCount = toInteger(reviewRaw);
      if (reviewCount === null || reviewCount < 0) addError('review_count', 'Review count must be a whole number greater than or equal to 0.');
      else values.review_count = reviewCount;
    }
  }

  const featuredRaw = source.is_featured;
  if (provided('is_featured')) {
    if (featuredRaw === undefined || featuredRaw === null || featuredRaw === '') {
      values.is_featured = 0;
    } else {
      const featured = toBoolean(featuredRaw);
      if (featured === null) addError('is_featured', 'is_featured must be true or false.');
      else values.is_featured = featured ? 1 : 0;
    }
  }

  const activeRaw = source.is_active;
  if (provided('is_active')) {
    if (activeRaw === undefined || activeRaw === null || activeRaw === '') {
      values.is_active = 1;
    } else {
      const active = toBoolean(activeRaw);
      if (active === null) addError('is_active', 'is_active must be true or false.');
      else values.is_active = active ? 1 : 0;
    }
  }

  if (provided('colors')) {
    const colors = parseColors(source.colors);
    if (colors === null) addError('colors', 'Colors must be an array of up to 8 hex colour values.');
    else values.colors = colors;
  }

  const slugRaw = source.slug;
  if (has('slug') && slugRaw !== undefined && slugRaw !== null && slugRaw !== '') {
    const slug = slugify(slugRaw);
    if (!isValidSlug(slug)) addError('slug', 'Slug must contain lowercase letters, numbers and hyphens only.');
    else values.slug = slug;
  } else if (!partial) {
    values.slug = null; // generated from the name
  }

  // Cross-field price check (works for both create and partial updates).
  const effectivePrice = values.price ?? (existing ? existing.price : undefined);
  const effectiveSale = values.sale_price !== undefined ? values.sale_price : existing ? existing.sale_price : null;
  if (
    effectivePrice !== undefined &&
    effectiveSale !== null &&
    effectiveSale !== undefined &&
    effectiveSale >= effectivePrice
  ) {
    addError('sale_price', 'Sale price must be lower than the regular price.');
  }

  return { errors, values };
}

function assertUnique(values, excludeId = 0) {
  if (values.slug) {
    const conflict = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(values.slug, excludeId);
    if (conflict) throw new ApiError(409, 'CONFLICT', `The slug "${values.slug}" is already in use.`, [{ field: 'slug', message: 'Slug must be unique.' }]);
  }
  if (values.sku) {
    const conflict = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(values.sku, excludeId);
    if (conflict) throw new ApiError(409, 'CONFLICT', `The SKU "${values.sku}" is already in use.`, [{ field: 'sku', message: 'SKU must be unique.' }]);
  }
}

/* --------------------------------------------------------------------------
   Authentication for admin mutations
   -------------------------------------------------------------------------- */
function isAdmin(req) {
  if (!ADMIN_API_KEY) return false;
  const headerKey = req.get('x-api-key') || '';
  const auth = req.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const supplied = headerKey || bearer;
  if (!supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(ADMIN_API_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return fail(res, 503, 'ADMIN_NOT_CONFIGURED', 'Admin API is not configured. Set ADMIN_API_KEY in the environment.');
  }
  if (!isAdmin(req)) {
    return fail(res, 401, 'UNAUTHORIZED', 'A valid admin API key is required in the x-api-key header.');
  }
  return next();
}

/* --------------------------------------------------------------------------
   API — health & discovery
   -------------------------------------------------------------------------- */
app.get('/api', (req, res) => {
  ok(res, {
    name: 'Lumen Products API',
    version: '2.0.0',
    documentation: '/README.md#api-reference',
    endpoints: [
      'GET /api/health',
      'GET /api/products',
      'GET /api/products/featured',
      'GET /api/products/:idOrSlug',
      'GET /api/categories',
      'GET /api/brands',
      'POST /api/products (admin)',
      'PUT /api/products/:id (admin)',
      'DELETE /api/products/:id (admin)'
    ]
  });
});

app.get('/api/health', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS count FROM products WHERE is_active = 1').get().count;
  ok(res, {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    activeProducts: count,
    database: path.basename(DB_PATH),
    timestamp: new Date().toISOString()
  });
});

/* --------------------------------------------------------------------------
   API — categories & brands
   -------------------------------------------------------------------------- */
app.get('/api/categories', (req, res) => {
  const rows = db
    .prepare(
      `SELECT category AS name,
              COUNT(*) AS count,
              MIN(COALESCE(sale_price, price)) AS min_price,
              MAX(COALESCE(sale_price, price)) AS max_price
         FROM products
        WHERE is_active = 1
        GROUP BY category
        ORDER BY category COLLATE NOCASE`
    )
    .all();

  const imageStmt = db.prepare(
    `SELECT image_url FROM products
      WHERE category = ? AND is_active = 1
      ORDER BY is_featured DESC, rating DESC, id ASC
      LIMIT 1`
  );

  const data = rows.map((row) => ({
    name: row.name,
    slug: slugify(row.name),
    count: row.count,
    imageUrl: imageStmt.get(row.name)?.image_url || '/assets/img/placeholder.svg',
    minPrice: row.min_price,
    maxPrice: row.max_price
  }));

  ok(res, data, { total: data.length });
});

app.get('/api/brands', (req, res) => {
  const rows = db
    .prepare(
      `SELECT brand AS name, COUNT(*) AS count
         FROM products
        WHERE is_active = 1
        GROUP BY brand
        ORDER BY brand COLLATE NOCASE`
    )
    .all();
  ok(res, rows, { total: rows.length });
});

/* --------------------------------------------------------------------------
   API — featured products (must be registered before /api/products/:id)
   -------------------------------------------------------------------------- */
app.get('/api/products/featured', (req, res) => {
  const rawLimit = req.query.limit === undefined ? 8 : toInteger(req.query.limit);
  if (rawLimit === null || rawLimit < 1 || rawLimit > 50) {
    return fail(res, 400, 'VALIDATION_ERROR', 'The limit parameter must be a whole number between 1 and 50.', [
      { field: 'limit', message: 'Use a value between 1 and 50.' }
    ]);
  }

  const rows = db
    .prepare(
      `SELECT * FROM products
        WHERE is_active = 1 AND is_featured = 1
        ORDER BY created_at DESC, id DESC
        LIMIT ?`
    )
    .all(rawLimit);

  return ok(res, rows.map(rowToProduct), { total: rows.length, limit: rawLimit });
});

/* --------------------------------------------------------------------------
   API — product list
   -------------------------------------------------------------------------- */
const SORT_MAP = {
  featured: 'is_featured DESC, created_at DESC, id DESC',
  newest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  'price-asc': 'COALESCE(sale_price, price) ASC, id ASC',
  'price-desc': 'COALESCE(sale_price, price) DESC, id DESC',
  'name-asc': 'name COLLATE NOCASE ASC, id ASC',
  'name-desc': 'name COLLATE NOCASE DESC, id DESC',
  rating: 'rating DESC, review_count DESC, id ASC'
};

app.get('/api/products', (req, res) => {
  const errors = [];
  const page = req.query.page === undefined ? 1 : toInteger(req.query.page);
  const limit = req.query.limit === undefined ? 12 : toInteger(req.query.limit);
  const sort = req.query.sort === undefined ? 'featured' : String(req.query.sort);
  const search = req.query.search === undefined ? '' : sanitizeSingleLine(req.query.search);
  const category = req.query.category === undefined ? '' : sanitizeSingleLine(req.query.category);
  const brand = req.query.brand === undefined ? '' : sanitizeSingleLine(req.query.brand);

  if (page === null || page < 1) errors.push({ field: 'page', message: 'page must be a whole number greater than or equal to 1.' });
  if (limit === null || limit < 1 || limit > 100) errors.push({ field: 'limit', message: 'limit must be a whole number between 1 and 100.' });
  if (!Object.prototype.hasOwnProperty.call(SORT_MAP, sort)) {
    errors.push({ field: 'sort', message: `sort must be one of: ${Object.keys(SORT_MAP).join(', ')}.` });
  }
  if (search.length > 100) errors.push({ field: 'search', message: 'search must be 100 characters or fewer.' });
  if (category.length > 60) errors.push({ field: 'category', message: 'category must be 60 characters or fewer.' });
  if (brand.length > 60) errors.push({ field: 'brand', message: 'brand must be 60 characters or fewer.' });

  const featuredFilter = req.query.featured;
  let featured = null;
  if (featuredFilter !== undefined && featuredFilter !== '') {
    featured = toBoolean(featuredFilter);
    if (featured === null) errors.push({ field: 'featured', message: 'featured must be true or false.' });
  }

  if (errors.length) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid query parameters.', errors);

  const where = [];
  const params = [];
  const adminRequest = isAdmin(req);
  const includeInactive = adminRequest && toBoolean(req.query.include_inactive) === true;

  if (!includeInactive) where.push('is_active = 1');
  if (search) {
    const needle = `%${escapeLike(search.toLowerCase())}%`;
    where.push("(LOWER(name) LIKE ? ESCAPE '\\' OR LOWER(brand) LIKE ? ESCAPE '\\' OR LOWER(category) LIKE ? ESCAPE '\\')");
    params.push(needle, needle, needle);
  }
  if (category) {
    where.push('LOWER(category) = LOWER(?)');
    params.push(category);
  }
  if (brand) {
    where.push('LOWER(brand) = LOWER(?)');
    params.push(brand);
  }
  if (featured !== null) {
    where.push('is_featured = ?');
    params.push(featured ? 1 : 0);
  }
  if (req.query.min_price !== undefined && req.query.min_price !== '') {
    const minPrice = Number(req.query.min_price);
    if (!Number.isFinite(minPrice) || minPrice < 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'min_price must be a number greater than or equal to 0.', [
        { field: 'min_price', message: 'Use a number greater than or equal to 0.' }
      ]);
    }
    where.push('COALESCE(sale_price, price) >= ?');
    params.push(minPrice);
  }
  if (req.query.max_price !== undefined && req.query.max_price !== '') {
    const maxPrice = Number(req.query.max_price);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'max_price must be a number greater than or equal to 0.', [
        { field: 'max_price', message: 'Use a number greater than or equal to 0.' }
      ]);
    }
    where.push('COALESCE(sale_price, price) <= ?');
    params.push(maxPrice);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM products ${whereSql}`).get(...params).count;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const rows = db
    .prepare(
      `SELECT * FROM products
       ${whereSql}
       ORDER BY ${SORT_MAP[sort]}
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return ok(res, rows.map(rowToProduct), {
    page,
    limit,
    total,
    totalPages,
    count: rows.length,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    sort,
    filters: {
      search: search || null,
      category: category || null,
      brand: brand || null,
      featured: featured === null ? null : featured,
      includeInactive
    }
  });
});

/* --------------------------------------------------------------------------
   API — single product (numeric id or slug)
   -------------------------------------------------------------------------- */
app.get('/api/products/:idOrSlug', (req, res) => {
  const raw = getRawProduct(req.params.idOrSlug);
  if (!raw || !raw.is_active) {
    return fail(res, 404, 'NOT_FOUND', 'Product not found.');
  }

  const product = rowToProduct(raw);

  let relatedRows = db
    .prepare(
      `SELECT * FROM products
        WHERE is_active = 1 AND category = ? AND id != ?
        ORDER BY is_featured DESC, rating DESC, id ASC
        LIMIT 4`
    )
    .all(raw.category, raw.id);

  if (relatedRows.length < 4) {
    const excludeIds = [raw.id, ...relatedRows.map((row) => row.id)];
    const placeholders = excludeIds.map(() => '?').join(', ');
    const fillers = db
      .prepare(
        `SELECT * FROM products
          WHERE is_active = 1 AND id NOT IN (${placeholders})
          ORDER BY is_featured DESC, rating DESC, id ASC
          LIMIT ?`
      )
      .all(...excludeIds, 4 - relatedRows.length);
    relatedRows = relatedRows.concat(fillers);
  }

  return ok(res, {
    ...product,
    related: relatedRows.map(rowToProduct)
  });
});

/* --------------------------------------------------------------------------
   API — admin create
   -------------------------------------------------------------------------- */
app.post('/api/products', requireAdmin, (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
    }

    const unknown = unknownFields(req.body);
    if (unknown.length) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Unknown fields are not allowed.', unknown.map((field) => ({ field, message: 'Unknown field.' })));
    }

    const { errors, values } = validateProduct(req.body, { partial: false });
    if (errors.length) return fail(res, 400, 'VALIDATION_ERROR', 'Product validation failed.', errors);

    // A client-supplied slug must be unique (409 on conflict); a generated
    // slug is de-duplicated automatically so creates never fail on that alone.
    values.slug = values.slug ? values.slug : uniqueSlug(slugify(values.name));
    values.sku = values.sku || generateSku(values.category);
    assertUnique(values, 0);

    const insert = db.prepare(`
      INSERT INTO products (
        name, slug, description, short_description, price, sale_price,
        category, brand, image_url, additional_images, stock_quantity, sku,
        is_featured, is_active, rating, review_count, colors, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `);

    const result = insert.run(
      values.name,
      values.slug,
      values.description,
      values.short_description,
      values.price,
      values.sale_price,
      values.category,
      values.brand,
      values.image_url,
      JSON.stringify(values.additional_images),
      values.stock_quantity,
      values.sku,
      values.is_featured,
      values.is_active,
      values.rating,
      values.review_count,
      JSON.stringify(values.colors)
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid));
    return ok(res, rowToProduct(row), undefined, 201);
  } catch (error) {
    return next(error);
  }
});

/* --------------------------------------------------------------------------
   API — admin update
   -------------------------------------------------------------------------- */
app.put('/api/products/:id', requireAdmin, (req, res, next) => {
  try {
    const id = toInteger(req.params.id);
    if (id === null || id < 1) return fail(res, 400, 'VALIDATION_ERROR', 'Product id must be a positive whole number.');

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return fail(res, 404, 'NOT_FOUND', 'Product not found.');

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
    }

    const unknown = unknownFields(req.body);
    if (unknown.length) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Unknown fields are not allowed.', unknown.map((field) => ({ field, message: 'Unknown field.' })));
    }
    const { errors, values } = validateProduct(req.body, { partial: true, existing });
    if (errors.length) return fail(res, 400, 'VALIDATION_ERROR', 'Product validation failed.', errors);

    if (values.sku === null) delete values.sku;
    assertUnique(values, id);

    const assignments = [];
    const params = [];
    for (const [column, value] of Object.entries(values)) {
      assignments.push(`${column} = ?`);
      params.push(Array.isArray(value) ? JSON.stringify(value) : value);
    }
    assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    params.push(id);

    db.prepare(`UPDATE products SET ${assignments.join(', ')} WHERE id = ?`).run(...params);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return ok(res, rowToProduct(row));
  } catch (error) {
    return next(error);
  }
});

/* --------------------------------------------------------------------------
   API — admin delete (soft by default)
   -------------------------------------------------------------------------- */
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const id = toInteger(req.params.id);
  if (id === null || id < 1) return fail(res, 400, 'VALIDATION_ERROR', 'Product id must be a positive whole number.');

  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return fail(res, 404, 'NOT_FOUND', 'Product not found.');

  const permanent = toBoolean(req.query.permanent) === true || toBoolean(req.query.hard) === true;
  if (permanent) {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return ok(res, { id, deleted: true, permanent: true });
  }

  db.prepare("UPDATE products SET is_active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
  return ok(res, { id, deleted: true, permanent: false, isActive: false });
});

/* --------------------------------------------------------------------------
   API 404 + error handler
   -------------------------------------------------------------------------- */
app.use('/api', (req, res) => {
  fail(res, 404, 'NOT_FOUND', `No API route matches ${req.method} ${req.originalUrl}.`);
});

/* --------------------------------------------------------------------------
   Static storefront & page routes
   -------------------------------------------------------------------------- */
app.use(
  '/assets',
  express.static(path.join(PUBLIC_DIR, 'assets'), {
    etag: true,
    // Long-lived caching is safe for a production deploy; in development we
    // always revalidate so edits to CSS/JS show up on the next reload.
    maxAge: IS_PRODUCTION ? '7d' : 0,
    setHeaders(res, filePath) {
      if (!IS_PRODUCTION || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

// Vite fingerprints everything under /build, so those files can be cached
// forever. The HTML shell must always revalidate so a deploy is picked up.
app.use(
  '/build',
  express.static(path.join(DIST_DIR, 'build'), {
    etag: true,
    maxAge: '1y',
    immutable: true
  })
);

const sendSpa = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SPA_INDEX, (error) => (error ? next(error) : undefined));
};

app.get('/', sendSpa);
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/products', sendSpa);
app.get('/products/', sendSpa);
app.get('/products/:slug', sendSpa);

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});
app.get('/README.md', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.type('text/markdown').sendFile(path.join(PUBLIC_DIR, 'README.md'));
});

app.use((req, res) => {
  res.status(404);
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SPA_404, (error) => {
    if (error) res.type('text/plain').send('404 — Page not found');
  });
});

/* --------------------------------------------------------------------------
   Error handler (must be registered last)
   -------------------------------------------------------------------------- */
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const wantsJson = req.path.startsWith('/api') || req.accepts(['html', 'json']) === 'json';
  if (!wantsJson) {
    console.error('[page error]', error);
    return res.status(500).type('text/plain').send('Something went wrong on the server.');
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return fail(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  if (error instanceof ApiError) {
    return fail(res, error.status, error.code, error.message, error.details);
  }
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(error.message || '')) {
    return fail(res, 409, 'CONFLICT', 'A product with that slug or SKU already exists.');
  }
  if (error.code === 'SQLITE_CONSTRAINT_CHECK' || /CHECK constraint failed/i.test(error.message || '')) {
    return fail(res, 400, 'VALIDATION_ERROR', 'The submitted product data violates a database constraint.');
  }

  console.error('[api error]', error);
  return fail(
    res,
    500,
    'INTERNAL_ERROR',
    IS_PRODUCTION ? 'Something went wrong on the server.' : error.message || 'Something went wrong on the server.'
  );
});

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */
function start() {
  const server = app.listen(PORT, () => {
    console.log(`\n  Lumen is running`);
    console.log(`  → Storefront  http://localhost:${PORT}/`);
    console.log(`  → Catalogue   http://localhost:${PORT}/products`);
    console.log(`  → API         http://localhost:${PORT}/api`);
    console.log(`  → Database    ${DB_PATH}`);
    if (!ADMIN_API_KEY) console.warn('  ! ADMIN_API_KEY is not set — admin endpoints will return 503.');
    console.log('');
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down.`);
    server.close(() => {
      try {
        db.close();
      } catch {
        /* already closed */
      }
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) start();

module.exports = { app, start, isAdmin, validateProduct, rowToProduct };
