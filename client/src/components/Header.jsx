import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';

const NAV_LINKS = [
  { label: 'Shop', to: '/products', match: 'shop' },
  { label: 'Categories', to: '/#categories' },
  { label: 'Deals', to: '/#deal' },
  { label: 'Reviews', to: '/#reviews' },
  { label: 'Help', to: '/#faq' }
];

export default function Header() {
  const {
    cartCount,
    wishlist,
    theme,
    toggleTheme,
    openPanel,
    quickSearch,
    setQuickSearch
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      const desktop = desktopSearchRef.current;
      const mobile = mobileSearchRef.current;
      const target =
        desktop && window.getComputedStyle(desktop).display !== 'none' ? desktop : mobile;
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const shopActive =
    location.pathname === '/products' || location.pathname.startsWith('/products/');

  function handleSubmit(event) {
    event.preventDefault();
    const value = quickSearch.trim();

    // On the home page the header search filters the edit live.
    if (location.pathname === '/') return;

    if (location.pathname === '/products') {
      const params = new URLSearchParams(location.search);
      if (value) params.set('search', value);
      else params.delete('search');
      params.delete('page');
      const query = params.toString();
      navigate(`/products${query ? `?${query}` : ''}`);
      return;
    }

    navigate(value ? `/products?search=${encodeURIComponent(value)}` : '/products');
  }

  const searchForm = (mobile) => (
    <form
      className={`search-pill ${mobile ? 'search-mobile d-lg-none mb-2' : 'd-none d-lg-flex'}`}
      role="search"
      onSubmit={handleSubmit}
    >
      <i className="bi bi-search" />
      <input
        ref={mobile ? mobileSearchRef : desktopSearchRef}
        type="search"
        placeholder="Search products…"
        aria-label="Search products"
        autoComplete="off"
        value={quickSearch}
        onChange={(event) => setQuickSearch(event.target.value)}
      />
      {!mobile ? <kbd className="d-none d-xl-block">⌘K</kbd> : null}
    </form>
  );

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container">
        <nav className="navbar navbar-expand-lg py-2 py-lg-3">
          <Link
            className="navbar-brand"
            to="/"
            aria-label="Lumen home"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            lumen<span className="brand-dot">.</span>
          </Link>

          <div className="header-actions order-lg-3">
            <button
              className="icon-btn"
              type="button"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
              onClick={toggleTheme}
            >
              <i className={theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars'} />
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => openPanel('wishlist')}
              aria-label="Open wishlist"
            >
              <i className="bi bi-heart" />
              <span className="badge-count" data-empty={wishlist.length === 0}>
                {wishlist.length > 99 ? '99+' : wishlist.length}
              </span>
            </button>
            <button
              className="icon-btn"
              type="button"
              onClick={() => openPanel('cart')}
              aria-label="Open shopping bag"
            >
              <i className="bi bi-bag" />
              <span className="badge-count" data-empty={cartCount === 0}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            </button>
          </div>

          <button
            className="navbar-toggler order-lg-4 border-0 shadow-none"
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-controls="mainNav"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
          >
            <span className="toggler-lines">
              <span />
              <span />
            </span>
          </button>

          <div className={`collapse navbar-collapse order-lg-2${navOpen ? ' show' : ''}`} id="mainNav">
            <ul className="navbar-nav mx-auto mb-3 mb-lg-0">
              {NAV_LINKS.map((link) => {
                const active = link.match === 'shop' && shopActive;
                return (
                  <li className="nav-item" key={link.label}>
                    <Link
                      className={`nav-link${active ? ' active' : ''}`}
                      to={link.to}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setNavOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {searchForm(false)}
          </div>
        </nav>

        {searchForm(true)}
      </div>
    </header>
  );
}
