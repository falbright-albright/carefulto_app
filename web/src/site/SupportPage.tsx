import { Link } from "react-router-dom";
import { SiteLayout, usePageMeta } from "./SiteLayout";

// carefulto.ca/support, word for word.
export default function SupportPage() {
  usePageMeta(
    "Customer Support & FAQ — CarefulTO Toronto Courier",
    "Answers to common questions about CarefulTO bookings, cancellations, damage claims, photo confirmation and service areas — and a direct line to us.",
  );
  return (
    <SiteLayout>
      <div className="page-hero">
        <div className="container">
          <h1>Customer Support</h1>
          <p>Answers to common questions — and a direct line to us when you need it.</p>
        </div>
      </div>

      <div className="page-body">
        <div className="container">
          <div className="support-layout">
            <div className="faq-section">
              <div className="response-banner">
                <p>
                  <strong>Response time:</strong> We respond to all emails within 1 business day,
                  Monday–Saturday, 8am–7pm. For same-day bookings, please book before noon. We don't
                  offer after-hours support — if your delivery is time-sensitive, please plan ahead.
                </p>
              </div>

              <h2>Frequently Asked Questions</h2>

              <details className="faq-item">
                <summary className="faq-question">How do I cancel or reschedule a booking?</summary>
                <div className="faq-answer">
                  <p>
                    You can cancel at no charge up to 2 hours before your scheduled pickup time.
                    Submit a <Link to="/cancel">cancellation request here</Link> and we'll process
                    your refund within 1–2 business days.
                  </p>
                  <p>
                    To reschedule, email <a href="mailto:info@carefulto.ca">info@carefulto.ca</a>{" "}
                    with your booking details and preferred new date. We'll do our best to
                    accommodate.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  What if my item is damaged during delivery?
                </summary>
                <div className="faq-answer">
                  <p>
                    We take every precaution with every parcel — but in the event of damage, please
                    email <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> within 48 hours
                    of your scheduled delivery time.
                  </p>
                  <p>
                    Our full liability policy, including coverage limits and how to file a claim, is
                    set out in our <Link to="/terms#liability">Terms of Service</Link>. We respond
                    to all claims within 5 business days.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">How does photo confirmation work?</summary>
                <div className="faq-answer">
                  <p>
                    At the moment of delivery, we take a photo of your parcel at the recipient's
                    door and email it to you directly. You'll receive this confirmation the same day
                    your delivery completes — no need to follow up or chase a tracking link.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  What counts as same-day delivery, and when do I need to book?
                </summary>
                <div className="faq-answer">
                  <p>
                    Same-day delivery means pickup and drop-off both happen on the day you book. To
                    be considered for same-day service across Toronto, please book before noon.
                  </p>
                  <p>
                    A $10 rush surcharge applies on top of your standard zone rate. Same-day
                    availability depends on our schedule — if we can't accommodate your request,
                    we'll let you know immediately.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">What areas do you deliver to?</summary>
                <div className="faq-answer">
                  <p>
                    <strong>Inner GTA ($25):</strong> Toronto, North York, Scarborough, Etobicoke,
                    Markham, Richmond Hill, Vaughan.
                  </p>
                  <p>
                    <strong>Outer GTA &amp; Beyond ($45):</strong> Aurora, Newmarket, East
                    Gwillimbury, Bradford, Mississauga, Oakville, Burlington, Guelph, Hamilton, St.
                    Catharines, Niagara Region.
                  </p>
                  <p>
                    If your destination isn't on this list, email us at{" "}
                    <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> before booking and
                    we'll let you know if we can help.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">What payment methods do you accept?</summary>
                <div className="faq-answer">
                  <p>
                    We accept all major credit and debit cards through our secure checkout, powered
                    by Stripe. Payment is collected in full at the time of booking. You'll receive
                    an email receipt automatically.
                  </p>
                  <p>We do not accept cash, e-transfer, or payment at the door.</p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">How do I book a business account?</summary>
                <div className="faq-answer">
                  <p>
                    Business accounts are available for clients with regular delivery needs. Volume
                    discounts and monthly invoicing are available. Email{" "}
                    <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> with a brief
                    description of your volume and we'll put together a custom plan.
                  </p>
                </div>
              </details>
            </div>

            <aside className="contact-sidebar">
              <div className="contact-card">
                <h3>Call or Email Us</h3>
                <p>A real person picks up. We reply to emails within 1 business day.</p>
                <a href="tel:+12494381212" className="btn-primary">
                  (249) 438-1212
                </a>
                <a href="mailto:info@carefulto.ca" className="btn-ghost-dark">
                  info@carefulto.ca
                </a>
              </div>

              <div className="contact-card">
                <h3>Cancel a Booking</h3>
                <p>
                  Need to cancel or reschedule? Use the cancellation form for the fastest response.
                </p>
                <Link className="btn-ghost-dark" to="/cancel">
                  Go to Cancel Form
                </Link>
              </div>

              <div className="hours-card">
                <h3>Support Hours</h3>
                <div className="hours-row">
                  <span>Monday – Saturday</span>
                  <span>8am – 7pm</span>
                </div>
                <div className="hours-row">
                  <span>Sunday</span>
                  <span>Closed</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
