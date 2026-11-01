export default function SkeletonCard({ withCard = false, columnClass = 'col-6 col-md-4 col-xl-3' }) {
  return (
    <div className={columnClass}>
      <div className={`${withCard ? 'product-card ' : ''}skeleton-card`} aria-hidden="true">
        <div className="skeleton-media" />
        <div className="product-body">
          <span className="skeleton-line is-short" />
          <span className="skeleton-line" />
          <span className="skeleton-line is-medium" />
        </div>
      </div>
    </div>
  );
}
