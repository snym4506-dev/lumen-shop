/* ==========================================================================
   Lumen — SQLite connection & schema
   Uses Node's built-in `node:sqlite` (Node >= 22.5), so there are no native
   build dependencies to install.
   ========================================================================== */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH
  ? path.resolve(__dirname, process.env.DB_PATH)
  : path.join(DATA_DIR, 'lumen.db');

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS products (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    slug              TEXT    NOT NULL UNIQUE,
    description       TEXT    NOT NULL,
    short_description TEXT    NOT NULL,
    price             REAL    NOT NULL CHECK (price >= 0),
    sale_price        REAL             CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)),
    category          TEXT    NOT NULL,
    brand             TEXT    NOT NULL,
    image_url         TEXT    NOT NULL,
    additional_images TEXT    NOT NULL DEFAULT '[]',
    stock_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    sku               TEXT    NOT NULL UNIQUE,
    is_featured       INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    rating            REAL    NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    review_count      INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    colors            TEXT    NOT NULL DEFAULT '[]',
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_products_active       ON products (is_active);
  CREATE INDEX IF NOT EXISTS idx_products_category     ON products (category);
  CREATE INDEX IF NOT EXISTS idx_products_brand        ON products (brand);
  CREATE INDEX IF NOT EXISTS idx_products_featured     ON products (is_featured);
  CREATE INDEX IF NOT EXISTS idx_products_price        ON products (price);
  CREATE INDEX IF NOT EXISTS idx_products_created_at   ON products (created_at);
`);

module.exports = { db, DB_PATH, DATA_DIR };
