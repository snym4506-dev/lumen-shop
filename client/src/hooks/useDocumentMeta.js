import { useEffect } from 'react';

export function useDocumentMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.setAttribute('content', String(description).slice(0, 300));
  }, [title, description]);
}
