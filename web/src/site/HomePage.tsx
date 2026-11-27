import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SiteLayout, usePageMeta } from "./SiteLayout";

// The carefulto.ca homepage, section for section. Copy is kept word-for-word
// from the live site; the only change is the booking section, which now books
// through a CarefulTO account on this platform instead of the old form.

function BookingPanel() {
  const { user } = useAuth();
  const isCustomer = user?.role === "customer";
  return (
    <div className="booking-form booking-panel">
      <h3 className="booking-panel-title">
        {isCustomer ? "Ready when you are" : "Book online in your CarefulTO account"}
      </h3>
      <ol className="booking-steps">
        <li>
          <span className="step-dot">1</span>
          <p>
            <strong>{isCustomer ? "You're signed in" : "Create your free account"}</strong>
            {isCustomer
              ? ` as ${user.name}.`
              : " — or sign in if you already have one. It takes under a minute."}
          </p>
        </li>
        <li>
          <span className="step-dot">2</span>
          <p>
            <strong>Tell us what you're sending</strong> and pick the pickup and delivery addresses.
            Your price is shown before you book.
          </p>
        </li>
        <li>
          <span className="step-dot">3</span>
          <p>
            <strong>Follow it from your dashboard</strong> — from pickup to delivered, and confirm
            when it arrives.
          </p>
        </li>
      </ol>

      {isCustomer ? (
        <Link to="/app" className="btn-submit booking-panel-cta">
          Book a Delivery
        </Link>
      ) : user ? (
        <Link to="/app" className="btn-submit booking-panel-cta">
          Open your dashboard
        </Link>
      ) : (
        <div className="booking-panel-actions">
          <Link to="/register" className="btn-primary">
            Create an account
          </Link>
          <Link to="/login?as=customer" className="btn-ghost-dark">
            Sign in to book
          </Link>
        </div>
      )}

      <div className="heavy-notice">
        <span aria-hidden="true">⚠️</span>
        <div>
          <strong>Custom quote required</strong>
          <p>
            Parcels over 10kg are priced individually. Please email{" "}
            <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> or call us directly and we'll
            get back to you with a quote.
          </p>
        </div>
      </div>

      <p className="form-note booking-panel-note">
        📋 <strong>Booking online is the fastest way to secure your delivery.</strong> All bookings
        are subject to availability confirmation — we'll contact you within 30 minutes during
        business hours (Mon–Sat, 8am–7pm) to confirm your slot. As a solo, owner-operated courier,
        we may not be reachable by phone during active deliveries — if we miss your call, we'll get
        back to you promptly.
      </p>
    </div>
  );
}

