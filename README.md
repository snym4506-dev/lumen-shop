# Lumen — Curated Everyday Objects

A responsive storefront for a curated lifestyle shop, backed by **SQLite** and a
small **Node.js/Express REST API**. The frontend is a **React 19 + Vite
single-page app** in `client/`, bundled and served by the same Express process.
Every product on the home page, catalogue and detail pages comes from the
database — there are no hardcoded product arrays in the UI.

The catalogue ships with **exactly 50 products** across Audio, Wearables,
Photography, Footwear, Accessories, Home and Tech, plus locally stored product
photography so the shop never depends on remote image URLs.

The same React app also builds as a **fully static demo** for GitHub Pages
(`npm run build:pages`). That build reads a generated JSON snapshot instead of
the REST API, so the storefront — catalogue, search, filters, sorting,
pagination, product pages, cart, wishlist, promo codes and theme — runs with no
server at all. See [Static demo on GitHub Pages](#static-demo-on-github-pages).

---

## Highlights

- **SQLite product database** with a full product schema, indexes and WAL mode.
- **REST API** for listing, searching, filtering, sorting, pagination, product
  details, featured products, categories and brands.
- **Admin CRUD** protected by an API key (`x-api-key` or `Authorization: Bearer`).
- **React 19 SPA** with route-level `React.lazy` code splitting, a shared store
  context for cart, wishlist, promo codes, theme, toasts and panels, and
  `localStorage` persistence.
- **Dynamic storefront**:
  - `/products` — server-side search, category chips, brand filter, sorting,
    pagination, active-filter pills, loading skeletons, empty and error states.
  - `/products/:slug` — image gallery, full description, sale pricing, stock,
    SKU, related products, add-to-bag and wishlist.
  - `/` — featured grid, quick view, deal of the day and live category counts.
- **Performance work**: gzip/Brotli compression, immutable caching for hashed
  bundles, abortable API requests, an in-memory API cache, debounced search,
  memoized product cards, lazy images and no Bootstrap JavaScript payload.
- **Validation and sanitisation** on every write endpoint, consistent JSON
  responses, proper HTTP status codes, CORS and security headers.
- **Automated API suite** with 109 checks (`npm run test:api`).

---

## Requirements

- **Node.js 22.5 or newer** — the project uses the built-in `node:sqlite`
  module, so there are no native modules to compile. Tested on Node 24.
- npm 10+ (bundled with Node).

Check your version:

```bash
node --version
```

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
#    Windows (PowerShell)
Copy-Item .env.example .env
#    macOS / Linux
cp .env.example .env

# 3. Set a long random ADMIN_API_KEY in .env, then seed the database
npm run seed

# 4. Build the React storefront
npm run build

# 5. Start the server
npm start
```

Open **<http://localhost:3000>**.

For day-to-day development, run `npm run dev` instead. It starts the Express API
and the Vite dev server together; open **<http://localhost:5173>** for hot module
reload while `/api` and `/assets` are proxied to Express.

On Windows you can also double-click **`start-server.bat`**. It installs
dependencies, creates `.env` from `.env.example` if needed, seeds the database
the first time, builds the React app when `client/dist` is missing, then starts
the server and opens the browser. Set `ADMIN_API_KEY` in `.env` afterwards to
enable admin writes.

### Environment variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable        | Default        | Purpose                                                                 |
| --------------- | -------------- | ----------------------------------------------------------------------- |
| `PORT`          | `3000`         | HTTP port for the storefront and API.                                   |
| `DB_PATH`       | `data/lumen.db`| SQLite file, relative to the project root or absolute.                  |
| `CORS_ORIGIN`   | *(empty)*      | Comma-separated allowed browser origins. Empty means same-origin only.  |
| `ADMIN_API_KEY` | *(empty)*      | Secret required for admin writes. If empty, admin endpoints return 503. |
| `NODE_ENV`      | `development`  | Set to `production` to hide stack traces and enable long-lived caching. |

Generate a suitable key (PowerShell):

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).ToLower()
```

> `.env` is git-ignored. Never commit your real admin key.

---

## Scripts

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm start`         | Serve the built SPA and API from Express (`node server.js`).           |
| `npm run build`     | Build the React app into `client/dist`.                                |
| `npm run dev`       | Run the Express API and Vite dev server together with HMR.             |
| `npm run dev:server`| Run only Express with Node's watch mode.                               |
| `npm run dev:client`| Run only the Vite dev server.                                          |
| `npm run preview`   | Preview the production build with the Vite preview server.             |
| `npm run build:pages`| Build the static GitHub Pages demo into `client/dist-pages`.          |
| `npm run preview:pages`| Build and preview the static demo at <http://localhost:4174/lumen-shop/>. |
| `npm run seed`      | Download missing product images and rebuild the 50-product database.   |
| `npm run test:api`  | Run the API integration suite against a running server.               |

`npm run seed` is **destructive**: it clears the `products` table and inserts
the canonical 50 products again. Images are cached, so re-seeding does not
re-download files that already exist.

---

## Project structure

```
lumen-shop/
├─ server.js                 Express server, REST API, admin auth, SPA routes
├─ db.js                     SQLite connection, schema and indexes
├─ seed.js                   Image downloader + 50-product seeder
├─ client/
│  ├─ index.html             Vite SPA shell (theme pre-init + #root)
│  ├─ 404.html               Vite 404 shell (React not-found page, HTTP 404)
│  ├─ vite.config.mjs        Dev proxy, lazy chunks, /build asset directory
│  ├─ dist/                  Production build (created by `npm run build`)
│  ├─ dist-pages/            Static GitHub Pages build (`npm run build:pages`)
│  ├─ public/data/           Generated catalogue snapshot for the static demo
│  └─ src/
│     ├─ main.jsx            Mounts React and imports the shared CSS
│     ├─ App.jsx             Lazy routes + error boundary + store provider
│     ├─ pages/              Home, catalogue, product detail, 404
│     ├─ components/         Header, footer, cards, panels, quick view, toasts
│     ├─ context/            StoreContext — cart, wishlist, promo, theme, API cache
│     ├─ hooks/              Document meta and body-scroll lock
│     ├─ lib/                API client, static API, catalogue maths, storage
│     └─ styles/app.css      SPA-only glue (modal/toast display, skeletons)
├─ data/
│  ├─ catalog.js             Canonical 50-product seed data
│  └─ lumen.db               SQLite database (created by the seeder)
├─ scripts/
│  ├─ test-api.js            109-check API integration suite
│  ├─ build-static-data.js   Writes client/public/data/catalog.json
│  └─ build-static.js        Static GitHub Pages build (Vite + base path)
├─ .github/workflows/
│  └─ deploy-pages.yml       Builds and publishes the demo to GitHub Pages
├─ assets/
│  ├─ css/
│  │  ├─ style.css           Shared design system
│  │  └─ catalog.css         Catalogue and product-detail styles
│  └─ img/
│     ├─ products/           150 local product photos (primary + 2 alternates)
│     └─ placeholder.svg     Fallback for broken images
├─ .env.example
├─ package.json
└─ start-server.bat          Windows one-click launcher
```

Every page and UI component is a React JSX module under `client/src`. The
`assets/css` files are the shared design system; there are no standalone
`.html` storefront pages or vanilla JavaScript bundles left in the project.

The React app imports `assets/css/style.css` and `assets/css/catalog.css`
directly, so the visual design is shared rather than duplicated. Bootstrap and
Bootstrap Icons are bundled from npm; no CDN or Bootstrap JavaScript is loaded.

---

## Frontend architecture

- **Routing** — `client/src/App.jsx` lazy-loads the home, catalogue, product and
  not-found pages. `BrowserRouter` owns in-app navigation; Express serves
  `client/dist/index.html` for `/`, `/products` and `/products/:slug`, and
  `client/dist/404.html` with HTTP 404 for everything else. The static Pages
  build swaps in `HashRouter` so URLs such as `/#/products` work without a
  server rewrite.
- **State** — `StoreContext` hydrates the full catalogue from
  `GET /api/products?limit=100`, normalises every row, and exposes cart,
  wishlist, promo, theme, toast and panel state. Cart and wishlist writes use
  refs so rapid clicks never lose an update.
- **Catalogue URL state** — `useSearchParams` keeps `search`, `category`,
  `brand`, `sort` and `page` in the URL. Filter changes replace history; page
  changes push, so Back returns to the previous page.
- **Performance** — route-level code splitting keeps the initial payload small;
  `compression` gzips/Brotli-compresses responses; hashed `/build/*` assets are
  cached immutably for a year; API requests support `AbortController`; facets
  and product detail use a short in-memory cache; search is debounced; product
  cards are memoized; images are lazy-loaded and decoded asynchronously.
- **Accessibility** — Bootstrap CSS supplies layout primitives while React
  controls modal/offcanvas/toast visibility, focusable controls keep their
  labels, and Escape closes panels and quick view.

---

## Database

The `products` table contains:

| Column               | Type    | Notes                                                        |
| -------------------- | ------- | ------------------------------------------------------------ |
| `id`                 | INTEGER | Primary key, auto-increment.                                 |
| `name`               | TEXT    | Product name.                                                |
| `slug`               | TEXT    | Unique URL slug.                                             |
| `description`        | TEXT    | Full description.                                            |
| `short_description`  | TEXT    | Card / summary copy.                                         |
| `price`              | REAL    | Regular price.                                               |
| `sale_price`         | REAL    | Optional discounted price; must be lower than `price`.       |
| `category`           | TEXT    | One of the seven catalogue categories.                       |
| `brand`              | TEXT    | Brand name.                                                  |
| `image_url`          | TEXT    | Primary image (local path or http(s) URL).                   |
| `additional_images`  | TEXT    | JSON array of extra image URLs.                              |
| `stock_quantity`     | INTEGER | Units available (0 = out of stock).                          |
| `sku`                | TEXT    | Unique stock-keeping unit.                                   |
| `is_featured`        | INTEGER | `0` / `1`.                                                   |
| `is_active`          | INTEGER | `0` / `1`; soft-deleted products are inactive.               |
| `rating`             | REAL    | 0–5, one decimal.                                            |
| `review_count`       | INTEGER | Number of reviews.                                           |
| `colors`             | TEXT    | JSON array of hex colour swatches.                           |
| `created_at`         | TEXT    | ISO-8601 UTC timestamp.                                      |
| `updated_at`         | TEXT    | ISO-8601 UTC timestamp.                                      |

`rating`, `review_count` and `colors` are additional columns used by the
storefront (ratings, review counts and quick-view swatches).

Indexes cover `is_active`, `category`, `brand`, `is_featured`, `price` and
`created_at`. The database runs in WAL mode with foreign keys and a busy
timeout enabled.

### Seeded catalogue

| Category     | Products |
| ------------ | -------: |
| Audio        |       10 |
| Wearables    |        8 |
| Photography  |        7 |
| Footwear     |        7 |
| Accessories  |        8 |
| Home         |        6 |
| Tech         |        4 |
| **Total**    |   **50** |

Every product has a unique slug and SKU, realistic pricing (some on sale),
stock levels, ratings, review counts, colours, a primary image and two
alternate photos. Images live in `assets/img/products/` and are downloaded once
by the seeder.

---

## API reference

Base URL: `http://localhost:3000/api`

Successful responses use:

```json
{ "success": true, "data": ..., "meta": { ... } }
```

Errors use:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters.",
    "details": [{ "field": "limit", "message": "..." }]
  }
}
```

Product objects use camelCase keys (`shortDescription`, `salePrice`,
`currentPrice`, `onSale`, `discountPercent`, `imageUrl`, `additionalImages`,
`stockQuantity`, `inStock`, `isFeatured`, `isActive`, `reviewCount`,
`createdAt`, `updatedAt`).

### Endpoints

| Method | Path                        | Auth  | Description                              |
| ------ | --------------------------- | ----- | ---------------------------------------- |
| GET    | `/api/health`               | —     | Server status and active product count.  |
| GET    | `/api`                      | —     | API name, version and endpoint list.     |
| GET    | `/api/products`             | —     | Paginated product list.                  |
| GET    | `/api/products/featured`    | —     | Featured products.                       |
| GET    | `/api/products/:idOrSlug`   | —     | One product by numeric id **or** slug, plus `related`. |
| GET    | `/api/categories`           | —     | Categories with counts, image and price range. |
| GET    | `/api/brands`               | —     | Brands with product counts.              |
| POST   | `/api/products`             | Admin | Create a product.                        |
| PUT    | `/api/products/:id`         | Admin | Partially update a product.              |
| DELETE | `/api/products/:id`         | Admin | Soft-delete, or permanently delete with `?permanent=true`. |

#### `GET /api/products`

Query parameters:

| Parameter         | Default    | Description                                                        |
| ----------------- | ---------- | ------------------------------------------------------------------ |
| `page`            | `1`        | Page number, ≥ 1.                                                  |
| `limit`           | `12`       | Page size, 1–100.                                                  |
| `search`          | —          | Case-insensitive match on name, brand or category (max 100 chars). |
| `category`        | —          | Exact category name, case-insensitive.                             |
| `brand`           | —          | Exact brand name, case-insensitive.                                |
| `featured`        | —          | `true` / `false`.                                                  |
| `min_price`       | —          | Minimum current price (sale price when present).                   |
| `max_price`       | —          | Maximum current price.                                             |
| `sort`            | `featured` | `featured`, `newest`, `oldest`, `price-asc`, `price-desc`, `name-asc`, `name-desc`, `rating`. |
| `include_inactive`| `false`    | Admin only; include soft-deleted products when the key is valid.   |

Example:

```bash
curl "http://localhost:3000/api/products?category=Audio&sort=price-asc&page=1&limit=12"
```

Response metadata includes `page`, `limit`, `total`, `totalPages`, `count`,
`hasNextPage`, `hasPrevPage`, `sort` and the applied `filters`.

#### `GET /api/products/:idOrSlug`

Accepts either a numeric id or a slug:

```bash
curl http://localhost:3000/api/products/1
curl http://localhost:3000/api/products/aurora-wireless-headphones
```

The response includes up to four `related` products from the same category
(filled from other categories if needed). Inactive or missing products return
`404 NOT_FOUND`.

#### `GET /api/products/featured`

Returns active featured products, newest first. Optional `limit` (1–50,
default 8).

#### `GET /api/categories` / `GET /api/brands`

```json
{
  "success": true,
  "data": [
    {
      "name": "Audio",
      "slug": "audio",
      "count": 10,
      "imageUrl": "/assets/img/products/aurora-wireless-headphones.jpg",
      "minPrice": 39,
      "maxPrice": 349
    }
  ],
  "meta": { "total": 7 }
}
```

### Admin authentication

Send the key in either header:

```bash
# x-api-key
curl -H "x-api-key: $ADMIN_API_KEY" ...

