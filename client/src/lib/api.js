/* ==========================================================================
   Lumen — REST API client
   - AbortController support so superseded navigations stop downloading
   - Small in-memory cache for facets and product detail
   - In the GitHub Pages build (`VITE_STATIC=true`) the same interface is
     served from a generated JSON snapshot instead of Express.
   ========================================================================== */
import { clearStaticCache, createStaticApi } from './staticApi.js';

const STATIC_BUILD = import.meta.env.VITE_STATIC === 'true';
const BASE = '/api';
const TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const string = search.toString();
  return string ? `?${string}` : '';
}

async function request(path, options = {}) {
  const {
    signal,
    timeout = TIMEOUT_MS,
    cache: useCache = false,
    force = false,
    ttl = CACHE_TTL_MS,
    ...init
  } = options;

  if (useCache && !force) {
    const entry = cache.get(path);
    if (entry && Date.now() - entry.time < ttl) return entry.value;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      },
      signal: controller.signal
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      /* non-JSON error body */
    }

    if (!response.ok || !payload || payload.success !== true) {
      const error = new Error(
        (payload && payload.error && payload.error.message) ||
          `Request failed with status ${response.status}.`
      );
      error.status = response.status;
      error.code = payload && payload.error ? payload.error.code : 'HTTP_ERROR';
      error.details = payload && payload.error ? payload.error.details : undefined;
      throw error;
    }

    if (useCache) cache.set(path, { value: payload, time: Date.now() });
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (timedOut) {
        const timeoutError = new Error('The request timed out. Please try again.');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      const aborted = new Error('Request cancelled.');
      aborted.name = 'AbortError';
      throw aborted;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
}

export const api = STATIC_BUILD
  ? createStaticApi()
  : {
      listProducts(params = {}, options = {}) {
        return request(`/products${query(params)}`, options);
      },
      getProduct(idOrSlug, options = {}) {
        return request(`/products/${encodeURIComponent(idOrSlug)}`, { cache: true, ...options });
      },
      getFeatured(limit = 8, options = {}) {
        return request(`/products/featured${query({ limit })}`, { cache: true, ...options });
      },
      getCategories(options = {}) {
        return request('/categories', { cache: true, ...options });
      },
      getBrands(options = {}) {
        return request('/brands', { cache: true, ...options });
      },
      health(options = {}) {
        return request('/health', options);
      }
    };

export function clearApiCache() {
  cache.clear();
  if (STATIC_BUILD) clearStaticCache();
}
