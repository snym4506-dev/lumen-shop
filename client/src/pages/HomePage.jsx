import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import {
  PLACEHOLDER_IMAGE,
  discountPct,
  filterAndSortProducts,
  formatMoney,
  isValidEmail
} from '../lib/catalog.js';
import { VISITED_KEY, readFlag, writeFlag } from '../lib/storage.js';
import { useStore } from '../context/StoreContext.jsx';
import { useDocumentMeta } from '../hooks/useDocumentMeta.js';
import ProductCard from '../components/ProductCard.jsx';
import QuickView from '../components/QuickView.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import Stars from '../components/Stars.jsx';

const HOME_CATEGORY_ORDER = ['Audio', 'Wearables', 'Photography', 'Footwear', 'Accessories', 'Home'];
const HOME_CHIP_ORDER = [...HOME_CATEGORY_ORDER, 'Tech'];
const SORT_OPTIONS = [
  { value: 'featured', label: 'Sort: Featured' },
  { value: 'price-asc', label: 'Price: Low to high' },
  { value: 'price-desc', label: 'Price: High to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest first' }
];

const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80',
    alt: 'Person carrying shopping bags through a city street',
    eyebrow: 'New season · 2026',
    title: (
      <>
        Everyday objects,<br />
        <span className="accent">beautifully</span> made.
      </>
    ),
    text: 'A tightly edited collection of audio, tech and everyday essentials — chosen for how they feel, not just how they look.',
    actions: [
      { to: '/products?sort=newest', label: 'Shop new arrivals', arrow: true },
      { to: '/#deal', label: "Today's deal", ghost: true }
    ],
    stats: [
      ['4.9/5', '12,400+ reviews'],
      ['48h', 'Express delivery'],
      ['30 days', 'Easy returns']
    ]
  },
  {
    image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1800&q=80',
    alt: 'Minimal fashion store interior with clothing racks',
    eyebrow: 'The studio edit',
    title: (
      <>
        Less noise.<br />
        More <span className="accent">signal.</span>
      </>
    ),
    text: 'Pieces that earn their place in your life. Designed to be used daily, repaired easily and kept for years.',
    actions: [
      { to: '/#categories', label: 'Explore categories', arrow: true },
      { to: '/#reviews', label: 'Read reviews', ghost: true }
    ],
    stats: [
      ['50', 'Curated pieces'],
      ['Carbon', 'Neutral shipping'],
      ['2 years', 'Warranty included']
    ]
  },
  {
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1800&q=80',
    alt: 'Rack of neutral toned clothing in a bright studio',
    eyebrow: 'Members get more',
    title: (
      <>
        Join the club.<br />
        Get <span className="accent">15% off.</span>
      </>
    ),
    text: 'Early access to drops, free express shipping and a birthday gift. No spam — just the good stuff.',
    actions: [
      { to: '/#newsletter', label: 'Become a member', arrow: true },
      { to: '/products', label: 'Browse the edit', ghost: true }
    ],
    stats: [
      ['15%', 'Welcome offer'],
      ['Early', 'Drop access'],
      ['Free', 'Returns, always']
    ]
  }
];

const FAQS = [
  {
    question: 'How long does delivery take?',
    answer:
      "Orders placed before 2pm ship the same working day. Standard delivery lands in 2–4 days, express in 24–48 hours. You'll get tracking as soon as the label is printed."
  },
  {
    question: 'What is your returns policy?',
    answer:
      'You have 30 days to change your mind. Items should be unused and in their original packaging. Returns are free within the country and we refund within 3 working days of receipt.'
  },
  {
    question: 'Are the products under warranty?',
    answer:
      "Every electronic piece ships with a two-year warranty. If something goes wrong, message us with your order number and we'll repair or replace it — no receipts to dig up."
  },
  {
    question: 'Do you ship internationally?',
    answer:
      'We ship to 38 countries. Duties are calculated at checkout so there are no surprises at the door. Delivery outside the country usually takes 5–9 working days.'
  }
];

const REVIEWS = [
  {
    quote:
      "The packaging alone made me smile. The headphones are even better — I've worn them eight hours a day for a month.",
    initials: 'MK',
    avatar: 'avatar-1',
    name: 'Maya K.',
    detail: 'Verified buyer · Aurora Headphones',
    stars: 5
  },
  {
    quote:
      'Ordered on Tuesday, wearing it on Thursday. The watch looks far more expensive than it was and the strap is genuinely comfortable.',
    initials: 'JL',
    avatar: 'avatar-2',
    name: 'Jonas L.',
    detail: 'Verified buyer · Meridian Watch',
    stars: 5
  },
  {
    quote:
      "I returned my first order because of the colour and the exchange took two clicks. That's how you earn a customer for life.",
    initials: 'AR',
    avatar: 'avatar-3',
    name: 'Amara R.',
    detail: 'Verified buyer · Field Day Backpack',
    stars: 4.5
  }
];

