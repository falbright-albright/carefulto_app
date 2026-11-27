import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, type CourierStats, type Order } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CourierStatsGrid, RecentOrders } from "@/pages/AccountPage";

type State =
  | { kind: "loading" }
  | { kind: "ok"; courier: CourierStats; recentOrders: Order[] }
  | { kind: "error" };

// /account — a courier's own account: their average customer rating and the
// same delivery stats admins see on the courier's account page.
export default function MyAccountPage() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });
  const isCourier = user?.role === "courier";

  useEffect(() => {
    if (!isCourier) return;
    api
      .myCourierAccount()
      .then((d) => setState({ kind: "ok", ...d }))
      .catch(() => setState({ kind: "error" }));
  }, [isCourier]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link to="/app">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{user?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </CardHeader>
      </Card>
      {!isCourier ? (
        <p className="text-sm text-muted-foreground">Account stats are available to couriers.</p>
      ) : state.kind === "loading" ? (
        <p className="py-12 text-center text-muted-foreground">Loading your account…</p>
      ) : state.kind === "error" ? (
        <p className="py-12 text-center text-muted-foreground">Could not load your account.</p>
      ) : (
        <>
          <CourierStatsGrid courier={state.courier} />
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentOrders orders={state.recentOrders} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
