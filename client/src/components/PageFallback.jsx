export default function PageFallback() {
  return (
    <div className="lumen-page-fallback" role="status" aria-live="polite">
      <div className="text-center">
        <div className="spinner-border" aria-hidden="true" />
        <p className="mt-3 mb-0">Loading the collection…</p>
      </div>
    </div>
  );
}
