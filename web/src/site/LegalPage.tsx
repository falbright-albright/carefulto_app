import { Link, useNavigate } from "react-router-dom";
import { SiteLayout, usePageMeta } from "./SiteLayout";
import terms from "./content/terms.html?raw";
import privacy from "./content/privacy.html?raw";

// Terms and Privacy are long legal documents; their HTML is kept verbatim from
// carefulto.ca in ./content so the wording can't drift during a rewrite into
// JSX. It's first-party, build-time content (never user input).
const PAGES = {
  terms: {
    html: terms,
    title: "Terms of Service & Liability — CarefulTO",
    description:
      "CarefulTO's Terms of Service: booking & payment, prohibited items, liability limits for fragile items and documents, cancellation policy, and service area for our Toronto courier.",
  },
  privacy: {
    html: privacy,
    title: "Privacy Policy — CarefulTO",
    description:
      "How CarefulTO collects, uses, and protects your personal information for Toronto courier bookings, in line with PIPEDA.",
  },
} as const;

export default function LegalPage({ page }: { page: keyof typeof PAGES }) {
  const { html, title, description } = PAGES[page];
  usePageMeta(title, description);
  const navigate = useNavigate();

  // Route internal links (e.g. /cancel, /terms#liability) through the router
  // instead of a full page reload; in-page #anchors scroll normally.
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!a || !href || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    if (href.startsWith("/")) {
      e.preventDefault();
      navigate(href);
    } else if (href.startsWith("#")) {
      e.preventDefault();
      document.getElementById(href.slice(1))?.scrollIntoView({ block: "start" });
      history.replaceState(null, "", href);
    }
  };

  return (
    <SiteLayout>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: delegates clicks on the links inside */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: links keep their own keyboard behaviour */}
      <div onClick={onClick} className="legal-page">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: verbatim first-party legal copy bundled at build time */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </SiteLayout>
  );
}

export function NotFoundPage() {
  usePageMeta("Page not found — CarefulTO", "This page doesn't exist.");
  return (
    <SiteLayout>
      <div className="success-page">
        <div className="success-card">
          <span className="success-icon" aria-hidden="true">
            📦
          </span>
          <h1>We couldn't find that page</h1>
          <p>The link may be out of date. Everything we offer is a click away from the homepage.</p>
          <div className="success-actions">
            <Link className="btn-primary" to="/">
              Back to Home
            </Link>
            <Link className="cancel-link" to="/support">
              Visit Customer Support
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