function getCountdown() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  let diff = Math.max(0, end - now);
  if (diff <= 0) {
    end.setDate(end.getDate() + 1);
    diff = end - now;
  }
  const pad = (number) => String(number).padStart(2, '0');
  return {
    hours: pad(Math.floor(diff / 3600000)),
    minutes: pad(Math.floor((diff % 3600000) / 60000)),
    seconds: pad(Math.floor((diff % 60000) / 1000))
  };
}

function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % HERO_SLIDES.length),
      6500
    );
    return () => clearInterval(timer);
  }, [paused]);

  const go = (next) => setIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <div
      id="heroCarousel"
      className="carousel slide carousel-fade hero-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="carousel-inner">
        {HERO_SLIDES.map((slide, slideIndex) => {
          const Heading = slideIndex === 0 ? 'h1' : 'h2';
          return (
            <div
              className={`carousel-item${slideIndex === index ? ' active' : ''}`}
              key={slide.eyebrow}
              aria-hidden={slideIndex !== index}
            >
              <div className="hero-slide">
                <img
                  src={slide.image}
                  alt={slide.alt}
                  loading={slideIndex === 0 ? 'eager' : 'lazy'}
                  fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                  decoding="async"
                />
                <div className="hero-overlay" />
                <div className="hero-content">
                  <span className="eyebrow eyebrow-light">
                    <span className="pulse-dot" /> {slide.eyebrow}
                  </span>
                  <Heading>{slide.title}</Heading>
                  <p>{slide.text}</p>
                  <div className="d-flex flex-wrap gap-3">
                    {slide.actions.map((action) => (
                      <Link
                        className={`btn ${action.ghost ? 'btn-ghost-light' : 'btn-brand'} btn-lg`}
                        to={action.to}
                        key={action.label}
                      >
                        {action.label}
                        {action.arrow ? <i className="bi bi-arrow-right ms-1" /> : null}
                      </Link>
                    ))}
                  </div>
                  <div className="hero-stats">
                    {slide.stats.map(([value, label], statIndex) => (
                      <span className="contents" key={label}>
                        {statIndex > 0 ? <div className="stat-divider" /> : null}
                        <div>
                          <strong>{value}</strong>
                          <span>{label}</span>
                        </div>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="carousel-indicators hero-indicators">
        {HERO_SLIDES.map((slide, slideIndex) => (
          <button
            type="button"
            className={slideIndex === index ? 'active' : ''}
            key={slide.eyebrow}
            onClick={() => setIndex(slideIndex)}
            aria-current={slideIndex === index ? 'true' : undefined}
            aria-label={`Slide ${slideIndex + 1}`}
          />
        ))}
      </div>

      <button
        className="carousel-control-prev hero-control"
        type="button"
        onClick={() => go(index - 1)}
      >
        <i className="bi bi-arrow-left" />
        <span className="visually-hidden">Previous</span>
      </button>
      <button
        className="carousel-control-next hero-control"
        type="button"
        onClick={() => go(index + 1)}
      >
        <i className="bi bi-arrow-right" />
        <span className="visually-hidden">Next</span>
      </button>
    </div>
  );
}

function ServiceStrip() {
  const services = [
    ['bi-truck', 'Free express shipping', 'On all orders over $150'],
    ['bi-arrow-counterclockwise', '30-day returns', 'Changed your mind? No problem'],
    ['bi-shield-check', 'Secure checkout', 'Encrypted payments, always'],
    ['bi-chat-heart', 'Real human support', 'Mon–Fri, 9am–6pm']
  ];

  return (
    <section className="service-strip">
      <div className="container">
        <div className="service-grid">
          {services.map(([icon, title, text]) => (
            <div className="service-item" key={title}>
              <span className="service-icon"><i className={`bi ${icon}`} /></span>
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ categories, loading }) {
  const cards = useMemo(() => {
    const byName = new Map(categories.map((category) => [category.name, category]));
    const ordered = HOME_CATEGORY_ORDER.map((name) => byName.get(name)).filter(Boolean);
    const extras = categories.filter((category) => !HOME_CATEGORY_ORDER.includes(category.name));
    return [...ordered, ...extras].slice(0, 6);
  }, [categories]);

  return (
    <section className="section" id="categories">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Browse by category</span>
            <h2>Find your next favourite</h2>
          </div>
          <Link to="/products" className="link-arrow">
            View everything <i className="bi bi-arrow-up-right" />
          </Link>
        </div>

        <div className="row g-3 g-lg-4">
          {loading && cards.length === 0
            ? HOME_CATEGORY_ORDER.map((name) => (
                <div className="col-6 col-md-4 col-lg-2" key={name}>
                  <div className="category-card category-skeleton" aria-hidden="true" />
                </div>
              ))
            : (cards.length > 0
                ? cards
                : HOME_CATEGORY_ORDER.map((name) => ({
                    name,
                    count: null,
                    imageUrl: PLACEHOLDER_IMAGE
                  }))
              ).map((category) => (
                <div className="col-6 col-md-4 col-lg-2" key={category.name}>
                  <Link
                    className="category-card"
                    to={`/products?category=${encodeURIComponent(category.name)}`}
                  >
                    <img src={category.imageUrl} alt={category.name} loading="lazy" decoding="async" />
                    <span className="category-label">
                      {category.name}{' '}
                      <small>{category.count != null ? `${category.count} pieces` : 'Browse pieces'}</small>
                    </span>
                  </Link>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}

function DealSection({ deal, onQuickView }) {
  const { addToCart } = useStore();
  const [countdown, setCountdown] = useState(getCountdown);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(getCountdown()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pct = deal ? discountPct(deal) : 0;
  const save = deal && deal.oldPrice ? deal.oldPrice - deal.price : 0;

  return (
    <section className="section pt-0" id="deal">
      <div className="container">
        <div className="deal-panel">
          <div className="row g-0 align-items-stretch">
            <div className="col-lg-6">
              <div className="deal-media">
                <img
                  src={deal ? deal.image : PLACEHOLDER_IMAGE}
                  alt={deal ? `${deal.name} product photo` : 'Deal of the day'}
                  loading="lazy"
                  decoding="async"
                />
                <span className="deal-flag">
                  <i className="bi bi-lightning-charge-fill" />{' '}
                  {pct ? `Save ${pct}%` : 'Staff pick'}
                </span>
                <div className="deal-float">
                  <div className="w-100">{deal ? <Stars rating={deal.rating} /> : null}</div>
                  <small>
                    {deal
                      ? `${deal.rating.toFixed(1)} · from ${deal.reviews.toLocaleString('en-US')} reviews`
                      : 'Loading…'}
                  </small>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="deal-body">
                <span className="eyebrow eyebrow-light">Deal of the day</span>
                <h2>{deal ? deal.name : "Today's deal"}</h2>
                <p className="deal-desc">
                  {deal ? deal.short || deal.desc : "Loading today's hand-picked piece…"}
                </p>

                <div className="countdown" aria-label="Deal countdown">
                  <div className="count-box"><span>{countdown.hours}</span><small>Hours</small></div>
                  <span className="count-sep">:</span>
                  <div className="count-box"><span>{countdown.minutes}</span><small>Mins</small></div>
                  <span className="count-sep">:</span>
                  <div className="count-box"><span>{countdown.seconds}</span><small>Secs</small></div>
                </div>

                <div className="deal-price">
                  <span className="now">{deal ? formatMoney(deal.price) : '—'}</span>
                  <del className={deal && deal.oldPrice ? '' : 'd-none'}>
                    {deal && deal.oldPrice ? formatMoney(deal.oldPrice) : ''}
                  </del>
                  <span className="save-pill">
                    {deal ? (save > 0 ? `You save ${formatMoney(save)}` : 'Free express shipping') : ''}
                  </span>
                </div>

                <div className="deal-actions">
                  <button
                    className="btn btn-brand btn-lg"
                    type="button"
                    disabled={!deal}
                    onClick={() => deal && addToCart(deal.id, 1)}
                  >
                    Add to bag <i className="bi bi-bag-plus ms-1" />
                  </button>
                  <button
                    className="btn btn-ghost-light btn-lg"
                    type="button"
                    disabled={!deal}
                    onClick={() => deal && onQuickView(deal.id)}
                  >
                    Quick view
                  </button>
                </div>

                <div className="stock-wrap">
                  <div className="d-flex justify-content-between">
                    <span>Availability</span>
                    <span>
                      {deal ? (
                        deal.stock > 0 ? (
                          <><strong>{deal.stock}</strong> ready to ship</>
                        ) : (
                          <><strong>Sold out</strong> — back soon</>
                        )
                      ) : (
                        'Checking stock…'
                      )}
                    </span>
                  </div>
                  <div className="progress">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${deal ? Math.max(4, Math.min(100, (deal.stock / 40) * 100)) : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewsSection() {
  return (
    <section className="section pt-0" id="reviews">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="eyebrow">Word of mouth</span>
            <h2>People seem to like us</h2>
          </div>
          <div className="review-score">
            <span className="stars">
              {Array.from({ length: 5 }, (_, index) => (
                <i className="bi bi-star-fill" key={index} />
              ))}
            </span>
            <span><strong>4.9</strong> average from 12,400+ verified buyers</span>
          </div>
        </div>

        <div className="row g-4">
          {REVIEWS.map((review) => (
            <div className="col-md-4" key={review.name}>
              <figure className="review-card">
                <div className="quote-mark" aria-hidden="true">“</div>
                <Stars rating={review.stars} />
                <blockquote>{review.quote}</blockquote>
                <figcaption>
                  <span className={`avatar ${review.avatar}`}>{review.initials}</span>
                  <div>
                    <strong>{review.name}</strong>
                    <small>{review.detail}</small>
                  </div>
                </figcaption>
              </figure>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="section pt-0" id="faq">
      <div className="container">
        <div className="row g-4 g-lg-5 align-items-start">
          <div className="col-lg-6">
            <span className="eyebrow">Good to know</span>
            <h2 className="mb-4">Questions, answered</h2>
            <div className="accordion faq-accordion" id="faqAccordion">
              {FAQS.map((item, index) => {
                const open = openIndex === index;
                return (
                  <div className="accordion-item" key={item.question}>
                    <h3 className="accordion-header">
                      <button
                        className={`accordion-button${open ? '' : ' collapsed'}`}
                        type="button"
                        onClick={() => setOpenIndex(open ? -1 : index)}
                        aria-expanded={open}
                        aria-controls={`faq-${index}`}
                      >
                        {item.question}
                      </button>
                    </h3>
                    <div
                      id={`faq-${index}`}
                      className={`accordion-collapse collapse${open ? ' show' : ''}`}
                    >
                      <div className="accordion-body">{item.answer}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="col-lg-6">
            <NewsletterPanel />
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsletterPanel() {
  const { toast } = useStore();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setInvalid(true);
      toast('Please enter a valid email address.', 'bi-exclamation-circle');
      return;
    }
    setEmail('');
    setInvalid(false);
    toast('You are in. Use WELCOME15 for 15% off your first order.', 'bi-envelope-check');
  }

  return (
    <div className="newsletter-panel" id="newsletter">
      <div className="newsletter-glow" />
      <span className="eyebrow eyebrow-light">
        <i className="bi bi-envelope-paper me-1" /> The Lumen Letter
      </span>
      <h2>Good things,<br />once a week.</h2>
      <p>
        New drops, restock alerts and a genuinely useful guide or two. Join 18,000 people who
        read it with coffee.
      </p>
      <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
        <label className="visually-hidden" htmlFor="newsletterEmail">Email address</label>
        <div className="input-group">
          <input
            type="email"
            className={`form-control${invalid ? ' is-invalid' : ''}`}
            id="newsletterEmail"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (invalid) setInvalid(false);
            }}
          />
          <button className="btn btn-dark-ink" type="submit">
            Subscribe <i className="bi bi-arrow-right ms-1" />
          </button>
        </div>
        <p className="form-note">
          No spam, ever. Unsubscribe in one click. Get 15% off your first order.
        </p>
      </form>
      <div className="newsletter-perks">
        <span><i className="bi bi-check2" /> Early drop access</span>
        <span><i className="bi bi-check2" /> Members-only pricing</span>
        <span><i className="bi bi-check2" /> Free birthday gift</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const {
    products,
    status,
    error,
    retryHydrate,
    quickSearch,
    setQuickSearch,
    toast
  } = useStore();

  useDocumentMeta(
    'Lumen — Curated Everyday Objects',
    'Lumen is a curated online store for beautiful everyday objects — audio, wearables, cameras and more. Free shipping over $150.'
  );

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('featured');
  const [visible, setVisible] = useState(8);
  const [quickId, setQuickId] = useState(null);
  const welcomeScheduled = useRef(false);

  // The header search filters this page live; a fresh visit starts unfiltered.
  useEffect(() => {
    setQuickSearch('');
  }, [setQuickSearch]);

  useEffect(() => {
    let cancelled = false;
    api
      .getCategories()
      .then((payload) => {
        if (!cancelled) setCategories(payload.data || []);
      })
      .catch(() => {
        /* category cards fall back to placeholders */
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVisible(8);
  }, [quickSearch, category, sort]);

  useEffect(() => {
    if (status !== 'ready' || welcomeScheduled.current) return;
    welcomeScheduled.current = true;
    if (readFlag(VISITED_KEY)) return;
    writeFlag(VISITED_KEY);
    const timer = setTimeout(
      () => toast('Welcome to Lumen — use LUMEN10 for 10% off.', 'bi-stars'),
      2200
    );
    return () => clearTimeout(timer);
  }, [status, toast]);

  const filtered = useMemo(
    () => filterAndSortProducts(products, { category, search: quickSearch, sort }),
    [products, category, quickSearch, sort]
  );
  const shown = filtered.slice(0, visible);

  const chipNames = useMemo(() => {
    const names = categories.length ? categories.map((item) => item.name) : HOME_CHIP_ORDER;
    return ['all', ...names].sort((a, b) => {
      if (a === 'all') return -1;
      if (b === 'all') return 1;
      const aIndex = HOME_CHIP_ORDER.indexOf(a);
      const bIndex = HOME_CHIP_ORDER.indexOf(b);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
  }, [categories]);

  const deal = useMemo(
    () =>
      products.find((product) => product.slug === 'aurora-wireless-headphones') ||
      products.find((product) => product.featured) ||
      products[0] ||
      null,
    [products]
  );

  const loading = status === 'loading' && products.length === 0;
  const failed = status === 'error' && products.length === 0;

  function clearFilters() {
    setQuickSearch('');
    setCategory('all');
    setSort('featured');
    setVisible(8);
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <HeroCarousel />
        </div>
      </section>

      <ServiceStrip />

      <CategoriesSection categories={categories} loading={categoriesLoading} />

      <section className="section pt-0" id="products">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">The edit</span>
              <h2>Trending this week</h2>
            </div>
            <p className="section-sub d-none d-md-block">
              Small batch, big character. Every piece is tested by our team before it makes the
              shelf.
            </p>
          </div>

          <div className="shop-toolbar">
            <div className="filter-chips" role="group" aria-label="Filter products by category">
              {chipNames.map((name) => {
                const active = category === name || (name === 'all' && category === 'all');
                return (
                  <button
                    className={`chip${active ? ' is-active' : ''}`}
                    type="button"
                    key={name}
                    onClick={() => setCategory(name)}
                    aria-pressed={active}
                  >
                    {name === 'all' ? 'All' : name}
                  </button>
                );
              })}
            </div>
            <div className="sort-wrap">
              <label className="visually-hidden" htmlFor="sortSelect">Sort products</label>
              <select
                className="form-select"
                id="sortSelect"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="row g-3 g-lg-4" aria-live="polite" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonCard withCard key={index} />
              ))}
            </div>
          ) : failed ? (
            <div className="empty-state">
              <span className="empty-icon"><i className="bi bi-wifi-off" /></span>
              <h3>The edit could not load</h3>
              <p>
                {error && error.message
                  ? error.message
                  : 'Something went wrong while fetching products. Check your connection and try again.'}
              </p>
              <button className="btn btn-brand" type="button" onClick={retryHydrate}>
                Try again <i className="bi bi-arrow-clockwise ms-1" />
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><i className="bi bi-search" /></span>
              <h3>Nothing matched that search</h3>
              <p>Try a different keyword or clear the filters to see the full collection.</p>
              <button className="btn btn-outline-ink" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <div className="row g-3 g-lg-4" aria-live="polite">
              {shown.map((product) => (
                <ProductCard
                  product={product}
                  quickView
                  onQuickView={setQuickId}
                  key={product.id}
                />
              ))}
            </div>
          )}

          <div className="text-center mt-5">
            {filtered.length > visible && filtered.length > 0 ? (
              <button
                className="btn btn-outline-ink btn-lg"
                type="button"
                onClick={() => setVisible((current) => current + 8)}
              >
                Load more pieces <i className="bi bi-plus-lg ms-1" />
              </button>
            ) : null}
            <p className="result-count" aria-live="polite">
              {loading
                ? ''
                : filtered.length === 0
                  ? 'No pieces matched your filters.'
                  : `Showing ${shown.length} of ${filtered.length} piece${filtered.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
      </section>

      <DealSection deal={deal} onQuickView={setQuickId} />

      <ReviewsSection />

      <FaqSection />

      <QuickView productId={quickId} onClose={() => setQuickId(null)} />
    </>
  );
}
