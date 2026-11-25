import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SiteLayout, usePageMeta } from "./SiteLayout";

// carefulto.ca/cancel, word for word. The live site posts this form to
// Netlify Forms; here it opens a pre-filled email to info@carefulto.ca so a
// request always reaches a person, with no new backend.
export function cancellationMailto(f: {
  ref: string;
  name: string;
  email: string;
  reason: string;
}): string {
  const subject = `Cancellation request — ${f.ref}`;
  const body = [
    `Booking reference: ${f.ref}`,
    `Name: ${f.name}`,
    `Email: ${f.email}`,
    "",
    `Reason: ${f.reason || "(not given)"}`,
  ].join("\n");
  return `mailto:info@carefulto.ca?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function CancelPage() {
  usePageMeta(
    "Cancel a Booking — CarefulTO",
    "Cancel a CarefulTO courier booking. Full refund when cancelled more than 2 hours before pickup.",
  );
  const [params] = useSearchParams();
  const [ref, setRef] = useState((params.get("ref") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = cancellationMailto({ ref, name, email, reason });
    setSent(true);
  };

  return (
    <SiteLayout>
      <div className="cancel-page">
        <div className="cancel-inner">
          <h1>Cancel a Booking</h1>
          <p>
            Changed your plans? Submit the form below and we'll process your cancellation. Refunds
            are issued manually within 1–2 business days.
          </p>

          <div className="policy-box">
            <p>
              <strong>Cancellation Policy:</strong> Cancellations submitted more than 2 hours before
              your scheduled pickup are eligible for a full refund. Cancellations received less than
              2 hours before pickup may be subject to a <strong>$10 cancellation fee</strong>. Your
              booking reference can be found in your confirmation email.
            </p>
          </div>

          <div className="cancel-explainer">
            <h2>How Cancellations Work</h2>
            <div className="next-steps">
              <div className="next-step-item">
                <div className="step-dot">1</div>
                <p>
                  <strong>Submit your booking reference</strong> from your confirmation email, along
                  with your name and email, using the form below.
                </p>
              </div>
              <div className="next-step-item">
                <div className="step-dot">2</div>
                <p>
                  <strong>We review your request</strong> during business hours (Monday–Saturday,
                  8am–7pm) and confirm by email within 30 minutes.
                </p>
              </div>
              <div className="next-step-item">
                <div className="step-dot">3</div>
                <p>
                  <strong>Your refund is processed</strong> manually via Stripe within 1–2 business
                  days, back to your original payment method.
                </p>
              </div>
            </div>
          </div>

          <form className="cancel-form" onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="cancelBookingRef">Booking Reference *</label>
              <input
                type="text"
                id="cancelBookingRef"
                className="booking-ref-input"
                placeholder="e.g. CS3K9X2A"
                required
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cancelName">Your Name *</label>
                <input
                  type="text"
                  id="cancelName"
                  placeholder="Jane Smith"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cancelEmail">Email Address *</label>
                <input
                  type="email"
                  id="cancelEmail"
                  placeholder="jane@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="cancelReason">Reason for Cancellation</label>
              <textarea
                id="cancelReason"
                rows={3}
                placeholder="Optional — let us know why you're cancelling so we can improve."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-submit">
              Submit Cancellation Request
            </button>
            <p className="form-note">
              We'll confirm your cancellation by email within 30 minutes during business hours
              (Mon–Sat, 8am–7pm).
            </p>
            {sent && (
              <div className="form-success-cancel" role="status" style={{ display: "block" }}>
                ✅ Your email app should now be open with the request filled in — press send and
                we'll be in touch shortly to confirm. Nothing opened? Email{" "}
                <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> with your booking
                reference.
              </div>
            )}
          </form>

          <div className="cancel-faq">
            <h2>Cancellation Questions</h2>
            <details className="faq-item">
              <summary className="faq-question">Will I get a full refund?</summary>
              <div className="faq-answer">
                <p>
                  Yes — cancellations submitted more than 2 hours before your scheduled pickup are
                  refunded in full. Inside that window, a $10 cancellation fee applies to cover
                  driver scheduling.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary className="faq-question">
                I need to change the date, not cancel. What do I do?
              </summary>
              <div className="faq-answer">
                <p>
                  Email <a href="mailto:info@carefulto.ca">info@carefulto.ca</a> with your booking
                  reference and preferred new date instead of cancelling — we'll do our best to
                  accommodate a reschedule without a new booking fee.
                </p>
              </div>
            </details>
            <details className="faq-item">
              <summary className="faq-question">Where do I find my booking reference?</summary>
              <div className="faq-answer">
                <p>
                  It's in your booking confirmation email, and on the payment confirmation page you
                  saw right after checkout.
                </p>
              </div>
            </details>
            <p className="cancel-more-help">
              Have a different question? Visit our <Link to="/support">Customer Support</Link> page
              for the full FAQ.
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
