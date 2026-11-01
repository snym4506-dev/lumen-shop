import { useEffect, useState } from 'react';
import { clampQuantity, discountPct, formatMoney } from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';
import { useBodyLock } from '../hooks/useBodyLock.js';
import Stars from './Stars.jsx';

export default function QuickView({ productId, onClose }) {
  const { getProduct, addToCart } = useStore();
  const product = productId ? getProduct(productId) : null;
  const [quantity, setQuantity] = useState(1);
  const [colorIndex, setColorIndex] = useState(0);

  useBodyLock(Boolean(product));

  useEffect(() => {
    setQuantity(1);
    setColorIndex(0);
  }, [productId]);

  useEffect(() => {
    if (!product) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const pct = discountPct(product);
  const soldOut = product.stock <= 0;
  const changeQuantity = (step) =>
    setQuantity((current) => clampQuantity(current + step, product.stock));

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div
        className="modal fade show"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qvName"
        aria-hidden="false"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <button
              type="button"
              className="btn-close qv-close"
              aria-label="Close"
              onClick={onClose}
            />
            <div className="modal-body p-0">
              <div className="row g-0">
                <div className="col-md-6">
                  <div className="qv-media">
                    <img src={product.image} alt={product.name} />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="qv-body">
                    <span className="eyebrow">{product.category}</span>
                    <h3 id="qvName">{product.name}</h3>
                    <div className="qv-rating">
                      <Stars rating={product.rating} />
                      <span>
                        {product.rating.toFixed(1)} · {product.reviews.toLocaleString('en-US')} reviews
                      </span>
                    </div>
                    <p className="qv-desc">{product.short || product.desc}</p>
                    <div className="qv-price">
                      <span>{formatMoney(product.price)}</span>
                      {product.oldPrice ? <del>{formatMoney(product.oldPrice)}</del> : null}
                    </div>

                    <div className="qv-colors" aria-label="Colour options">
                      {product.colors.map((color, index) => (
                        <button
                          type="button"
                          className={`qv-swatch${index === colorIndex ? ' is-active' : ''}`}
                          style={{ background: color }}
                          key={`${color}-${index}`}
                          onClick={() => setColorIndex(index)}
                          aria-label={`Colour option ${index + 1}`}
                          aria-pressed={index === colorIndex}
                        />
                      ))}
                    </div>

                    <div className="d-flex gap-2 align-items-stretch">
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
                        className="btn btn-brand flex-grow-1"
                        type="button"
                        disabled={soldOut}
                        onClick={() => {
                          addToCart(product.id, quantity);
                          onClose();
                        }}
                      >
                        {soldOut ? (
                          'Out of stock'
                        ) : (
                          <>
                            Add to bag <i className="bi bi-bag-plus ms-1" />
                          </>
                        )}
                      </button>
                    </div>

                    {pct ? (
                      <p className="qv-desc mb-0 mt-2">Save {pct}% while the sale lasts.</p>
                    ) : null}

                    <ul className="qv-perks">
                      <li><i className="bi bi-truck" /> Free express shipping over $150</li>
                      <li><i className="bi bi-arrow-counterclockwise" /> 30-day free returns</li>
                      <li><i className="bi bi-shield-check" /> 2-year warranty included</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
