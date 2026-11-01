export default function StockNote({ product }) {
  if (product.stock <= 0) {
    return (
      <span className="stock-note is-out">
        <i className="bi bi-x-circle" /> Out of stock
      </span>
    );
  }
  if (product.stock <= 5) {
    return (
      <span className="stock-note is-low">
        <i className="bi bi-exclamation-circle" /> Only {product.stock} left
      </span>
    );
  }
  return (
    <span className="stock-note">
      <i className="bi bi-check2-circle" /> In stock
    </span>
  );
}
