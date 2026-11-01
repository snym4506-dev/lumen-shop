import { memo } from 'react';
import { Link } from 'react-router-dom';
import { PLACEHOLDER_IMAGE, discountPct, formatMoney } from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';
import Stars from './Stars.jsx';
import StockNote from './StockNote.jsx';

function handleImageError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = PLACEHOLDER_IMAGE;
}

function ProductCard({
  product,
  quickView = false,
  showStock = false,
  columnClass = 'col-6 col-md-4 col-xl-3',
  onQuickView
}) {
  const { addToCart, toggleWish, isWished } = useStore();
  const saved = isWished(product.id);
  const pct = discountPct(product);
  const url = `/products/${encodeURIComponent(product.slug)}`;
  const badgeClass =
    product.badgeType === 'sale' ? ' is-sale' : product.badgeType === 'new' ? ' is-new' : '';

  return (
    <div className={columnClass}>
      <article className="product-card">
        <div className="product-media">
          {product.badge ? (
            <span className={`product-badge${badgeClass}`}>{product.badge}</span>
          ) : null}

          <button
            className={`wish-btn${saved ? ' is-active' : ''}`}
            type="button"
            onClick={() => toggleWish(product.id)}
            aria-label={`${saved ? 'Remove from' : 'Save to'} wishlist`}
            aria-pressed={saved}
          >
            <i className={`bi ${saved ? 'bi-heart-fill' : 'bi-heart'}`} />
          </button>

          <Link to={url} aria-label={`View ${product.name}`}>
            <img
              src={product.image}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          </Link>

          <div className="product-actions">
            <button
              type="button"
              onClick={() => addToCart(product.id, 1)}
              disabled={product.stock <= 0}
            >
              <i className="bi bi-bag-plus me-1" />
              {product.stock <= 0 ? 'Out of stock' : 'Add to bag'}
            </button>

            {quickView ? (
              <button
                type="button"
                className="icon-only"
                onClick={() => onQuickView && onQuickView(product.id)}
                aria-label={`Quick view ${product.name}`}
              >
                <i className="bi bi-eye" />
              </button>
            ) : (
              <Link
                className="icon-only"
                to={url}
                aria-label={`View details for ${product.name}`}
              >
                <i className="bi bi-arrow-up-right" />
              </Link>
            )}
          </div>
        </div>

        <div className="product-body">
          <span className="product-cat">{product.category}</span>
          <h3 className="product-title">
            <Link to={url}>{product.name}</Link>
          </h3>
          <div className="product-rating">
            <Stars rating={product.rating} />
            <span>
              {product.rating.toFixed(1)} ({product.reviews.toLocaleString('en-US')})
            </span>
          </div>
          <div className="product-price">
            <span className="price">{formatMoney(product.price)}</span>
            {product.oldPrice ? <del>{formatMoney(product.oldPrice)}</del> : null}
            {pct ? <span className="save-tag">−{pct}%</span> : null}
          </div>
          {showStock ? <StockNote product={product} /> : null}
        </div>
      </article>
    </div>
  );
}

export default memo(ProductCard);
