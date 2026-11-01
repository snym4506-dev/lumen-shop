import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" id="footer">
      <div className="container">
        <div className="row g-4 g-lg-5 footer-top">
          <div className="col-lg-4">
            <Link className="footer-brand" to="/">
              lumen<span className="brand-dot">.</span>
            </Link>
            <p className="footer-blurb">
              A small shop for beautiful everyday objects. Independently run, obsessively
              curated, shipped with care from our studio.
            </p>
            <div className="social-row">
              <a href="#" aria-label="Instagram" onClick={(event) => event.preventDefault()}>
                <i className="bi bi-instagram" />
              </a>
              <a href="#" aria-label="Pinterest" onClick={(event) => event.preventDefault()}>
                <i className="bi bi-pinterest" />
              </a>
              <a href="#" aria-label="TikTok" onClick={(event) => event.preventDefault()}>
                <i className="bi bi-tiktok" />
              </a>
              <a href="#" aria-label="YouTube" onClick={(event) => event.preventDefault()}>
                <i className="bi bi-youtube" />
              </a>
            </div>
          </div>

          <div className="col-6 col-lg-2">
            <h4 className="footer-heading">Shop</h4>
            <ul className="footer-links">
              <li><Link to="/products?sort=newest">New arrivals</Link></li>
              <li><Link to="/#deal">Deals</Link></li>
              <li><Link to="/products?category=Audio">Audio</Link></li>
              <li><Link to="/products?category=Wearables">Wearables</Link></li>
              <li><Link to="/products">Gift cards</Link></li>
            </ul>
          </div>

          <div className="col-6 col-lg-2">
            <h4 className="footer-heading">Help</h4>
            <ul className="footer-links">
              <li><Link to="/#faq">FAQ</Link></li>
              <li><Link to="/#faq">Shipping</Link></li>
              <li><Link to="/#faq">Returns</Link></li>
              <li><Link to="/#footer">Track order</Link></li>
              <li><Link to="/#footer">Contact us</Link></li>
            </ul>
          </div>

          <div className="col-lg-4">
            <h4 className="footer-heading">Visit the studio</h4>
            <p className="footer-address">
              14 Alder Lane, Studio 3<br />
              Portland, OR 97209<br />
              Mon–Fri · 9am–6pm
            </p>
            <a className="footer-email" href="mailto:hello@lumen.shop">
              hello@lumen.shop <i className="bi bi-arrow-up-right" />
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {year} Lumen Studio. All rights reserved.</p>
          <div className="footer-legal">
            <a href="#" onClick={(event) => event.preventDefault()}>Privacy</a>
            <a href="#" onClick={(event) => event.preventDefault()}>Terms</a>
            <a href="#" onClick={(event) => event.preventDefault()}>Cookies</a>
          </div>
          <div className="payment-row" aria-label="Accepted payment methods">
            <i className="bi bi-credit-card-2-front" />
            <i className="bi bi-paypal" />
            <i className="bi bi-apple" />
            <i className="bi bi-google" />
          </div>
        </div>
      </div>
    </footer>
  );
}
