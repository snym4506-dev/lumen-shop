import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollManager() {
  const location = useLocation();

  useEffect(() => {
    const { hash, pathname } = location;

    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timer;

    const tryScroll = () => {
      if (cancelled) return;
      let id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep the raw hash */
      }
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < 10) timer = setTimeout(tryScroll, 60);
      else window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    timer = setTimeout(tryScroll, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [location.pathname, location.hash]);

  return null;
}