# Bearer token
curl -H "Authorization: Bearer $ADMIN_API_KEY" ...
```

If `ADMIN_API_KEY` is not configured, admin endpoints return
`503 ADMIN_NOT_CONFIGURED`. A missing or wrong key returns
`401 UNAUTHORIZED`.

### Create a product

Required: `name`, `short_description`, `description` (≥ 10 chars), `price`,
`category`, `brand`, `image_url`.

Optional: `slug`, `sale_price`, `additional_images`, `stock_quantity`, `sku`,
`is_featured`, `is_active`, `rating`, `review_count`, `colors`.
Both snake_case and camelCase field names are accepted.

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{
    "name": "Halo Desk Lamp",
    "short_description": "Warm, dimmable task light.",
    "description": "A brushed-steel desk lamp with stepless dimming and a warm 2700K glow.",
    "price": 129,
    "sale_price": 99,
    "category": "Home",
    "brand": "Halo",
    "image_url": "/assets/img/products/halo-desk-lamp.jpg",
    "additional_images": ["/assets/img/products/halo-desk-lamp-2.jpg"],
    "stock_quantity": 18,
    "is_featured": true,
    "colors": ["#1c1c1e", "#e8e2d8"]
  }'
```

A generated slug and SKU are created when omitted. A client-supplied duplicate
slug or SKU returns `409 CONFLICT`.

