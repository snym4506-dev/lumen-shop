import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatMoney } from '../lib/catalog.js';
import { useStore } from '../context/StoreContext.jsx';

export default function WishlistPanel() {
  const {
    panel,
    closePanel,
    wishlist,
    getProduct,
    addToCart,
    toggleWish
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const open = panel === 'wishlist';

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closePanel]);

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

  return (
    <>
      {open ? <div className="offcanvas-backdrop fade show" onClick={closePanel} /> : null}

      <div
        className={`offcanvas offcanvas-end cart-panel${open ? ' show' : ''}`}
        tabIndex={-1}
        id="wishlistPanel"
        aria-labelledby="wishlistTitle"
      >
        <div className="offcanvas-header">
          <h2 className="offcanvas-title h5" id="wishlistTitle">
            Saved pieces <span>({wishlist.length})</span>
          </h2>
          <button type="button" className="btn-close" aria-label="Close" onClick={closePanel} />
        </div>

        <div className="offcanvas-body">
          {wishlist.length === 0 ? (
            <div className="cart-empty">
              <span className="empty-icon">
                <i className="bi bi-heart" />
              </span>
              <h3>Nothing saved yet</h3>
              <p>Tap the heart on anything you love and it will wait for you here.</p>
              <button className="btn btn-brand" type="button" onClick={goShop}>
                Find something lovely
              </button>
            </div>
          ) : (
            wishlist.map((id) => {
              const product = getProduct(id);
              if (!product) return null;
              const url = `/products/${encodeURIComponent(product.slug)}`;
              return (
                <div className="wish-item" key={id}>
                  <Link to={url} onClick={closePanel}>
                    <img className="cart-item-img" src={product.image} alt={product.name} />
                  </Link>
                  <div>
                    <span className="cart-item-cat">{product.category}</span>
                    <h4 className="cart-item-title">
                      <Link to={url} onClick={closePanel}>{product.name}</Link>
                    </h4>
                    <span className="cart-item-price">{formatMoney(product.price)}</span>
                    <div className="wish-actions">
                      <button
                        className="btn btn-brand"
                        type="button"
                        onClick={() => addToCart(product.id, 1)}
                        disabled={product.stock <= 0}
                      >
                        Add to bag
                      </button>
                      <button
                        className="btn btn-outline-ink"
                        type="button"
                        onClick={() => toggleWish(product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
