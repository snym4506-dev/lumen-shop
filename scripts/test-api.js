/* ==========================================================================
   Lumen — API integration test suite
   Exercises every public and admin endpoint against a running server.

   Usage:
     npm run test:api
     TEST_BASE_URL=http://localhost:3000 npm run test:api

   The suite creates a temporary product, soft-deletes it, restores it and
   permanently deletes it, leaving the catalogue at exactly 50 products.
   ========================================================================== */
'use strict';

require('dotenv').config();

const BASE = (process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const ADMIN_KEY = (process.env.ADMIN_API_KEY || '').trim();
const TEST_NAME_PREFIX = 'API Test Product';

let passed = 0;
let failed = 0;
const failures = [];
let createdId = null;

function group(name) {
  console.log(`\n${name}`);
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail });
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(method, path, { body, headers = {}, rawBody } = {}) {
  const options = { method, headers: { Accept: 'application/json', ...headers } };
  if (rawBody !== undefined) {
    options.body = rawBody;
    if (!options.headers['Content-Type']) options.headers['Content-Type'] = 'application/json';
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
    if (!options.headers['Content-Type']) options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, headers: response.headers, payload, text };
}

async function mapPool(items, limit, worker) {
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

const isSorted = (values, compare) => values.every((value, index) => index === 0 || compare(values[index - 1], value) <= 0);

async function cleanupTestProducts() {
  if (!ADMIN_KEY) return;
  const headers = { 'x-api-key': ADMIN_KEY };
  const listed = await request(
    'GET',
    `/api/products?search=${encodeURIComponent(TEST_NAME_PREFIX)}&limit=100&include_inactive=true`,
    { headers }
  );
  const leftovers = listed.payload && listed.payload.success ? listed.payload.data : [];
  for (const product of leftovers) {
    await request('DELETE', `/api/products/${product.id}?permanent=true`, { headers });
  }
  createdId = null;
}

const validNewProduct = (suffix) => ({
  name: `${TEST_NAME_PREFIX} ${suffix}`,
  short_description: 'A temporary product created by the API test suite.',
  description: 'This product is created and removed automatically by scripts/test-api.js to verify the admin endpoints.',
  price: 99.5,
  sale_price: 79.5,
  category: 'Tech',
  brand: 'Lumen Test',
  image_url: '/assets/img/products/aurora-wireless-headphones.jpg',
  additional_images: ['/assets/img/products/aurora-wireless-headphones-2.jpg'],
  stock_quantity: 7,
  is_featured: true,
  rating: 4.6,
  review_count: 12,
  colors: ['#111111', '#eeeeee']
});

async function run() {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  /* ---------------------------------------------------------------------
     Health & discovery
     --------------------------------------------------------------------- */
  group('Health & discovery');
  const health = await request('GET', '/api/health');
  check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);
  check('health payload has success=true', health.payload && health.payload.success === true);
  check('health reports exactly 50 active products', health.payload && health.payload.data.activeProducts === 50, `got ${health.payload && health.payload.data.activeProducts}`);

  const apiIndex = await request('GET', '/api');
  check('GET /api returns 200', apiIndex.status === 200);
  check('GET /api lists endpoints', Array.isArray(apiIndex.payload?.data?.endpoints) && apiIndex.payload.data.endpoints.length >= 6);

  /* ---------------------------------------------------------------------
     Product list: defaults, pagination, validation
     --------------------------------------------------------------------- */
  group('Product list');
  const list = await request('GET', '/api/products');
  check('GET /api/products returns 200', list.status === 200);
  check('default page size is 12', list.payload?.data?.length === 12, `got ${list.payload?.data?.length}`);
  check('default meta.total is 50', list.payload?.meta?.total === 50, `got ${list.payload?.meta?.total}`);
  check('default meta.totalPages is 5', list.payload?.meta?.totalPages === 5, `got ${list.payload?.meta?.totalPages}`);
  check('default meta.page is 1', list.payload?.meta?.page === 1);
  check('default meta.limit is 12', list.payload?.meta?.limit === 12);
  check('default hasNextPage is true', list.payload?.meta?.hasNextPage === true);
  check('default hasPrevPage is false', list.payload?.meta?.hasPrevPage === false);

  const lastPage = await request('GET', '/api/products?page=5');
  check('page 5 returns the remaining 2 products', lastPage.payload?.data?.length === 2, `got ${lastPage.payload?.data?.length}`);
  check('page 5 hasPrevPage is true', lastPage.payload?.meta?.hasPrevPage === true);
  check('page 5 hasNextPage is false', lastPage.payload?.meta?.hasNextPage === false);

  const all = await request('GET', '/api/products?limit=100');
  check('limit=100 returns all 50 products', all.payload?.data?.length === 50, `got ${all.payload?.data?.length}`);
  check('limit=100 meta.totalPages is 1', all.payload?.meta?.totalPages === 1);

  const badPage = await request('GET', '/api/products?page=0');
  check('page=0 is rejected with 400', badPage.status === 400, `got ${badPage.status}`);
  check('page=0 error code is VALIDATION_ERROR', badPage.payload?.error?.code === 'VALIDATION_ERROR');

  const badLimit = await request('GET', '/api/products?limit=101');
  check('limit=101 is rejected with 400', badLimit.status === 400, `got ${badLimit.status}`);

  const badSort = await request('GET', '/api/products?sort=cheapest');
  check('unknown sort is rejected with 400', badSort.status === 400, `got ${badSort.status}`);

  /* ---------------------------------------------------------------------
     Search, filters and sorting
     --------------------------------------------------------------------- */
  group('Search, filters & sorting');
  const search = await request('GET', '/api/products?search=aurora&limit=100');
  check('search=aurora returns results', search.payload?.meta?.total >= 1, `got ${search.payload?.meta?.total}`);
  check(
    'search matches name, brand or category',
    (search.payload?.data || []).every((product) =>
      [product.name, product.brand, product.category].some((value) =>
        String(value).toLowerCase().includes('aurora')
      )
    )
  );

  const noResults = await request('GET', '/api/products?search=zzzz-no-such-product');
  check('unmatched search returns an empty page', noResults.status === 200 && noResults.payload?.meta?.total === 0);

  const audio = await request('GET', '/api/products?category=Audio&limit=100');
  check('category=Audio returns 10 products', audio.payload?.meta?.total === 10, `got ${audio.payload?.meta?.total}`);
  check('category=Audio results all belong to Audio', (audio.payload?.data || []).every((product) => product.category === 'Audio'));

  const audioLower = await request('GET', '/api/products?category=audio&limit=100');
  check('category filter is case-insensitive', audioLower.payload?.meta?.total === 10, `got ${audioLower.payload?.meta?.total}`);

  const brands = await request('GET', '/api/brands');
  check('GET /api/brands returns 200', brands.status === 200);
  check('brand counts add up to 50', (brands.payload?.data || []).reduce((sum, brand) => sum + brand.count, 0) === 50);
  const firstBrand = brands.payload?.data?.[0];
  const brandList = await request('GET', `/api/products?brand=${encodeURIComponent(firstBrand.name)}&limit=100`);
  check(`brand=${firstBrand.name} returns its full count`, brandList.payload?.meta?.total === firstBrand.count, `expected ${firstBrand.count}, got ${brandList.payload?.meta?.total}`);
  check('brand results all match the filter', (brandList.payload?.data || []).every((product) => product.brand === firstBrand.name));

  const priceAsc = await request('GET', '/api/products?sort=price-asc&limit=100');
  check('price-asc is sorted low to high', isSorted(priceAsc.payload?.data || [], (a, b) => a.currentPrice - b.currentPrice));

  const priceDesc = await request('GET', '/api/products?sort=price-desc&limit=100');
  check('price-desc is sorted high to low', isSorted(priceDesc.payload?.data || [], (a, b) => b.currentPrice - a.currentPrice));

  const newest = await request('GET', '/api/products?sort=newest&limit=100');
  check('newest is sorted by createdAt descending', isSorted(newest.payload?.data || [], (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));

  const nameAsc = await request('GET', '/api/products?sort=name-asc&limit=100');
  check('name-asc is sorted A to Z', isSorted(nameAsc.payload?.data || [], (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())));

  const rating = await request('GET', '/api/products?sort=rating&limit=100');
  check('rating sort is descending', isSorted(rating.payload?.data || [], (a, b) => b.rating - a.rating));

  /* ---------------------------------------------------------------------
     Featured & single product
     --------------------------------------------------------------------- */
  group('Featured & product detail');
  const featured = await request('GET', '/api/products/featured?limit=5');
  check('GET /api/products/featured returns 200', featured.status === 200);
  check('featured returns at most 5 products', (featured.payload?.data || []).length <= 5);
  check('featured products are flagged isFeatured', (featured.payload?.data || []).every((product) => product.isFeatured === true));

  const badFeaturedLimit = await request('GET', '/api/products/featured?limit=0');
  check('featured limit=0 is rejected with 400', badFeaturedLimit.status === 400, `got ${badFeaturedLimit.status}`);

  const sample = all.payload.data[0];
  const byId = await request('GET', `/api/products/${sample.id}`);
  check('GET /api/products/:id returns 200', byId.status === 200);
  check('detail id matches the requested id', byId.payload?.data?.id === sample.id);
  check('detail includes a related array', Array.isArray(byId.payload?.data?.related));
  check('related products are limited to 4', (byId.payload?.data?.related || []).length <= 4);
  check('related products exclude the current product', (byId.payload?.data?.related || []).every((product) => product.id !== sample.id));
  check('related products are active', (byId.payload?.data?.related || []).every((product) => product.isActive === true));

  const bySlug = await request('GET', `/api/products/${encodeURIComponent(sample.slug)}`);
  check('GET /api/products/:slug returns 200', bySlug.status === 200);
  check('detail by slug matches the requested slug', bySlug.payload?.data?.slug === sample.slug);

  const missingSlug = await request('GET', '/api/products/definitely-not-a-real-product');
  check('unknown slug returns 404', missingSlug.status === 404, `got ${missingSlug.status}`);
  check('unknown slug error code is NOT_FOUND', missingSlug.payload?.error?.code === 'NOT_FOUND');

  const missingId = await request('GET', '/api/products/999999');
  check('unknown id returns 404', missingId.status === 404, `got ${missingId.status}`);

  const unknownRoute = await request('GET', '/api/does-not-exist');
  check('unknown API route returns JSON 404', unknownRoute.status === 404 && unknownRoute.payload?.success === false);

  /* ---------------------------------------------------------------------
     Categories & images
     --------------------------------------------------------------------- */
  group('Categories & images');
  const categories = await request('GET', '/api/categories');
  check('GET /api/categories returns 200', categories.status === 200);
  check('there are 7 categories', (categories.payload?.data || []).length === 7, `got ${(categories.payload?.data || []).length}`);
  check('category counts add up to 50', (categories.payload?.data || []).reduce((sum, category) => sum + category.count, 0) === 50);
  check(
    'categories include name, slug, count and price range',
    (categories.payload?.data || []).every(
      (category) =>
        typeof category.name === 'string' &&
        typeof category.slug === 'string' &&
        Number.isInteger(category.count) &&
        typeof category.minPrice === 'number' &&
        typeof category.maxPrice === 'number'
    )
  );

  const imageUrls = [];
  for (const product of all.payload.data) {
    imageUrls.push(product.imageUrl);
    for (const image of product.additionalImages || []) imageUrls.push(image);
  }
  const uniqueImages = Array.from(new Set(imageUrls));
  const imageResults = await mapPool(uniqueImages, 8, async (url) => {
    const absolute = /^https?:\/\//i.test(url) ? url : `${BASE}${url}`;
    try {
      const response = await fetch(absolute);
      return { url, ok: response.ok, type: response.headers.get('content-type') || '', status: response.status };
    } catch (error) {
      return { url, ok: false, type: '', status: error.message };
    }
  });
  const brokenImages = imageResults.filter((image) => !image.ok || !image.type.startsWith('image/'));
  check(`all ${uniqueImages.length} product images load`, brokenImages.length === 0, brokenImages.slice(0, 3).map((image) => `${image.url} (${image.status})`).join(', '));

  /* ---------------------------------------------------------------------
     Admin authentication
     --------------------------------------------------------------------- */
  group('Admin authentication');
  const noKey = await request('POST', '/api/products', { body: validNewProduct(suffix) });
  check('POST without a key returns 401', noKey.status === 401, `got ${noKey.status}`);
  check('401 error code is UNAUTHORIZED', noKey.payload?.error?.code === 'UNAUTHORIZED');

  const wrongKey = await request('POST', '/api/products', {
    body: validNewProduct(suffix),
    headers: { 'x-api-key': 'definitely-the-wrong-key' }
  });
  check('POST with a wrong key returns 401', wrongKey.status === 401, `got ${wrongKey.status}`);

  /* ---------------------------------------------------------------------
     Admin create / update / delete
     --------------------------------------------------------------------- */
  group('Admin create');
  const authHeaders = { 'x-api-key': ADMIN_KEY };
  const create = await request('POST', '/api/products', { body: validNewProduct(suffix), headers: authHeaders });
  check('POST with a valid key returns 201', create.status === 201, `got ${create.status}`);
  const created = create.payload?.data;
  createdId = created?.id;
  check('created product has an id', Number.isInteger(created?.id));
  check('created product is active', created?.isActive === true);
  check('created product generated a slug', typeof created?.slug === 'string' && /^[a-z0-9-]+$/.test(created.slug), created?.slug);
  check('created product generated an SKU', typeof created?.sku === 'string' && /^LUM-TEC-[A-F0-9]{6}$/.test(created.sku), created?.sku);
  check('created product exposes currentPrice', created?.currentPrice === 79.5, `got ${created?.currentPrice}`);
  check('created product is on sale with a discount', created?.onSale === true && created?.discountPercent === 20, `got ${created?.discountPercent}%`);
  check('created product keeps additional images', (created?.additionalImages || []).length === 1);
  check('created product keeps colours', (created?.colors || []).length === 2);

  const createdBySlug = await request('GET', `/api/products/${encodeURIComponent(created.slug)}`);
  check('created product is readable by slug', createdBySlug.status === 200 && createdBySlug.payload?.data?.id === created.id);

  const searchCreated = await request('GET', `/api/products?search=${encodeURIComponent(suffix)}&limit=100`);
  check('created product appears in search', searchCreated.payload?.meta?.total === 1, `got ${searchCreated.payload?.meta?.total}`);

  const duplicateSlug = await request('POST', '/api/products', {
    body: { ...validNewProduct(suffix), name: `${TEST_NAME_PREFIX} duplicate slug`, slug: created.slug },
    headers: authHeaders
  });
  check('duplicate slug returns 409', duplicateSlug.status === 409, `got ${duplicateSlug.status}`);
  check('duplicate slug error code is CONFLICT', duplicateSlug.payload?.error?.code === 'CONFLICT');

  const duplicateSku = await request('POST', '/api/products', {
    body: { ...validNewProduct(suffix), name: `${TEST_NAME_PREFIX} duplicate sku`, sku: created.sku },
    headers: authHeaders
  });
  check('duplicate SKU returns 409', duplicateSku.status === 409, `got ${duplicateSku.status}`);

  const invalidSale = await request('POST', '/api/products', {
    body: { ...validNewProduct(suffix), name: `${TEST_NAME_PREFIX} invalid sale`, price: 50, sale_price: 60 },
    headers: authHeaders
  });
  check('sale price above regular price returns 400', invalidSale.status === 400, `got ${invalidSale.status}`);
  check('sale price error names the field', (invalidSale.payload?.error?.details || []).some((detail) => detail.field === 'sale_price'));

  const missingFields = await request('POST', '/api/products', { body: { name: `${TEST_NAME_PREFIX} missing` }, headers: authHeaders });
  check('missing required fields return 400', missingFields.status === 400, `got ${missingFields.status}`);

  const unknownField = await request('POST', '/api/products', {
    body: { ...validNewProduct(suffix), name: `${TEST_NAME_PREFIX} unknown`, surprise: true },
    headers: authHeaders
  });
  check('unknown fields return 400', unknownField.status === 400, `got ${unknownField.status}`);

  const invalidJson = await request('POST', '/api/products', {
    rawBody: '{"name": ',
    headers: authHeaders
  });
  check('invalid JSON returns 400 INVALID_JSON', invalidJson.status === 400 && invalidJson.payload?.error?.code === 'INVALID_JSON', `got ${invalidJson.status} ${invalidJson.payload?.error?.code}`);

  group('Admin update');
  const updateNoKey = await request('PUT', `/api/products/${created.id}`, { body: { price: 89.5 } });
  check('PUT without a key returns 401', updateNoKey.status === 401, `got ${updateNoKey.status}`);

  const update = await request('PUT', `/api/products/${created.id}`, {
    body: { name: `${TEST_NAME_PREFIX} updated`, price: 89.5, sale_price: 69.5 },
    headers: { Authorization: `Bearer ${ADMIN_KEY}` }
  });
  check('PUT with a Bearer key returns 200', update.status === 200, `got ${update.status}`);
  check('PUT updated the name', update.payload?.data?.name === `${TEST_NAME_PREFIX} updated`);
  check('PUT updated the current price', update.payload?.data?.currentPrice === 69.5, `got ${update.payload?.data?.currentPrice}`);
  check('PUT recalculated the discount', update.payload?.data?.discountPercent === 22, `got ${update.payload?.data?.discountPercent}`);

  const invalidUpdate = await request('PUT', `/api/products/${created.id}`, {
    body: { price: 40, sale_price: 45 },
    headers: authHeaders
  });
  check('PUT with an invalid sale price returns 400', invalidUpdate.status === 400, `got ${invalidUpdate.status}`);

  const badUpdateId = await request('PUT', '/api/products/abc', { body: { price: 10 }, headers: authHeaders });
  check('PUT with a non-numeric id returns 400', badUpdateId.status === 400, `got ${badUpdateId.status}`);

  const missingUpdate = await request('PUT', '/api/products/999999', { body: { price: 10 }, headers: authHeaders });
  check('PUT on a missing product returns 404', missingUpdate.status === 404, `got ${missingUpdate.status}`);

  group('Admin delete, restore & purge');
  const deleteNoKey = await request('DELETE', `/api/products/${created.id}`);
  check('DELETE without a key returns 401', deleteNoKey.status === 401, `got ${deleteNoKey.status}`);

  const softDelete = await request('DELETE', `/api/products/${created.id}`, { headers: authHeaders });
  check('DELETE soft-deletes by default', softDelete.status === 200 && softDelete.payload?.data?.permanent === false, `got ${softDelete.status}`);
  check('soft delete marks the product inactive', softDelete.payload?.data?.isActive === false);

  const afterSoftDelete = await request('GET', `/api/products/${created.id}`);
  check('soft-deleted product is hidden from public detail', afterSoftDelete.status === 404, `got ${afterSoftDelete.status}`);

  const hiddenFromList = await request('GET', `/api/products?search=${encodeURIComponent(TEST_NAME_PREFIX)}&limit=100`);
  check('soft-deleted product is hidden from the public list', hiddenFromList.payload?.meta?.total === 0, `got ${hiddenFromList.payload?.meta?.total}`);

  const includeInactive = await request(
    'GET',
    `/api/products?search=${encodeURIComponent(TEST_NAME_PREFIX)}&limit=100&include_inactive=true`,
    { headers: authHeaders }
  );
  check('admin can list inactive products', includeInactive.payload?.meta?.total === 1, `got ${includeInactive.payload?.meta?.total}`);
  check('inactive product is flagged isActive=false', includeInactive.payload?.data?.[0]?.isActive === false);

  const restore = await request('PUT', `/api/products/${created.id}`, {
    body: { is_active: true },
    headers: authHeaders
  });
  check('PUT restores a soft-deleted product', restore.status === 200 && restore.payload?.data?.isActive === true, `got ${restore.status}`);

  const afterRestore = await request('GET', `/api/products/${created.id}`);
  check('restored product is public again', afterRestore.status === 200, `got ${afterRestore.status}`);

  const purge = await request('DELETE', `/api/products/${created.id}?permanent=true`, { headers: authHeaders });
  check('permanent delete returns 200', purge.status === 200 && purge.payload?.data?.permanent === true, `got ${purge.status}`);
  createdId = null;

  const afterPurge = await request('GET', `/api/products/${created.id}`);
  check('permanently deleted product returns 404', afterPurge.status === 404, `got ${afterPurge.status}`);

  const purgeList = await request(
    'GET',
    `/api/products?search=${encodeURIComponent(TEST_NAME_PREFIX)}&limit=100&include_inactive=true`,
    { headers: authHeaders }
  );
  check('permanently deleted product is gone from admin lists', purgeList.payload?.meta?.total === 0, `got ${purgeList.payload?.meta?.total}`);

  /* ---------------------------------------------------------------------
     Storefront pages & final state
     --------------------------------------------------------------------- */
  group('Storefront pages & final state');
  for (const path of ['/', '/products', `/products/${encodeURIComponent(sample.slug)}`]) {
    const response = await fetch(`${BASE}${path}`);
    const body = await response.text();
    check(`GET ${path} serves HTML`, response.status === 200 && (response.headers.get('content-type') || '').includes('text/html'), `got ${response.status}`);
    check(`GET ${path} has a document title`, /<title>[^<]+<\/title>/i.test(body));
  }

  const notFoundPage = await fetch(`${BASE}/this-page-does-not-exist`);
  const notFoundBody = await notFoundPage.text();
  check('unknown page returns 404', notFoundPage.status === 404, `got ${notFoundPage.status}`);
  check('unknown page serves the styled 404 document', /<title>[^<]*not found[^<]*<\/title>/i.test(notFoundBody));

  const finalHealth = await request('GET', '/api/health');
  check('catalogue is back to exactly 50 active products', finalHealth.payload?.data?.activeProducts === 50, `got ${finalHealth.payload?.data?.activeProducts}`);
}

(async () => {
  console.log(`\nLumen API tests → ${BASE}`);
  if (!ADMIN_KEY) console.log('  ! ADMIN_API_KEY is empty — admin tests will fail.');

  try {
    await cleanupTestProducts();
    await run();
  } catch (error) {
    failed += 1;
    failures.push({ name: 'Unhandled test error', detail: error && error.stack ? error.stack : String(error) });
    console.error('\nUnhandled test error:', error);
  } finally {
    try {
      await cleanupTestProducts();
    } catch (error) {
      console.error('Cleanup failed:', error.message);
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    if (failures.length) {
      console.log('\nFailures:');
      for (const failure of failures) console.log(`  - ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
    }
    process.exitCode = failed === 0 ? 0 : 1;
  }
})();