PowerShell equivalent:

```powershell
$headers = @{ 'x-api-key' = $env:ADMIN_API_KEY; 'Content-Type' = 'application/json' }
$body = @{
  name = 'Halo Desk Lamp'
  short_description = 'Warm, dimmable task light.'
  description = 'A brushed-steel desk lamp with stepless dimming and a warm 2700K glow.'
  price = 129
  category = 'Home'
  brand = 'Halo'
  image_url = '/assets/img/products/halo-desk-lamp.jpg'
  stock_quantity = 18
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/products -Headers $headers -Body $body
```

### Update a product

`PUT /api/products/:id` accepts any subset of product fields. Setting
`"sale_price": null` clears the sale price. Updating `is_active` to `true`
restores a soft-deleted product.

```bash
curl -X PUT http://localhost:3000/api/products/51 \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d '{"price": 119, "sale_price": 89, "stock_quantity": 12}'
```

### Delete a product

```bash
# Soft delete: is_active = 0, hidden from the public storefront
curl -X DELETE -H "x-api-key: $ADMIN_API_KEY" \
  http://localhost:3000/api/products/51

# Permanent delete
curl -X DELETE -H "x-api-key: $ADMIN_API_KEY" \
  "http://localhost:3000/api/products/51?permanent=true"
```

