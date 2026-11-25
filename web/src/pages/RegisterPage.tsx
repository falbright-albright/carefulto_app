import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { AuthShell } from "@/site/AuthShell";
import { usePageMeta } from "@/site/SiteLayout";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  usePageMeta(
    "Create an account — CarefulTO",
    "Create a CarefulTO customer account to book deliveries online.",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const user = await register(email, name, password);
      toast.success(`Welcome to CarefulTO, ${user.name.split(" ")[0]}`);
      navigate("/app", { replace: true });
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.message
          : "We couldn't create your account. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      aside={
        <>
          <span className="badge">Toronto's White-Glove Courier</span>
          <h1>
            We Deliver What
            <br />
            <span>Matters Most.</span>
          </h1>
          <p>
            Create your account to book deliveries online and follow each one from pickup to your
            recipient's door.
          </p>
          <ul className="auth-points">
            <li>
              <span className="check">&#10003;</span> Same-day available — book before noon
            </li>
            <li>
              <span className="check">&#10003;</span> Toronto, GTA &amp; beyond
            </li>
            <li>
              <span className="check">&#10003;</span> Mon–Sat, 8am–7pm
            </li>
          </ul>
        </>
      }
    >
      <h2>Create your account</h2>
      <p className="auth-sub">
        For customers booking deliveries. Couriers and admins get their accounts from CarefulTO.
      </p>
      <form onSubmit={submit} className="auth-form">
        {err && (
          <p className="auth-error" role="alert">
            {err}
          </p>
        )}
        <div className="form-group">
          <label htmlFor="name">Your Name</label>
          <input
            id="name"
            autoComplete="name"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            aria-describedby="pw-hint"
          />
          <span id="pw-hint" className="auth-hint">
            At least 8 characters.
          </span>
        </div>
        <button type="submit" className="btn-submit" disabled={busy}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
      <p className="auth-alt">
        Before booking, please read our <Link to="/terms">Terms &amp; Liability</Link> and{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
      <p className="auth-alt">
        Already have an account? <Link to="/login?as=customer">Sign in</Link>
      </p>
    </AuthShell>
  );
}
