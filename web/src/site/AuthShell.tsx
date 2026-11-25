import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "./carefulto.css";
import "./site-platform.css";
import "./auth.css";

// Split-screen frame for sign-in and sign-up, in the CarefulTO brand: the
// navy hero panel (with the site's courier photo) beside a plain white form.
export function AuthShell({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="site auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside-top">
          <Link to="/" className="logo auth-logo" aria-label="CarefulTO home">
            Careful<span>TO</span>
          </Link>
          <Link to="/" className="auth-back">
            <ArrowLeft aria-hidden /> Back to site
          </Link>
        </div>
        <div className="auth-aside-body">{aside}</div>
        <figure className="auth-photo">
          <img src="/brand/courier-service-hero.jpg" alt="" width={1440} height={810} />
        </figure>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