### Status codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| 200  | Success.                                                             |
| 201  | Product created.                                                     |
| 400  | Validation error, invalid JSON or unknown fields.                    |
| 401  | Missing or invalid admin key.                                        |
| 404  | Product or route not found.                                          |
| 409  | Duplicate slug or SKU.                                               |
| 503  | Admin API not configured (`ADMIN_API_KEY` empty).                    |
| 500  | Unexpected server error.                                             |

Error codes: `VALIDATION_ERROR`, `INVALID_JSON`, `UNAUTHORIZED`,
`ADMIN_NOT_CONFIGURED`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

---

## Storefront pages

All three pages are React components loaded lazily from `client/src/pages/`.

### `/`

- Featured grid fetched from the API (8 of 50, with load more).
- Live header search, category chips, sorting and quick view.
- Deal of the day selected from the API with a live countdown.
- Live category counts and images from `/api/categories`.
- Reviews, FAQ accordion, newsletter validation and welcome toast.
- Cart, wishlist, promo codes and theme toggle.

### `/products`

- Responsive grid: 2 columns on phones, 3 on tablets, 4 on desktop.
- Search, category chips (horizontally scrollable on small screens), brand
  filter, sorting and server-side pagination (12 per page).
- URL state for `search`, `category`, `brand`, `sort` and `page`, so views are
  linkable and survive refresh/back. Search input is debounced; filters replace
  history and page changes push.
