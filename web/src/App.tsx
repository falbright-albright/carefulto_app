import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Badge } from "@/components/ui/badge";
import { LogOut } from "lucide-react";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import CustomerDashboard from "@/pages/CustomerDashboard";
import CourierDashboard from "@/pages/CourierDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import HomePage from "@/site/HomePage";
import SupportPage from "@/site/SupportPage";
import CancelPage from "@/site/CancelPage";
import LegalPage, { NotFoundPage } from "@/site/LegalPage";
import OrderPage from "@/pages/OrderPage";
import AccountPage from "@/pages/AccountPage";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="text-[1.3rem] font-extrabold tracking-[-0.5px] text-[#0f1f3d]"
            aria-label="CarefulTO home"
          >
            Careful<span className="text-[#e8a020]">TO</span>
          </Link>
          <Badge variant="outline" className="capitalize">
            {user.role}
          </Badge>
        </div>
        {/* On phones Log out is icon-only so the header fits at 375px. */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
          <NotificationsBell />
          <Button
            variant="outline"
            size="sm"
            aria-label="Log out"
            title="Log out"
            className="px-2.5 sm:px-3"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Dashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "courier") return <CourierDashboard />;
  return <CustomerDashboard />;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container py-8">{children}</main>
    </div>
  );
}

// Gate for platform pages: wait for the session check, send signed-out
// visitors to the login page, otherwise render inside the app header.
function SignedIn({
  loading,
  user,
  children,
}: {
  loading: boolean;
  user: unknown;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public CarefulTO website (mirrors carefulto.ca) */}
      <Route path="/" element={<HomePage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/cancel" element={<CancelPage />} />
      <Route path="/terms" element={<LegalPage page="terms" />} />
      <Route path="/privacy" element={<LegalPage page="privacy" />} />

      {/* Accounts. Signed-in visitors skip straight to their dashboard. */}
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <RegisterPage />} />

      {/* The platform: the dashboard (chosen by the account's role) and the
          order page that notifications link to. Both need a signed-in user. */}
      <Route
        path="/app"
        element={
          <SignedIn loading={loading} user={user}>
            <Dashboard />
          </SignedIn>
        }
      />
      <Route
        path="/admin/users/:id"
        element={
          <SignedIn loading={loading} user={user}>
            <AccountPage />
          </SignedIn>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <SignedIn loading={loading} user={user}>
            <OrderPage />
          </SignedIn>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
