import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo, SiteNav } from "./SiteNav";
import "./carefulto.css";
import "./site-platform.css";

// Page <title> + meta description, matching carefulto.ca page for page.
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "description";
      document.head.appendChild(tag);
    }
    tag.content = description;
  }, [title, description]);
}

// On navigation: jump to the #section if there is one (also when arriving at
// "/#pricing" from another page), otherwise start at the top.
function ScrollManager() {
  const { pathname, hash } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new pathname is exactly when we reset scroll
  useEffect(() => {
    if (hash) {
      // Wait a frame so the target section has rendered.
      const id = decodeURIComponent(hash.slice(1));
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

export function SiteFooter() {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo onDark />
          <p>
            Trusted courier for fragile items and confidential documents across Toronto, the GTA,
            Hamilton &amp; Niagara.
          </p>
        </div>
        <div className="footer-links">
          <h4>Services</h4>
          <ul>
            <li>
              <Link to="/#services">Fragile Delivery</Link>
            </li>
            <li>
              <Link to="/#services">Document Courier</Link>
            </li>
            <li>
              <Link to="/#services">Same-Day Rush</Link>
            </li>
            <li>
              <Link to="/#pricing">Business Accounts</Link>
            </li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Company</h4>
          <ul>
            <li>
              <Link to="/#how">How It Works</Link>
            </li>
            <li>
              <Link to="/#pricing">Pricing</Link>
            </li>
            <li>
              <Link to="/#contact">Book a Delivery</Link>
            </li>
            <li>
              <a href="mailto:info@carefulto.ca">Contact Us</a>
            </li>
            <li>
              <Link to="/support">Customer Support</Link>
            </li>
            <li>
              <Link to="/terms">Terms &amp; Liability</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/cancel">Cancel a Booking</Link>
            </li>
          </ul>
        </div>
        <div className="footer-links">
          <h4>Service Area</h4>
          <ul>
            <li>Toronto &amp; North York</li>
            <li>Scarborough &amp; Etobicoke</li>
            <li>Markham &amp; Richmond Hill</li>
            <li>Vaughan &amp; Aurora</li>
            <li>Newmarket &amp; East Gwillimbury</li>
            <li>Bradford &amp; Guelph</li>
            <li>Mississauga &amp; Oakville</li>
            <li>Burlington &amp; Hamilton</li>
            <li>St. Catharines &amp; Niagara</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <p>&copy; 2026 CarefulTO. All rights reserved. Serving Toronto, Ontario.</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollManager />
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
