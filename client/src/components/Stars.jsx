export default function Stars({ rating }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const full = Math.floor(value);
  const half = value - full >= 0.3;
  const icons = [];

  for (let index = 0; index < full; index += 1) {
    icons.push(<i className="bi bi-star-fill" key={`full-${index}`} />);
  }
  if (half) icons.push(<i className="bi bi-star-half" key="half" />);
  for (let index = full + (half ? 1 : 0); index < 5; index += 1) {
    icons.push(<i className="bi bi-star" key={`empty-${index}`} />);
  }

  return (
    <span className="stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {icons}
    </span>
  );
}