- Loading skeletons, empty state, retryable error state and active-filter pills.
- Product cards show image, name, rating, price/sale price, category and
  availability, with a details link.

### `/products/:slug`

- Gallery with thumbnails and image fallback.
- Full description, short description, brand, category, SKU, rating.
- Regular and sale pricing with discount badge.
- Stock badge, quantity stepper and add-to-bag.
- Wishlist toggle and related products.
- Dedicated 404 state for unknown/inactive products and a retryable error state
  for network or server failures.

### 404

Unknown server routes (anything other than `/`, `/products`, `/products/:slug`
and the API) return the React not-found page from `client/dist/404.html` with
HTTP status 404. Unknown in-app routes render the same `NotFoundPage` component
without a full reload.

---

## Static demo on GitHub Pages

GitHub Pages only serves static files, so the Express API and SQLite database
cannot run there. Instead the same React app is built against a JSON snapshot:

```bash
npm run build:pages     # → client/dist-pages
npm run preview:pages   # → http://localhost:4174/lumen-shop/
```

What the static build changes:

- `scripts/build-static-data.js` reads the live `data/lumen.db` when it exists
  (falling back to `data/catalog.js`) and writes
  `client/public/data/catalog.json` — all 50 products plus category and brand
  facets.
- `client/src/lib/staticApi.js` implements `listProducts`, `getProduct`,
  `getFeatured`, `getCategories` and `getBrands` against that snapshot,
  mirroring the Express response envelopes, filters, sorting and pagination.
  `client/src/lib/api.js` swaps it in when `VITE_STATIC=true`.
- `HashRouter` replaces `BrowserRouter`, so deep links look like
  `/#/products?category=Audio` and need no server rewrites.
- `assets/img` is copied into the build and every image URL is prefixed with
  Vite's `base`, so the site works from a project sub-path.
- Output goes to `client/dist-pages` so it never overwrites the Express build in
  `client/dist`.

Nothing in `pages/`, `components/` or `context/` is duplicated — it is one
codebase with two data sources.

### Publishing

`.github/workflows/deploy-pages.yml` builds and deploys the demo on every push
to `main`:

