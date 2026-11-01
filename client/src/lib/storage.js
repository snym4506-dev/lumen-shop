/* Small localStorage helpers that never throw in private/blocked contexts. */
export const CART_KEY = 'lumen.cart.v1';
export const WISH_KEY = 'lumen.wishlist.v1';
export const PROMO_KEY = 'lumen.promo.v1';
export const THEME_KEY = 'lumen.theme.v1';
export const VISITED_KEY = 'lumen.visited.v1';

export function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable — the UI still works for this session */
  }
}

export function readFlag(key) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function writeFlag(key) {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* ignore */
  }
}