export default function HomePage() {
  usePageMeta(
    "CarefulTO — Same-Day Courier for Fragile Items & Documents in Toronto",
    "White-glove courier for fragile items and confidential documents across Toronto, the GTA, Hamilton & Niagara. Flat-rate pricing from $25, same-day available, photo-confirmed delivery. Book online.",
  );

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <span className="badge">Toronto's White-Glove Courier</span>
            <h1>
              We Deliver What <br />
              <span>Matters Most.</span>
            </h1>
            <p>
              Fragile items, confidential documents, and time-sensitive parcels — handled with care,
              delivered on time across Toronto.
            </p>
            <div className="hero-cta">
              <Link to="/#contact" className="btn-primary">
                Book a Delivery
              </Link>
              <Link to="/#services" className="btn-ghost">
                See What We Deliver
              </Link>
            </div>
            <div className="hero-trust">
              <div className="trust-item">
                <span className="check">&#10003;</span> Same-day available — book before noon
              </div>
              <div className="trust-item">
                <span className="check">&#10003;</span> Flat rate pricing
              </div>
              <div className="trust-item">
                <span className="check">&#10003;</span> Toronto, GTA &amp; beyond
              </div>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="/brand/courier-service-hero.jpg"
              alt="CarefulTO courier delivering a package in Toronto"
              width={1440}
              height={810}
              loading="eager"
            />
            <div className="hero-card">
              <div className="card-icon" aria-hidden="true">
                📦
              </div>
              <div className="card-label">
                Package picked up <span className="card-sub">Handled with care</span>
              </div>
            </div>
            <div className="hero-card card-2">
              <div className="card-icon" aria-hidden="true">
                📄
              </div>
              <div className="card-label">
                Gently sent <span className="card-sub">Safe &amp; confidential</span>
              </div>
            </div>
            <div className="hero-card card-3">
              <div className="card-icon" aria-hidden="true">
                ✅
              </div>
              <div className="card-label">
                Delivery confirmed <span className="card-sub">Photo on arrival</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHO WE SERVE */}
      <section className="clients">
        <div className="container">
          <p className="clients-label">Trusted by Toronto businesses including</p>
          <div className="clients-list">
            <span>Law Firms</span>
            <span>Florists</span>
            <span>Bakeries</span>
            <span>Medical Clinics</span>
            <span>Real Estate Offices</span>
            <span>Art Galleries</span>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="services" id="services">
        <div className="container">
          <div className="section-header">
            <h2>What We Deliver</h2>
            <p>Specialized in the shipments that other couriers treat carelessly.</p>
          </div>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon" aria-hidden="true">
                🧁
              </div>
              <h3>Fragile Items</h3>
              <p>
                Cakes, glassware, artwork, flowers, and anything that needs a gentle touch. We treat
                every parcel like it's irreplaceable — because to you, it is.
              </p>
              <ul>
                <li>Cake &amp; bakery orders</li>
                <li>Floral arrangements</li>
                <li>Glassware &amp; ceramics</li>
                <li>Art &amp; framed prints</li>
              </ul>
            </div>
            <div className="service-card featured">
              <div className="service-badge">Most Popular</div>
              <div className="service-icon" aria-hidden="true">
                📋
              </div>
              <h3>Legal &amp; Business Documents</h3>
              <p>
                Contracts, agreements, medical files, and confidential paperwork. Delivered
                discreetly, with care and a confirmation on arrival.
              </p>
              <ul>
                <li>Legal contracts</li>
                <li>Real estate documents</li>
                <li>Medical &amp; dental records</li>
                <li>Corporate correspondence</li>
              </ul>
            </div>
            <div className="service-card">
              <div className="service-icon" aria-hidden="true">
                🚀
              </div>
              <h3>Same-Day Rush</h3>
              <p>
                When it absolutely must arrive today. Book before noon for same-day delivery across
                Toronto.
              </p>
              <ul>
                <li>Priority pickup</li>
                <li>Direct route delivery</li>
                <li>Real-time updates</li>
                <li>Photo confirmation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="how">
        <div className="container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Three simple steps. No apps, no confusion.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3>Call or Book Online</h3>
              <p>
                Fill out our quick booking form or call us at{" "}
                <a href="tel:+12494381212" className="link-accent">
                  (249) 438-1212
                </a>
                . Tell us what you're sending, where it's going, and when you need it.
              </p>
            </div>
            <div className="step-arrow" aria-hidden="true">
              →
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3>We Pick It Up</h3>
              <p>
                We'll reach out before pickup to confirm the time. Then we arrive at your door,
                handle your parcel with care, and confirm pickup with you.
              </p>
            </div>
            <div className="step-arrow" aria-hidden="true">
              →
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3>Delivered &amp; Confirmed</h3>
              <p>
                Your parcel arrives safely. We send you a photo confirmation the moment it's
                delivered.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="section-header">
            <h2>Simple, Flat-Rate Pricing</h2>
            <p>No hidden fees. No fuel surcharges. What you see is what you pay.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card">
              <h3>Toronto &amp; Inner GTA</h3>
              <div className="price">$25</div>
              <div className="price-note">per delivery</div>
              <p>Toronto, North York, Scarborough, Etobicoke, Markham, Richmond Hill, Vaughan.</p>
              <Link to="/#contact" className="btn-primary">
                Book Now
              </Link>
            </div>
            <div className="price-card featured">
              <div className="price-badge">Most Common</div>
              <h3>Outer GTA &amp; Beyond</h3>
              <div className="price">$45</div>
              <div className="price-note">per delivery</div>
              <p>
                Aurora, Newmarket, East Gwillimbury, Bradford, Mississauga, Oakville, Burlington,
                Guelph, Hamilton, St. Catharines &amp; Niagara.
              </p>
              <Link to="/#contact" className="btn-primary">
                Book Now
              </Link>
            </div>
            <div className="price-card">
              <h3>Business Account</h3>
              <div className="price">Custom</div>
              <div className="price-note">monthly plan</div>
              <p>For businesses with regular delivery needs. Volume discounts available.</p>
              <a
                href="mailto:info@carefulto.ca?subject=Business%20account%20quote"
                className="btn-ghost-dark"
              >
                Get a Quote
              </a>
            </div>
          </div>
          <p className="pricing-note">
            Rush/same-day bookings: +$10 surcharge. Parcels over 10kg: contact us for pricing.
          </p>
        </div>
      </section>

      {/* VISION */}
      <section className="vision">
        <div className="container">
          <div className="vision-inner">
            <div className="vision-label">Our Vision</div>
            <blockquote className="vision-statement">
              To become Ontario's most trusted name in white-glove local delivery — a courier
              service where every parcel is treated as irreplaceable, and every client feels like
              they're our only one.
            </blockquote>
            <p className="vision-sub">
              We believe that how something is delivered says as much as what is delivered.
              CarefulTO exists to raise the standard.
            </p>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="why">
        <div className="container">
          <div className="why-inner">
            <div className="why-text">
              <h2>Why Businesses Choose CarefulTO</h2>
              <div className="why-points">
                {[
                  [
                    "🤲",
                    "White-Glove Handling",
                    "We don't just drop and go. Every item is handled personally by us — not passed between warehouses or sorting facilities.",
                  ],
                  [
                    "📍",
                    "Local & Accountable",
                    "We're a local Ontario business serving Toronto, the GTA, and beyond. You can actually reach us — no call centres, no tracking loops.",
                  ],
                  [
                    "📸",
                    "Photo Proof of Delivery",
                    "Every delivery includes a photo confirmation sent directly to you. Peace of mind, every time.",
                  ],
                  [
                    "💬",
                    "Direct Communication",
                    "Call or email us directly — real updates, real responses, no call centres or automated queues.",
                  ],
                  ["🍁", "Proud CIRA Member", "Committed to a trusted, secure Canadian internet."],
                ].map(([icon, title, body]) => (
                  <div className="why-point" key={title}>
                    <span className="why-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="why-image">
              <div className="stat-box">
                <div className="stat">100%</div>
                <div className="stat-label">Photo confirmed deliveries</div>
              </div>
              <div className="stat-box">
                <div className="stat">
                  Same
                  <br />
                  Day
                </div>
                <div className="stat-label">Available across Toronto</div>
              </div>
              <div className="stat-box">
                <div className="stat">0</div>
                <div className="stat-label">Hidden fees or surcharges</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT / BOOKING */}
      <section className="contact" id="contact">
        <div className="container">
          <div className="contact-inner">
            <div className="contact-text">
              <h2>Book a Delivery</h2>
              <p>
                Book online through your CarefulTO account and we'll confirm your booking within 30
                minutes during business hours (Mon–Sat, 8am–7pm).
              </p>
              <div className="contact-details">
                <div className="contact-item">
                  <span aria-hidden="true">✉️</span>
                  <a href="mailto:info@carefulto.ca">info@carefulto.ca</a>
                </div>
                <div className="contact-item">
                  <span aria-hidden="true">📞</span>
                  <a href="tel:+12494381212">(249) 438-1212</a>
                </div>
                <div className="contact-item">
                  <span aria-hidden="true">🕐</span>
                  <span>Mon–Sat, 8am–7pm</span>
                </div>
                <div className="contact-item">
                  <span aria-hidden="true">📍</span>
                  <span>Toronto, GTA, Hamilton &amp; Niagara</span>
                </div>
              </div>
            </div>
            <BookingPanel />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
