import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError, type Role } from "@/lib/api";
import { AuthShell } from "@/site/AuthShell";
import { usePageMeta } from "@/site/SiteLayout";
import { ROLE_DOORS } from "@/site/SiteNav";

// What each kind of account does on the platform, shown beside the form.
const ROLE_COPY: Record<Role, { lead: string; accent: string; body: string; points: string[] }> = {
  customer: {
    lead: "Your deliveries,",
    accent: "in one place.",
    body: "Book a pickup, see your price before you confirm, and follow every delivery to the door.",
    points: [
      "Price shown before you book",
      "Track each delivery's status",
      "Confirm when it arrives",
    ],
  },
  courier: {
    lead: "Today's deliveries,",
    accent: "ready to go.",
    body: "See the deliveries recommended to you, accept the ones you can take, and report each one delivered.",
    points: [
      "New jobs as soon as they're assigned",
      "Pickup, drop-off and delivery notes",
      "Report delivered in one tap",
    ],
  },
  admin: {
    lead: "Run the business",
    accent: "at a glance.",
    body: "Assign orders to couriers, manage accounts and see how CarefulTO is doing month by month.",
    points: [
      "Recommend orders to couriers",
      "Create courier and admin accounts",
      "Analytics by region and category",
    ],
  },
};

function asRole(v: string | null): Role {
  return v === "courier" || v === "admin" ? v : "customer";
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  usePageMeta(
    "Sign in — CarefulTO",
    "Sign in to your CarefulTO customer, courier or admin account.",
  );
  const [params] = useSearchParams();
  const role = asRole(params.get("as"));
  const copy = ROLE_COPY[role];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // The account's own role decides the dashboard, whichever door was used.
      const user = await login(email, password);
      toast.success(
        user.role === role
          ? `Welcome back, ${user.name.split(" ")[0]}`
          : `Signed in to your ${user.role} account`,
      );
      navigate("/app", { replace: true });
    } catch (e) {
      setErr(
        e instanceof ApiError ? e.message : "Sign in failed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      aside={
        <>
          <span className="badge">{ROLE_DOORS.find((d) => d.role === role)?.label} sign in</span>
          <h1>
            {copy.lead}
            <br />
            <span>{copy.accent}</span>
          </h1>
          <p>{copy.body}</p>
          <ul className="auth-points">
            {copy.points.map((p) => (
              <li key={p}>
                <span className="check">&#10003;</span> {p}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <h2>Sign in</h2>
      <p className="auth-sub">Use the email and password for your CarefulTO account.</p>

      <nav className="role-switch" aria-label="I am signing in as">
        {ROLE_DOORS.map(({ role: r, label, Icon }) => (
          <Link
            key={r}
            to={`/login?as=${r}`}
            replace
            aria-current={r === role ? "page" : undefined}
          >
            <Icon aria-hidden />
            {label}
          </Link>
        ))}
      </nav>

      <form onSubmit={submit} className="auth-form" noValidate={false}>
        {err && (
          <p className="auth-error" role="alert">
            {err}
          </p>
        )}
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="auth-alt">
        {role === "customer" ? (
          <>
            New to CarefulTO? <Link to="/register">Create a customer account</Link>
          </>
        ) : (
          <>
            {role === "courier" ? "Courier" : "Admin"} accounts are created by a CarefulTO
            administrator. Need help? <a href="mailto:info@carefulto.ca">info@carefulto.ca</a>
          </>
        )}
      </p>
    </AuthShell>
  );
}
