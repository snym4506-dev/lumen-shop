import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { api } from '../lib/api.js';
import {
  PROMO_CODES,
  cartCount as countCart,
  cartTotals,
  normalizeProduct,
  promoRate,
  sanitiseCart,
  sanitiseWishlist
} from '../lib/catalog.js';
import {
  CART_KEY,
  PROMO_KEY,
  THEME_KEY,
  WISH_KEY,
  readStore,
  writeStore
} from '../lib/storage.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const catalogueRef = useRef(new Map());
  const cartRef = useRef([]);
  const wishlistRef = useRef([]);
  const hydrateRef = useRef(null);
  const hydrateAbortRef = useRef(null);
  const toastIdRef = useRef(0);

  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => sanitiseCart(readStore(CART_KEY, [])));
  const [wishlist, setWishlist] = useState(() => sanitiseWishlist(readStore(WISH_KEY, [])));
  const [promo, setPromo] = useState(() => {
    const saved = readStore(PROMO_KEY, '');
    return typeof saved === 'string' ? saved : '';
  });
  const [promoError, setPromoError] = useState('');
  const [theme, setTheme] = useState(() => {
    const saved = readStore(THEME_KEY, null);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [panel, setPanel] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');

  cartRef.current = cart;
  wishlistRef.current = wishlist;

  /* ---------------------------------------------------------------------
     Catalogue registry
     --------------------------------------------------------------------- */
  const register = useCallback((items, options = {}) => {
    const map = catalogueRef.current;
    for (const item of items || []) {
      if (item && item.id != null) map.set(Number(item.id), normalizeProduct(item));
    }

    if (options.authoritative) {
      const nextCart = sanitiseCart(cartRef.current).filter((line) => map.has(line.id));
      const nextWishlist = wishlistRef.current.filter((id) => map.has(Number(id)));
      cartRef.current = nextCart;
      wishlistRef.current = nextWishlist;
      setCart(nextCart);
      setWishlist(nextWishlist);
    }

    setProducts(Array.from(map.values()));
  }, []);

  const getProduct = useCallback((id) => catalogueRef.current.get(Number(id)) || null, []);

  const hydrate = useCallback(
    ({ force = false } = {}) => {
      if (hydrateRef.current && !force) return hydrateRef.current;

      if (hydrateAbortRef.current) hydrateAbortRef.current.abort();
      const controller = new AbortController();
      hydrateAbortRef.current = controller;

      setStatus('loading');
      setError(null);

      const promise = api
        .listProducts(
          { limit: 100, sort: 'featured' },
          { signal: controller.signal, cache: true, force }
        )
        .then((payload) => {
          register(payload.data || [], { authoritative: true });
          setStatus('ready');
          setError(null);
          return { products: payload.data || [], error: null };
        })
        .catch((requestError) => {
          if (requestError.name === 'AbortError') {
            return { products: [], error: null, aborted: true };
          }
          hydrateRef.current = null;
          setStatus('error');
          setError(requestError);
          return { products: [], error: requestError };
        });

      hydrateRef.current = promise;
      return promise;
    },
    [register]
  );

  const retryHydrate = useCallback(() => hydrate({ force: true }), [hydrate]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  /* ---------------------------------------------------------------------
     Persistence
     --------------------------------------------------------------------- */
  useEffect(() => {
    writeStore(CART_KEY, cart);
  }, [cart]);

  useEffect(() => {
    writeStore(WISH_KEY, wishlist);
  }, [wishlist]);

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    writeStore(THEME_KEY, theme);
  }, [theme]);

  /* ---------------------------------------------------------------------
     Toasts
     --------------------------------------------------------------------- */
  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((message, icon = 'bi-check-circle-fill') => {
    const id = (toastIdRef.current += 1);
    setToasts((current) => [...current, { id, message, icon }]);
    return id;
  }, []);

  /* ---------------------------------------------------------------------
     Cart
     --------------------------------------------------------------------- */
  const addToCart = useCallback(
    (id, qty = 1) => {
      const product = getProduct(id);
      if (!product) return;
      if (product.stock <= 0) {
        toast(`${product.name} is out of stock.`, 'bi-exclamation-circle');
        return;
      }

      const requested = Math.max(1, parseInt(qty, 10) || 1);
      const current = cartRef.current;
      const line = current.find((item) => item.id === product.id);
      const currentQty = line ? line.qty : 0;
      const nextQty = Math.min(product.stock, 99, currentQty + requested);

      if (nextQty <= currentQty) {
        toast(`Only ${product.stock} of ${product.name} available.`, 'bi-exclamation-circle');
        return;
      }

      const nextCart = line
        ? current.map((item) => (item.id === product.id ? { ...item, qty: nextQty } : item))
        : [...current, { id: product.id, qty: nextQty }];

      cartRef.current = nextCart;
      setCart(nextCart);
      toast(`${product.name} added to your bag`);
    },
    [getProduct, toast]
  );

  const changeQty = useCallback(
    (id, step) => {
      const current = cartRef.current;
      const line = current.find((item) => item.id === Number(id));
      if (!line) return;

      const product = getProduct(line.id);
      let nextQty = line.qty + Number(step || 0);
      let nextCart;

      if (nextQty <= 0) {
        nextCart = current.filter((item) => item.id !== line.id);
      } else {
        nextQty = Math.min(99, product ? product.stock : 99, nextQty);
        nextCart = current.map((item) =>
          item.id === line.id ? { ...item, qty: nextQty } : item
        );
      }

      cartRef.current = nextCart;
      setCart(nextCart);
    },
    [getProduct]
  );

  const removeFromCart = useCallback(
    (id) => {
      const product = getProduct(id);
      const nextCart = cartRef.current.filter((item) => item.id !== Number(id));
      cartRef.current = nextCart;
      setCart(nextCart);
      if (product) toast(`${product.name} removed from your bag`, 'bi-bag-x');
    },
    [getProduct, toast]
  );

  /* ---------------------------------------------------------------------
     Promo codes
     --------------------------------------------------------------------- */
  const applyPromo = useCallback(
    (rawCode) => {
      const code = String(rawCode || '').trim().toUpperCase();

      if (!code) {
        setPromoError('Enter a code to apply it.');
        return false;
      }

      if (PROMO_CODES[code]) {
        setPromo(code);
        setPromoError('');
        writeStore(PROMO_KEY, code);
        toast(`${Math.round(PROMO_CODES[code] * 100)}% off applied with ${code}`);
        return true;
      }

      setPromo('');
      setPromoError('That code is not valid. Try LUMEN10.');
      writeStore(PROMO_KEY, '');
      return false;
    },
    [toast]
  );

  const clearPromoError = useCallback(() => {
    setPromoError((current) => (current ? '' : current));
  }, []);

  /* ---------------------------------------------------------------------
     Wishlist
     --------------------------------------------------------------------- */
  const toggleWish = useCallback(
    (id) => {
      const product = getProduct(id);
      if (!product) return;

      const exists = wishlistRef.current.includes(product.id);
      const nextWishlist = exists
        ? wishlistRef.current.filter((item) => item !== product.id)
        : [...wishlistRef.current, product.id];

      wishlistRef.current = nextWishlist;
      setWishlist(nextWishlist);
      toast(
        exists
          ? `${product.name} removed from saved pieces`
          : `${product.name} saved for later`,
        exists ? 'bi-heartbreak' : 'bi-heart-fill'
      );
    },
    [getProduct, toast]
  );

  const isWished = useCallback(
    (id) => wishlist.includes(Number(id)),
    [wishlist]
  );

  /* ---------------------------------------------------------------------
     Panels & theme
     --------------------------------------------------------------------- */
  const openPanel = useCallback((name) => setPanel(name), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const toggleTheme = useCallback(
    () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    []
  );

  /* ---------------------------------------------------------------------
     Derived values
     --------------------------------------------------------------------- */
  const totals = useMemo(
    () => cartTotals(cart, getProduct, promo),
    [cart, getProduct, promo, products]
  );
  const cartCount = useMemo(() => countCart(cart), [cart]);
  const rate = promoRate(promo);

  const value = useMemo(
    () => ({
      products,
      status,
      error,
      hydrate,
      retryHydrate,
      register,
      getProduct,
      cart,
      wishlist,
      promo,
      promoError,
      promoRate: rate,
      applyPromo,
      clearPromoError,
      theme,
      toggleTheme,
      toasts,
      toast,
      dismissToast,
      panel,
      openPanel,
      closePanel,
      quickSearch,
      setQuickSearch,
      cartCount,
      totals,
      addToCart,
      changeQty,
      removeFromCart,
      toggleWish,
      isWished
    }),
    [
      products,
      status,
      error,
      hydrate,
      retryHydrate,
      register,
      getProduct,
      cart,
      wishlist,
      promo,
      promoError,
      rate,
      applyPromo,
      clearPromoError,
      theme,
      toggleTheme,
      toasts,
      toast,
      dismissToast,
      panel,
      openPanel,
      closePanel,
      quickSearch,
      cartCount,
      totals,
      addToCart,
      changeQty,
      removeFromCart,
      toggleWish,
      isWished
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside <StoreProvider>.');
  return context;
}
