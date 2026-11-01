import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { normalizeProduct } from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.js';
import ProductCard from '../components/ProductCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';

const PAGE_SIZE = 12;
const SORTS = new Set([
  'featured',
  'newest',
  'price-asc',
  'price-desc',
  'name-asc',
  'name-desc',
  'rating'
]);
const SORT_LABELS = {
  featured: 'Featured',
  newest: 'Newest first',
  'price-asc': 'Price: Low to high',
  'price-desc': 'Price: High to low',
  'name-asc': 'Name: A to Z',
  'name-desc': 'Name: Z to A',
  rating: 'Top rated'
};

function readState(searchParams) {
  const rawSort = searchParams.get('sort') || 'featured';
  const rawPage = parseInt(searchParams.get('page'), 10);

  return {
    search: (searchParams.get('search') || '').trim().slice(0, 100),
    category: (searchParams.get('category') || 'all').trim() || 'all',
    brand: (searchParams.get('brand') || '').trim(),
    sort: SORTS.has(rawSort) ? rawSort : 'featured',
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  };
}

function pageList(page, totalPages) {
  const pages = [];
  const push = (value) => {
    if (value >= 1 && value <= totalPages && !pages.includes(value)) pages.push(value);
  };

  push(1);
  if (page - 2 > 2) pages.push('start-ellipsis');
  for (let value = page - 1; value <= page + 1; value += 1) push(value);
  if (page + 2 < totalPages - 1) pages.push('end-ellipsis');
  push(totalPages);

  return pages;
}

