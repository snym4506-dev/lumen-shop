import { useEffect } from 'react';
import { useStore } from '../context/StoreContext.jsx';

function ToastItem({ toast }) {
  const { dismissToast } = useStore();

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), 2800);
    return () => clearTimeout(timer);
  }, [toast.id, dismissToast]);

  return (
    <div className="toast show" role="status" aria-live="polite" aria-atomic="true">
      <div className="d-flex">
        <div className="toast-body">
          <i className={`bi ${toast.icon}`} />
          <span>{toast.message}</span>
        </div>
        <button
          type="button"
          className="btn-close me-2 m-auto"
          aria-label="Close"
          onClick={() => dismissToast(toast.id)}
        />
      </div>
    </div>
  );
}

export default function ToastStack() {
  const { toasts } = useStore();
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastItem toast={toast} key={toast.id} />
      ))}
    </div>
  );
}
