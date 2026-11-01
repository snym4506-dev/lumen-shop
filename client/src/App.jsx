import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import PageFallback from './components/PageFallback.jsx';
import { StoreProvider } from './context/StoreContext.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const CatalogPage = lazy(() => import('./pages/CatalogPage.jsx'));
const ProductPage = lazy(() => import('./pages/ProductPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

/* The GitHub Pages build has no server-side routing, so it uses hash URLs
   (`/#/products`) instead of clean paths. Everything else is identical. */
const STATIC_BUILD = import.meta.env.VITE_STATIC === 'true';
const Router = STATIC_BUILD ? HashRouter : BrowserRouter;

/* `client/404.html` is served by Express (and by GitHub Pages) for unknown
   URLs; it mounts the app with this flag so the not-found page renders even
   though the address bar holds no route for React Router to match. */
const NOT_FOUND_SHELL =
  typeof document !== 'undefined' && document.documentElement.dataset.page === '404';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <StoreProvider>
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {NOT_FOUND_SHELL ? (
                  <Route path="*" element={<NotFoundPage />} />
                ) : (
                  <>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/products" element={<CatalogPage />} />
                    <Route path="/products/:slug" element={<ProductPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </>
                )}
              </Routes>
            </Suspense>
          </Layout>
        </StoreProvider>
      </Router>
    </ErrorBoundary>
  );
}
