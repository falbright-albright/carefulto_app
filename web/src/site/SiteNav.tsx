import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bike, ChevronDown, LayoutDashboard, LogOut, Menu, Package, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";

// The three ways into the platform. One login form serves all of them — the
// account's own role decides which dashboard opens — but naming the doors up
// front tells each kind of visitor where they belong.
export const ROLE_DOORS: { role: Role; label: string; blurb: string; Icon: typeof Package }[] = [
  {
    role: "customer",
    label: "Customer",
    blurb: "Book deliveries and track them to the door",
    Icon: Package,
  },
  { role: "courier", label: "Courier", blurb: "See and accept today's deliveries", Icon: Bike },
  {
    role: "admin",
    label: "Admin",
    blurb: "Dispatch, accounts and business analytics",
    Icon: LayoutDashboard,
  },
];

const SECTIONS = [
  { id: "services", label: "Services" },
  { id: "how", label: "How It Works" },
  { id: "pricing", label: "Pricing" },
];

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      to="/"
      className="logo"
      style={onDark ? { color: "var(--white)" } : undefined}
      aria-label="CarefulTO home"
    >
      Careful<span>TO</span>
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// Close a popover on outside click / Escape, returning focus to its trigger.
function useDismiss(open: boolean, close: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, refs]);
}

// Highlights the homepage section currently in view.
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setActive(null);
      return;
    }
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => !!e,
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return active;
}

function SignInMenu() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => setOpen(false);
  useDismiss(open, close, [btn, panel]);
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLElement>("a")?.focus();
  }, [open]);

  return (
    <div className="signin">
      <button
        ref={btn}
        type="button"
        className="signin-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        Sign in <ChevronDown aria-hidden className="signin-chevron" />
      </button>
      {open && (
        <div ref={panel} id={id} className="signin-panel" role="menu" aria-label="Sign in as">
          <p className="signin-heading">Sign in to CarefulTO</p>
          <ul>
            {ROLE_DOORS.map(({ role, label, blurb, Icon }) => (
              <li key={role}>
                <Link
                  role="menuitem"
                  to={`/login?as=${role}`}
                  className="signin-door"
                  onClick={close}
                >
                  <span className="signin-door-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span>
                    <span className="signin-door-label">{label}</span>
                    <span className="signin-door-blurb">{blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="signin-foot">
            New customer?{" "}
            <Link role="menuitem" to="/register" onClick={close}>
              Create an account
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = () => setOpen(false);
  useDismiss(open, close, [btn, panel]);
  if (!user) return null;

  return (
    <div className="signin">
      <button
        ref={btn}
        type="button"
        className="account-trigger"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="account-avatar" aria-hidden>
          {initials(user.name)}
        </span>
        <ChevronDown aria-hidden className="signin-chevron" />
      </button>
      {open && (
        <div ref={panel} id={id} className="signin-panel account-panel" role="menu">
          <p className="account-name">{user.name}</p>
          <p className="account-meta">
            {user.email}
            <span className="account-role">{user.role}</span>
          </p>
          <Link role="menuitem" to="/app" className="account-item" onClick={close}>
            <LayoutDashboard aria-hidden /> Open dashboard
          </Link>
          <button
            role="menuitem"
            type="button"
            className="account-item"
            onClick={async () => {
              close();
              await logout();
              navigate("/");
            }}
          >
            <LogOut aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = useActiveSection(pathname === "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Close the phone menu whenever the route changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => setMobileOpen(false), [pathname]);

  // Customers book from their dashboard; everyone else lands on the booking section.
  const bookHref = user?.role === "customer" ? "/app" : "/#contact";

  return (
    <nav className={scrolled ? "scrolled" : undefined} aria-label="Main">
      <div className="container nav-inner">
        <Logo />
        <ul className="nav-links">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <Link
                to={`/#${s.id}`}
                className={active === s.id ? "nav-active" : undefined}
                aria-current={active === s.id ? "location" : undefined}
              >
                {s.label}
              </Link>
            </li>
          ))}
          <li className="nav-divider" aria-hidden />
          <li>
            {user ? (
              <Link to="/app" className="nav-dashboard">
                Dashboard
              </Link>
            ) : (
              <SignInMenu />
            )}
          </li>
          {user && (
            <li>
              <AccountMenu />
            </li>
          )}
          <li>
            <Link to={bookHref} className="btn-nav">
              Book a Delivery
            </Link>
          </li>
        </ul>
        <button
          type="button"
          className="hamburger"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="mobileMenu"
        >
          {mobileOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
      <div className={mobileOpen ? "nav-mobile open" : "nav-mobile"} id="mobileMenu">
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <Link to={`/#${s.id}`} onClick={() => setMobileOpen(false)}>
                {s.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/support">Customer Support</Link>
          </li>
        </ul>
        {user ? (
          <div className="nav-mobile-auth">
            <p className="signin-heading">Signed in as {user.name}</p>
            <Link to="/app" className="btn-primary nav-mobile-cta">
              Open dashboard
            </Link>
          </div>
        ) : (
          <div className="nav-mobile-auth">
            <p className="signin-heading">Sign in</p>
            <ul>
              {ROLE_DOORS.map(({ role, label, blurb, Icon }) => (
                <li key={role}>
                  <Link to={`/login?as=${role}`} className="signin-door">
                    <span className="signin-door-icon" aria-hidden>
                      <Icon />
                    </span>
                    <span>
                      <span className="signin-door-label">{label}</span>
                      <span className="signin-door-blurb">{blurb}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/#contact"
              className="btn-primary nav-mobile-cta"
              onClick={() => setMobileOpen(false)}
            >
              Book a Delivery
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