export default function CatalogPage() {
  const { register, getProduct, setQuickSearch } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => readState(searchParams), [searchParams]);

  const [searchInput, setSearchInput] = useState(state.search);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const scrollRef = useRef(false);
  const toolbarRef = useRef(null);

  useDocumentMeta(
    'Shop the collection — Lumen',
    'Browse all 50 Lumen pieces — audio, wearables, photography, footwear, accessories, home and tech. Search, filter and sort the full collection.'
  );

  /* The header search reads from the URL while this page is mounted. */
  useEffect(() => {
    setQuickSearch(state.search);
  }, [state.search, setQuickSearch]);

  /* Keep the visible input in sync with back/forward navigation. */
  useEffect(() => {
    setSearchInput(state.search);
  }, [state.search]);

  /* Facets only need to be downloaded once per visit. */
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    Promise.allSettled([
      api.getCategories({ signal: controller.signal }),
      api.getBrands({ signal: controller.signal })
    ]).then(([categoriesResult, brandsResult]) => {
      if (cancelled) return;
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value.data || []);
      }
      if (brandsResult.status === 'fulfilled') {
        setBrands(brandsResult.value.data || []);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const updateParams = useCallback(
    (patch, { replace = true } = {}) => {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            const remove =
              value === undefined ||
              value === null ||
              value === '' ||
              (key === 'category' && value === 'all') ||
              (key === 'sort' && value === 'featured') ||
              (key === 'page' && Number(value) <= 1);

            if (remove) params.delete(key);
            else params.set(key, String(value));
          }
          return params;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  /* Debounced search: typing updates the URL, the URL drives the request. */
  useEffect(() => {
    const next = searchInput.trim().slice(0, 100);
    if (next === state.search) return undefined;

    const timer = setTimeout(() => {
      updateParams({ search: next, page: 1 }, { replace: true });
    }, 320);

    return () => clearTimeout(timer);
  }, [searchInput, state.search, updateParams]);

  /* Category names may arrive as slugs; normalise them once facets land. */
  useEffect(() => {
    if (!state.category || state.category === 'all' || categories.length === 0) return;
    const match = categories.find(
      (item) =>
        item.name.toLowerCase() === state.category.toLowerCase() ||
        item.slug === state.category.toLowerCase()
    );
    if (match && match.name !== state.category) {
      updateParams({ category: match.name }, { replace: true });
    }
  }, [categories, state.category, updateParams]);

  /* Server-side search, filtering, sorting and pagination. */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .listProducts(
        {
          page: state.page,
          limit: PAGE_SIZE,
          search: state.search,
          category: state.category === 'all' ? '' : state.category,
          brand: state.brand,
          sort: state.sort
        },
        { signal: controller.signal }
      )
      .then((payload) => {
        if (controller.signal.aborted) return;

        const nextMeta = payload.meta || {};
        if (nextMeta.totalPages > 0 && state.page > nextMeta.totalPages) {
          updateParams({ page: nextMeta.totalPages }, { replace: true });
          return;
        }

        register(payload.data || []);
        setProducts(payload.data || []);
        setMeta(nextMeta);
        setLoading(false);

        if (scrollRef.current) {
          scrollRef.current = false;
          scrollToResults();
        }
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError' || controller.signal.aborted) return;
        setProducts([]);
        setMeta(null);
        setError(requestError);
        setLoading(false);
        scrollRef.current = false;
      });

    return () => controller.abort();
  }, [state.search, state.category, state.brand, state.sort, state.page, retryTick, register, updateParams]);

  function scrollToResults() {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const top = toolbar.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  function changeFilter(patch) {
    scrollRef.current = true;
    updateParams({ ...patch, page: 1 }, { replace: true });
  }

  function goToPage(page) {
    if (!Number.isInteger(page) || page < 1) return;
    scrollRef.current = true;
    updateParams({ page }, { replace: false });
  }

  function clearAll() {
    scrollRef.current = true;
    setSearchInput('');
    updateParams(
      { search: '', category: 'all', brand: '', sort: 'featured', page: 1 },
      { replace: true }
    );
  }

  function retry() {
    setRetryTick((current) => current + 1);
  }

  const totalPieces = useMemo(
    () => categories.reduce((sum, item) => sum + (Number(item.count) || 0), 0),
    [categories]
  );

  const countText = loading
    ? 'Loading the collection…'
    : error
      ? 'The collection could not load.'
      : !meta || meta.total === 0
        ? 'No pieces matched your filters.'
        : null;

  const start = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const end = meta && meta.total > 0 ? start + meta.count - 1 : 0;
  const totalPages = meta?.totalPages || 0;

  const activePills = [];
  if (state.search) activePills.push(['search', `Search: “${state.search}”`]);
  if (state.category !== 'all') activePills.push(['category', state.category]);
  if (state.brand) activePills.push(['brand', state.brand]);
  if (state.sort !== 'featured') {
    activePills.push(['sort', `Sort: ${SORT_LABELS[state.sort] || state.sort}`]);
  }

  const renderedProducts = products.map(
    (product) => getProduct(product.id) || normalizeProduct(product)
  );

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <i className="bi bi-chevron-right" aria-hidden="true" />
            <span aria-current="page">Shop</span>
          </nav>
          <div className="page-hero-inner">
            <span className="eyebrow">The full collection</span>
            <h1>Everything, thoughtfully chosen.</h1>
            <p>
              Fifty pieces for the desk, the commute and the quiet hours. Search the whole
              catalogue, narrow it down by category or brand, and sort it however you like.
            </p>
            <div className="page-hero-meta">
              <span>
                <i className="bi bi-grid" />
                <strong>{totalPieces || 50}</strong> pieces in the collection
              </span>
              <span><i className="bi bi-truck" /> Free shipping over $150</span>
              <span><i className="bi bi-arrow-counterclockwise" /> 30-day returns</span>
            </div>
          </div>
        </div>
      </section>

      <section className="catalog-section">
        <div className="container">
          <div className="catalog-toolbar" ref={toolbarRef}>
            <form
              className="catalog-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                scrollRef.current = true;
                updateParams(
                  { search: searchInput.trim().slice(0, 100), page: 1 },
                  { replace: true }
                );
              }}
            >
              <i className="bi bi-search" aria-hidden="true" />
              <label className="visually-hidden" htmlFor="catalogSearch">Search products</label>
              <input
                type="search"
                id="catalogSearch"
                placeholder="Search by name, brand or category…"
                autoComplete="off"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <button
                type="button"
                className={`clear-search${searchInput ? '' : ' d-none'}`}
                aria-label="Clear search"
                onClick={() => {
                  setSearchInput('');
                  scrollRef.current = true;
                  updateParams({ search: '', page: 1 }, { replace: true });
                  document.getElementById('catalogSearch')?.focus();
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </form>

            <div className="catalog-controls">
              <div
                className="filter-chips"
                role="group"
                aria-label="Filter products by category"
              >
                <button
                  className={`chip${state.category === 'all' ? ' is-active' : ''}`}
                  type="button"
                  aria-pressed={state.category === 'all'}
                  onClick={() => changeFilter({ category: 'all' })}
                >
                  All {totalPieces ? <span className="chip-count">{totalPieces}</span> : null}
                </button>
                {categories.map((item) => {
                  const active = item.name.toLowerCase() === state.category.toLowerCase();
                  return (
                    <button
                      className={`chip${active ? ' is-active' : ''}`}
                      type="button"
                      key={item.slug || item.name}
                      aria-pressed={active}
                      onClick={() => changeFilter({ category: item.name })}
                    >
                      {item.name} <span className="chip-count">{item.count}</span>
                    </button>
                  );
                })}
              </div>

              <div className="catalog-selects">
                <label className="visually-hidden" htmlFor="brandSelect">Filter by brand</label>
                <select
                  className="form-select"
                  id="brandSelect"
                  value={state.brand}
                  onChange={(event) => changeFilter({ brand: event.target.value })}
                >
                  <option value="">All brands</option>
                  {brands.map((item) => (
                    <option value={item.name} key={item.name}>
                      {item.name} ({item.count})
                    </option>
                  ))}
                </select>

                <label className="visually-hidden" htmlFor="catalogSort">Sort products</label>
                <select
                  className="form-select"
                  id="catalogSort"
                  value={state.sort}
                  onChange={(event) =>
                    changeFilter({
                      sort: SORTS.has(event.target.value) ? event.target.value : 'featured'
                    })
                  }
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="newest">Newest first</option>
                  <option value="price-asc">Price: Low to high</option>
                  <option value="price-desc">Price: High to low</option>
                  <option value="name-asc">Name: A to Z</option>
                  <option value="rating">Top rated</option>
                </select>
              </div>
            </div>
          </div>

          <div className="catalog-summary">
            <p aria-live="polite">
              {countText ? (
                countText
              ) : (
                <>
                  Showing <strong>{start}–{end}</strong> of <strong>{meta.total}</strong>{' '}
                  piece{meta.total === 1 ? '' : 's'}
                </>
              )}
            </p>
            <div className="catalog-active-filters" aria-label="Active filters">
              {activePills.map(([kind, label]) => (
                <span className="filter-pill" key={kind}>
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label} filter`}
                    onClick={() => {
                      if (kind === 'search') {
                        setSearchInput('');
                        changeFilter({ search: '' });
                      } else if (kind === 'category') changeFilter({ category: 'all' });
                      else if (kind === 'brand') changeFilter({ brand: '' });
                      else changeFilter({ sort: 'featured' });
                    }}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="row g-3 g-lg-4 catalog-grid" aria-live="polite" aria-busy="true">
              {Array.from({ length: 8 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="catalog-state" role="alert">
              <span className="empty-icon"><i className="bi bi-wifi-off" /></span>
              <h2>The collection could not load</h2>
              <p>
                {error.message ||
                  'Something went wrong while fetching products. Check your connection and try again.'}
              </p>
              <div className="state-actions">
                <button className="btn btn-brand" type="button" onClick={retry}>
                  Try again <i className="bi bi-arrow-clockwise ms-1" />
                </button>
              </div>
            </div>
          ) : renderedProducts.length === 0 ? (
            <div className="catalog-state">
              <span className="empty-icon"><i className="bi bi-search" /></span>
              <h2>No pieces matched</h2>
              <p>
                Try a different keyword, pick another category, or clear the filters to see the
                whole collection.
              </p>
              <div className="state-actions">
                <button className="btn btn-outline-ink" type="button" onClick={clearAll}>
                  Clear all filters
                </button>
                <Link className="btn btn-brand" to="/products">View everything</Link>
              </div>
            </div>
          ) : (
            <div className="row g-3 g-lg-4 catalog-grid" aria-live="polite" aria-busy="false">
              {renderedProducts.map((product) => (
                <ProductCard
                  product={product}
                  showStock
                  columnClass="col-6 col-md-4 col-xl-3"
                  key={product.id}
                />
              ))}
            </div>
          )}

          {!loading && !error && totalPages > 1 ? (
            <nav className="catalog-pagination" aria-label="Product pages">
              <button
                className="page-btn is-edge"
                type="button"
                onClick={() => goToPage(state.page - 1)}
                disabled={state.page <= 1}
                aria-label="Previous page"
              >
                <i className="bi bi-chevron-left" />
              </button>

              {pageList(state.page, totalPages).map((value) =>
                typeof value === 'string' ? (
                  <span className="page-ellipsis" aria-hidden="true" key={value}>…</span>
                ) : (
                  <button
                    className={`page-btn${value === state.page ? ' is-active' : ''}`}
                    type="button"
                    key={value}
                    onClick={() => goToPage(value)}
                    aria-current={value === state.page ? 'page' : undefined}
                    aria-label={`Page ${value}`}
                  >
                    {value}
                  </button>
                )
              )}

              <button
                className="page-btn is-edge"
                type="button"
                onClick={() => goToPage(state.page + 1)}
                disabled={state.page >= totalPages}
                aria-label="Next page"
              >
                <i className="bi bi-chevron-right" />
              </button>
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}
