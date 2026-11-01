import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FREE_SHIPPING, formatMoney } from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';

export default function CartPanel() {
  const {
    panel,
    closePanel,
    cart,
    cartCount,
    getProduct,
    totals,
    changeQty,
    removeFromCart,
    promo,
    promoRate,
    promoError,
    applyPromo,
    clearPromoError,
    toast
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState(promo);
  const open = panel === 'cart';

  useEffect(() => {
    setPromoInput(promo);
  }, [promo]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closePanel]);

  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING) * 100);
  const remaining = Math.max(0, FREE_SHIPPING - totals.subtotal);
  const shippingLabel =
    totals.subtotal === 0
      ? `Spend ${formatMoney(FREE_SHIPPING)} for free shipping`
      : remaining > 0
        ? `${formatMoney(remaining)} away from free shipping`
        : 'Free shipping unlocked';

  const promoMessage = promoError
    ? { text: promoError, className: ' is-error' }
    : promo
      ? {
          text: `Code ${promo} applied — ${Math.round(promoRate * 100)}% off.`,
          className: ' is-ok'
        }
      : { text: '', className: '' };

  function goShop() {
    closePanel();
    if (location.pathname === '/') {
      setTimeout(() => {
        document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 320);
    } else {
      navigate('/products');
    }
  }

  function handlePromoSubmit(event) {
    event.preventDefault();
    applyPromo(promoInput);
  }

  function handleCheckout() {
    if (cart.length === 0) {
      toast('Your bag is empty — add something lovely first.', 'bi-bag');
      return;
    }
    toast('Demo checkout — connect your payment provider to go live.', 'bi-credit-card');
  }

  return (
    <>
      {open ? <div className="offcanvas-backdrop fade show" onClick={closePanel} /> : null}

      <div
        className={`offcanvas offcanvas-end cart-panel${open ? ' show' : ''}`}
        tabIndex={-1}
        id="cartPanel"
        aria-labelledby="cartTitle"
      >
        <div className="offcanvas-header">
          <h2 className="offcanvas-title h5" id="cartTitle">
            Your bag <span>({cartCount})</span>
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={closePanel} />
        </div>

        <div className="shipping-meter">
          <div className="d-flex justify-content-between">
            <span className={remaining <= 0 && totals.subtotal > 0 ? 'is-free' : undefined}>
              {shippingLabel}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="offcanvas-body">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <span className="empty-icon">
                <i className="bi bi-bag" />
              </span>
              <h3>Your bag is empty</h3>
              <p>Beautiful things are waiting. Start with the edit — we'll keep it warm.</p>
              <button className="btn btn-brand" type="button" onClick={goShop}>
                Browse the collection
              </button>
            </div>
          ) : (
            cart.map((line) => {
              const product = getProduct(line.id);
              if (!product) return null;
              const url = `/products/${encodeURIComponent(product.slug)}`;
              return (
                <div className="cart-item" key={line.id}>
                  <Link to={url} onClick={closePanel}>
                    <img className="cart-item-img" src={product.image} alt={product.name} />
                  </Link>
                  <div className="cart-item-info">
                    <span className="cart-item-cat">{product.category}</span>
                    <h4>
                      <Link to={url} onClick={closePanel}>{product.name}</Link>
                    </h4>
                    <div className="cart-item-controls">
                      <div className="qty-stepper" aria-label={`Quantity for ${product.name}`}>
                        <button
                          type="button"
                          onClick={() => changeQty(product.id, -1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span>{line.qty}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(product.id, 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="cart-item-remove"
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="cart-item-price">{formatMoney(product.price * line.qty)}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="cart-footer">
          <form className="promo-form" onSubmit={handlePromoSubmit}>
            <label className="visually-hidden" htmlFor="promoInput">Promo code</label>
            <input
              type="text"
              className="form-control"
              id="promoInput"
              placeholder="Promo code (try LUMEN10)"
              autoComplete="off"
              value={promoInput}
              onChange={(event) => {
                setPromoInput(event.target.value);
                clearPromoError();
              }}
            />
            <button className="btn btn-outline-ink" type="submit">Apply</button>
          </form>

          <p className={`promo-msg${promoMessage.className}`}>{promoMessage.text}</p>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatMoney(totals.subtotal)}</span>
          </div>
          <div className={`summary-row${totals.discount <= 0 ? ' is-hidden' : ''}`}>
            <span>Discount</span>
            <span>−{formatMoney(totals.discount)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>
              {totals.subtotal === 0 ? '—' : totals.shipping === 0 ? 'Free' : formatMoney(totals.shipping)}
            </span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatMoney(totals.total)}</span>
          </div>

          <button className="btn btn-brand btn-lg w-100" type="button" onClick={handleCheckout}>
            Checkout securely <i className="bi bi-lock ms-1" />
          </button>
          <p className="secure-note">
            <i className="bi bi-shield-check" /> Encrypted checkout · 30-day returns
          </p>
        </div>
      </div>
    </>
  );
}