1. Push the repository to GitHub (branch `main`).
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push again, or run the workflow from the **Actions** tab.

The workflow sets the base path automatically from the repository name
(`/<repo>/`, or `/` for `<user>.github.io`). Override it locally with
`LUMEN_BASE`:

```bash
# PowerShell
$env:LUMEN_BASE='/my-repo/'; npm run build:pages
```

The static demo is read-only: admin create/update/delete and the REST API are
only available when you run the Express server locally or on a Node host.

---

## Testing

Start the server, then in another terminal:

```bash
npm run test:api
```

The suite reads `ADMIN_API_KEY` from `.env`, creates a temporary product, tests
validation and duplicate handling, updates it, soft-deletes it, restores it and
permanently deletes it. It leaves the catalogue at exactly **50** active
products.

Coverage includes:

- health and API discovery
- list defaults, pagination bounds, invalid query parameters
- search across name/brand/category, category and brand filters
- every sort mode
- featured products and detail by id/slug
- related products
- categories and brands
- all 150 product images (HTTP 200 + `image/*`)
- admin auth (missing/wrong key)
- create, duplicate slug/SKU, invalid payloads, invalid JSON
- update and invalid sale prices
- soft delete, restore, permanent delete
- storefront page routes, 404 page and final product count

Manual checks worth repeating after changes:

1. Home page loads products, deal and category counts with no console errors.
2. `/products` search, chips, brand, sort, pagination and URL state work.
3. A product detail page shows gallery, sale price, stock, SKU and related items.
4. Add to bag, wishlist, promo codes and theme toggle still work.
5. Layout has no horizontal overflow at 320, 390, 768 and 1440 px.
6. A deliberately broken image falls back to `assets/img/placeholder.svg`.

---

## Security notes

- Admin writes require `ADMIN_API_KEY`; comparisons use `crypto.timingSafeEqual`.
- Product input is length-checked, sanitised (HTML tags and control characters
  stripped) and validated against an allow-list of fields.
- Image URLs must be `http(s)` URLs or paths starting with `/`; `//host` is
  rejected.
- SQL uses prepared statements throughout.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
  `Permissions-Policy` headers are set; `x-powered-by` is disabled.
- CORS is same-origin by default. Add explicit origins through `CORS_ORIGIN`
  when serving the frontend elsewhere.
- Secrets belong in `.env`; only `.env.example` is committed.

---

## Troubleshooting

| Symptom                                   | Fix                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `node:sqlite` not found                   | Upgrade to Node.js 22.5 or newer.                                   |
| `EADDRINUSE` on port 3000                 | Stop the other process or set `PORT` in `.env`.                     |
| Admin requests return 503                 | Set `ADMIN_API_KEY` in `.env` and restart the server.               |
| Catalogue is empty                       | Run `npm run seed`.                                                 |
| Product images are missing                | Run `npm run seed` (it downloads only missing files).               |
| Storefront shows a blank page or 404      | `client/dist` is missing or stale. Run `npm run build`, then restart the server. |
| `Cannot find module 'client/dist/…'`      | Same fix: build the SPA with `npm run build`.                       |
| Frontend edits do not appear             | `npm start` serves the built bundle. Use `npm run dev` and open <http://localhost:5173>, or re-run `npm run build`. |
| CSS/JS edits do not appear                | Development serves assets with `Cache-Control: no-cache`; hard-refresh once if an old tab is still open. |
| `npm run build` fails                    | Fix the reported file/import error, then rebuild. Delete `client/dist` for a clean build. |
| GitHub Pages shows the README instead    | **Settings → Pages → Source** must be **GitHub Actions**, then re-run the workflow. |
| GitHub Pages demo loads but has no products | `client/public/data/catalog.json` was not generated. Run `npm run build:pages` (the workflow does this automatically). |
| GitHub Pages demo shows unstyled 404s    | The site was built for the wrong base path. Re-run with `LUMEN_BASE` set to `/<repo>/`. |
| `/api` calls fail in the dev server       | Make sure `npm run dev:server` (port 3000) is running so Vite can proxy `/api`. |
| Need a clean database                     | Delete `data/lumen.db*` and run `npm run seed`.                     |

---

## License

This is a demo project. Product names, brands and copy are fictional. Product
photography is sourced from Unsplash and stored locally for offline use.
