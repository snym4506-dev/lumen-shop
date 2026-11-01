/* Shared catalogue maths and formatting. Product rows always come from the API. */
const BASE_URL = import.meta.env.BASE_URL || '/';

export const FREE_SHIPPING = 150;
export const SHIPPING_FLAT = 9.95;
export const PROMO_CODES = { LUMEN10: 0.1, WELCOME15: 0.15 };
export const PLACEHOLDER_IMAGE = `${BASE_URL}assets/img/placeholder.svg`;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
});

export const formatMoney = (value) => money.format(Number(value) || 0);

export const promoRate = (promo) => PROMO_CODES[promo] || 0;

export function normalizeProduct(input) {
  const salePrice = input.salePrice ?? input.sale_price ?? null;
  const regularPrice = Number(input.price) || 0;
  const currentPrice = salePrice !== null ? Number(salePrice) : regularPrice;
  const createdAt = input.createdAt || input.created_at || '';
  const ageDays = createdAt ? (Date.now() - new Date(createdAt).getTime()) / 86400000 : 999;
  const badge = salePrice !== null ? 'Sale' : ageDays < 18 ? 'New' : input.isFeatured ? 'Bestseller' : '';
  const image = input.imageUrl || input.image_url || PLACEHOLDER_IMAGE;
  const additional = input.additionalImages || input.additional_images || [];

  return {
    id: Number(input.id),
    name: input.name,
    slug: input.slug,
    category: input.category,
    brand: input.brand,
    price: currentPrice,
    oldPrice: salePrice !== null ? regularPrice : null,
    regularPrice,
    salePrice,
    rating: Number(input.rating) || 0,
    reviews: Number(input.reviewCount ?? input.review_count) || 0,
    image,
    images: Array.from(new Set([image, ...additional].filter(Boolean))),
    stock: Number(input.stockQuantity ?? input.stock_quantity) || 0,
    inStock: Boolean(input.inStock ?? (Number(input.stockQuantity ?? input.stock_quantity) > 0)),
    sku: input.sku || '',
    featured: Boolean(input.isFeatured ?? input.is_featured),
    isActive: input.isActive !== false,
    colors:
      Array.isArray(input.colors) && input.colors.length
        ? input.colors
        : ['#1c1c1e', '#e8e2d8', '#5b6f8a'],
    desc: input.description || '',
    short: input.shortDescription || input.short_description || '',
    badge,
    badgeType: salePrice !== null ? 'sale' : ageDays < 18 ? 'new' : input.isFeatured ? 'dark' : '',
    createdAt
  };
}

export function sanitiseCart(value) {
  if (!Array.isArray(value)) return [];
  const merged = new Map();
  for (const line of value) {
    const id = Number(line && line.id);
    if (!Number.isInteger(id) || id < 1) continue;
    const qty = Math.min(99, Math.max(1, parseInt(line.qty, 10) || 1));
    merged.set(id, Math.min(99, (merged.get(id) || 0) + qty));
  }
  return Array.from(merged, ([id, qty]) => ({ id, qty }));
}

export function sanitiseWishlist(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))
  );
}

export function discountPct(product) {
  if (!product || !product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

export function cartTotals(cart, getProduct, promo) {
  const subtotal = cart.reduce((sum, line) => {
    const product = getProduct(line.id);
    return sum + (product ? product.price * line.qty : 0);
  }, 0);
  const discount = subtotal * promoRate(promo);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FLAT;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}

export function cartCount(cart) {
  return cart.reduce((sum, line) => sum + line.qty, 0);
}

export function filterAndSortProducts(products, { category = 'all', search = '', sort = 'featured' } = {}) {
  const query = search.toLowerCase();
  const list = products.filter((product) => {
    const matchesCategory = category === 'all' || product.category === category;
    const haystack = `${product.name} ${product.category} ${product.brand} ${product.short} ${product.desc}`.toLowerCase();
    return matchesCategory && (!query || haystack.includes(query));
  });

  switch (sort) {
    case 'price-asc':
      list.sort((a, b) => a.price - b.price || a.id - b.id);
      break;
    case 'price-desc':
      list.sort((a, b) => b.price - a.price || b.id - a.id);
      break;
    case 'rating':
      list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
      break;
    case 'newest':
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
      break;
    default:
      list.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          new Date(b.createdAt) - new Date(a.createdAt) ||
          b.id - a.id
      );
  }
  return list;
}

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());

export function clampQuantity(value, stock) {
  const max = Math.max(1, Math.min(99, Number(stock) || 0));
  return Math.min(max, Math.max(1, Number(value) || 1));
}
