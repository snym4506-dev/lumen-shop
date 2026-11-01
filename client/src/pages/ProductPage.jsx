import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  PLACEHOLDER_IMAGE,
  clampQuantity,
  discountPct,
  formatMoney,
  normalizeProduct
} from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.js';
import ProductCard from '../components/ProductCard.jsx';
import Stars from '../components/Stars.jsx';

function DetailSkeleton() {
  return (
    <div className="row g-4 g-lg-5" aria-hidden="true">
      <div className="col-lg-6">
        <div className="skeleton-card">
          <div className="skeleton-media" style={{ aspectRatio: '1 / 1' }} />
        </div>
      </div>
      <div className="col-lg-6">
        <div className="product-body" style={{ padding: '6px 0' }}>
          <span className="skeleton-line is-short" />
          <span className="skeleton-line" style={{ height: 38, width: '82%' }} />
          <span className="skeleton-line is-medium" />
          <span className="skeleton-line" style={{ height: 26, width: '42%', marginTop: 14 }} />
          <span className="skeleton-line" style={{ width: '100%', marginTop: 22 }} />
          <span className="skeleton-line" style={{ width: '92%' }} />
          <span className="skeleton-line" style={{ width: '64%' }} />
        </div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const {
    register,
    getProduct,
    addToCart,
    toggleWish,
    isWished,
    setQuickSearch
  } = useStore();

  const [status, setStatus] = useState('loading');
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [retryTick, setRetryTick] = useState(0);

  /* The header search belongs to the catalogue page. */
  useEffect(() => {
    setQuickSearch('');
  }, [setQuickSearch]);

  useEffect(() => {
    if (!slug) {
      setStatus('notfound');
      setProduct(null);
      return undefined;
    }

    const controller = new AbortController();
    setStatus('loading');
    setProduct(null);
    setRelated([]);
    setErrorMessage('');

    api
      .getProduct(slug, { signal: controller.signal, force: retryTick > 0 })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const raw = payload.data;
        const relatedRows = Array.isArray(raw.related) ? raw.related.filter(Boolean).slice(0, 4) : [];

        register([raw, ...relatedRows]);
        setProduct(normalizeProduct(raw));
        setRelated(relatedRows.map((row) => getProduct(row.id) || normalizeProduct(row)));
        setGalleryIndex(0);
        setQuantity(1);
        setStatus('ready');
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError' || controller.signal.aborted) return;
        if (requestError.status === 404) {
          setStatus('notfound');
          return;
        }
        setErrorMessage(requestError.message || '');
        setStatus('error');
      });

    return () => controller.abort();
  }, [slug, retryTick, register, getProduct]);

  const gallery = useMemo(() => {
    if (!product) return [];
    const list = Array.from(new Set([product.image, ...(product.images || [])].filter(Boolean)));
    return list.length > 0 ? list : [PLACEHOLDER_IMAGE];
  }, [product]);

  const pageTitle =
    status === 'ready' && product
      ? `${product.name} — Lumen`
      : status === 'notfound'
        ? 'Piece not found — Lumen'
        : status === 'error'
          ? 'Something went wrong — Lumen'
          : 'Product — Lumen';

  useDocumentMeta(
    pageTitle,
    product ? product.short || product.desc : 'Product details, pricing, availability and related pieces from the Lumen collection.'
  );

  const saved = product ? isWished(product.id) : false;
  const pct = product ? discountPct(product) : 0;
  const soldOut = product ? product.stock <= 0 : false;

  function changeQuantity(step) {
    setQuantity((current) => clampQuantity(current + step, product ? product.stock : 1));
  }

  const breadcrumbs = (
    <nav className="breadcrumbs detail-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      <i className="bi bi-chevron-right" aria-hidden="true" />
      <Link to="/products">Shop</Link>
      <i className="bi bi-chevron-right" aria-hidden="true" />
      {product ? (
        <>
          <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
            {product.category}
          </Link>
          <i className="bi bi-chevron-right" aria-hidden="true" />
          <span aria-current="page">{product.name}</span>
        </>
      ) : (
        <span aria-current="page">Product</span>
      )}
    </nav>
  );

  return (
    <section className="detail-section">
      <div className="container">
        {breadcrumbs}

        {status === 'loading' ? <DetailSkeleton /> : null}

        {status === 'notfound' ? (
          <div className="not-found">
            <div className="big-code">4<span>0</span>4</div>
            <h1>This piece has moved on</h1>
            <p>
              The product you are looking for may have sold out, been renamed or never existed.
              The rest of the collection is still here.
            </p>
            <div className="not-found-actions">
              <Link className="btn btn-brand" to="/products">
                Browse the collection <i className="bi bi-arrow-right ms-1" />
              </Link>
              <Link className="btn btn-outline-ink" to="/">Back home</Link>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="catalog-state" role="alert">
            <span className="empty-icon"><i className="bi bi-wifi-off" /></span>
            <h2>This piece could not load</h2>
            <p>
              {errorMessage ||
                'Something went wrong while fetching the product. Check your connection and try again.'}
            </p>
            <div className="state-actions">
              <button
                className="btn btn-brand"
                type="button"
                onClick={() => setRetryTick((current) => current + 1)}
              >
                Try again <i className="bi bi-arrow-clockwise ms-1" />
              </button>
              <Link className="btn btn-outline-ink" to="/products">Back to the collection</Link>
            </div>
          </div>
        ) : null}

        {status === 'ready' && product ? (
          <>
            <div className="row g-4 g-lg-5 align-items-start">
              <div className="col-lg-6">
                <div className="detail-gallery">
                  <div className="gallery-main">
                    {product.badge ? (
                      <span
                        className={`product-badge${
                          product.badgeType === 'sale'
                            ? ' is-sale'
                            : product.badgeType === 'new'
                              ? ' is-new'
                              : ''
                        }`}
                      >
                        {product.badge}
                      </span>
                    ) : null}
                    <img
                      src={gallery[galleryIndex] || gallery[0]}
                      alt={product.name}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </div>

                  {gallery.length > 1 ? (
                    <div className="gallery-thumbs" aria-label="Product images">
                      {gallery.map((src, index) => (
                        <button
                          className={`gallery-thumb${index === galleryIndex ? ' is-active' : ''}`}
                          type="button"
                          key={`${src}-${index}`}
                          onClick={() => setGalleryIndex(index)}
                          aria-label={`View image ${index + 1} of ${gallery.length}`}
                          aria-pressed={index === galleryIndex}
                        >
                          <img
                            src={src}
                            alt={`${product.name} — view ${index + 1}`}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="col-lg-6">
                <div className="detail-info">
                  <span className="detail-cat">
                    <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
                      {product.category}
                    </Link>
                    <span aria-hidden="true">·</span>
                    <span>{product.brand}</span>
                  </span>

                  <h1>{product.name}</h1>

                  <div className="detail-rating">
                    <Stars rating={product.rating} />
                    <strong>{product.rating.toFixed(1)}</strong>
                    <span>
                      · {product.reviews.toLocaleString('en-US')}{' '}
                      review{product.reviews === 1 ? '' : 's'}
                    </span>
                  </div>

                  <p className="detail-short">{product.short || product.desc}</p>

                  <div className="detail-price">
                    <span className="now">{formatMoney(product.price)}</span>
                    {product.oldPrice ? <del>{formatMoney(product.oldPrice)}</del> : null}
                    {pct ? <span className="save-tag">Save {pct}%</span> : null}
                  </div>
                  <p className="detail-tax">Tax included. Shipping calculated at checkout.</p>

                  <div className="detail-stock">
                    {product.stock <= 0 ? (
                      <>
                        <span className="stock-badge is-out">
                          <i className="bi bi-x-circle" /> Out of stock
                        </span>
                        <span className="stock-sku">This piece is currently unavailable.</span>
                      </>
                    ) : product.stock <= 5 ? (
                      <>
                        <span className="stock-badge is-low">
                          <i className="bi bi-exclamation-circle" /> Only {product.stock} left
                        </span>
                        <span className="stock-sku">Ready to ship · selling fast</span>
                      </>
                    ) : (
                      <>
                        <span className="stock-badge">
                          <i className="bi bi-check2-circle" /> In stock
                        </span>
                        <span className="stock-sku">
                          <strong>{product.stock}</strong> ready to ship
                        </span>
                      </>
                    )}
                  </div>

                  <div className="detail-buy">
                    <div className="qty-stepper" aria-label="Quantity">
                      <button
                        type="button"
                        onClick={() => changeQuantity(-1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      className="btn btn-brand btn-add"
                      type="button"
                      disabled={soldOut}
                      onClick={() => addToCart(product.id, quantity)}
                    >
                      {soldOut ? (
                        'Out of stock'
                      ) : (
                        <>
                          Add to bag <i className="bi bi-bag-plus ms-1" />
                        </>
                      )}
                    </button>

                    <button
                      className={`btn-wish${saved ? ' is-active' : ''}`}
                      type="button"
                      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                      aria-pressed={saved}
                      onClick={() => toggleWish(product.id)}
                    >
                      <i className={`bi ${saved ? 'bi-heart-fill' : 'bi-heart'}`} />
                    </button>
                  </div>

                  <ul className="detail-perks">
                    <li><i className="bi bi-truck" /> Free express shipping on orders over $150</li>
                    <li><i className="bi bi-arrow-counterclockwise" /> 30-day free returns, no questions asked</li>
                    <li><i className="bi bi-shield-check" /> Two-year warranty on every piece</li>
                  </ul>

                  <dl className="detail-meta">
                    <div><dt>SKU</dt><dd>{product.sku || '—'}</dd></div>
                    <div><dt>Brand</dt><dd>{product.brand}</dd></div>
                    <div><dt>Category</dt><dd>{product.category}</dd></div>
                    <div>
                      <dt>Availability</dt>
                      <dd>{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>

            <section className="detail-description">
              <h2>About this piece</h2>
              <p>{product.desc}</p>
              <div className="detail-facts">
                <span><i className="bi bi-box-seam me-1" /> Ships in 24 hours</span>
                <span><i className="bi bi-globe2 me-1" /> Ships to 38 countries</span>
                <span><i className="bi bi-credit-card me-1" /> Secure checkout</span>
                <span><i className="bi bi-star me-1" /> Curated by the studio</span>
              </div>
            </section>

            {related.length > 0 ? (
              <section className="related-section">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">You might also like</span>
                    <h2>More from the collection</h2>
                  </div>
                  <Link to="/products" className="link-arrow">
                    View everything <i className="bi bi-arrow-up-right" />
                  </Link>
                </div>
                <div className="row g-3 g-lg-4">
                  {related.map((item) => (
                    <ProductCard
                      product={getProduct(item.id) || item}
                      columnClass="col-6 col-md-4 col-lg-3"
                      key={item.id}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
