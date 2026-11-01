import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.js';

export default function NotFoundPage() {
  const { setQuickSearch } = useStore();

  useDocumentMeta(
    'Page not found — Lumen',
    'That page could not be found. Browse the Lumen collection instead.'
  );

  useEffect(() => {
    setQuickSearch('');
  }, [setQuickSearch]);

  return (
    <section className="not-found">
      <div className="container">
        <div className="big-code">4<span>0</span>4</div>
        <h1>That page has wandered off</h1>
        <p>
          The link may be broken, or the page may have moved. The good stuff is still right where
          you left it.
        </p>
        <div className="not-found-actions">
          <Link className="btn btn-brand btn-lg" to="/products">
            Browse the collection <i className="bi bi-arrow-right ms-1" />
          </Link>
          <Link className="btn btn-outline-ink btn-lg" to="/">Back home</Link>
        </div>
      </div>
    </section>
  );
}
