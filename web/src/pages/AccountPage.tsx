import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api, ApiError, type AccountDetails, type CourierStats, type Order } from "@/lib/api";
import { money, orderNo, when } from "@/lib/format";
import { orderPath } from "@/components/OrderLink";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderAdminMenu } from "@/components/OrderAdminMenu";
import { Stars } from "@/components/StarRating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: AccountDetails }
  | { kind: "missing"; message: string };

// /admin/users/:id — one account's details for admins: who they are and,
// for customers and couriers, their order numbers. The API is admin-only.
export default function AccountPage() {
  const { id = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });

  // Initial load shows "Loading…"; a refresh after a cancel keeps the page.
  const load = useCallback(() => {
    api
      .getAccount(id)
      .then((data) => setState({ kind: "ok", data }))
      .catch((err) =>
        setState({
          kind: "missing",
          message:
            err instanceof ApiError && err.status === 403
              ? "Only admins can view account details."
              : err instanceof ApiError && err.status === 404
                ? "This account doesn't exist."
                : "Could not load this account.",
        }),
      );
  }, [id]);

  useEffect(() => {
    setState({ kind: "loading" });
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link to="/app">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>
      {state.kind === "loading" && (
        <p className="py-12 text-center text-muted-foreground">Loading account…</p>
      )}
      {state.kind === "missing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">Account unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          </CardContent>
        </Card>
      )}
      {state.kind === "ok" && <Account data={state.data} onChanged={load} />}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Account({ data, onChanged }: { data: AccountDetails; onChanged: () => void }) {
  const { user, customer, courier, recentOrders } = data;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-2xl">{user.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">
              {user.role}
            </Badge>
            {user.banned_at ? (
              <Badge variant="destructive">Banned</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Joined {when(user.created_at)}
          {user.banned_at && ` · Banned ${when(user.banned_at)}`}
        </CardContent>
      </Card>

      {customer && (
        <section
          aria-label="Customer activity"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Stat
            label="Orders placed"
            value={customer.orders}
            hint={customer.lastOrderAt ? `Last on ${when(customer.lastOrderAt)}` : undefined}
          />
          <Stat label="Delivered" value={customer.delivered} />
          <Stat label="In progress" value={customer.open} />
          <Stat label="Cancelled" value={customer.cancelled} />
          <Stat
            label="Total spent"
            value={money(customer.spent, customer.currency)}
            hint="Delivered orders"
          />
        </section>
      )}

      {courier && <CourierStatsGrid courier={courier} />}

      {(customer || courier) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent orders</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrders
              orders={recentOrders}
              menu={(o) => <OrderAdminMenu order={o} onChanged={onChanged} />}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// The courier's average rating, as a stat value.
export function RatingValue({ courier }: { courier: CourierStats }) {
  if (courier.averageRating === null) return <span className="text-muted-foreground">No ratings</span>;
  return (
    <span className="flex items-center gap-2">
      {courier.averageRating.toFixed(1)}
      <Stars value={courier.averageRating} size="lg" showValue={false} />
    </span>
  );
}

// Courier stats, shown to admins on the account page and to the courier on
// their own My account page.
export function CourierStatsGrid({ courier }: { courier: CourierStats }) {
  return (
        <section aria-label="Courier activity" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Average rating"
            value={<RatingValue courier={courier} />}
            hint={`From ${courier.ratedDeliveries} rated ${courier.ratedDeliveries === 1 ? "delivery" : "deliveries"}`}
          />
          <Stat
            label="Deliveries made"
            value={courier.delivered}
            hint={`${courier.deliveredThisMonth} this month`}
          />
          <Stat
            label="Earnings this month"
            value={money(courier.earningsThisMonth, courier.currency)}
          />
          <Stat
            label="Earnings all time"
            value={money(courier.earningsAllTime, courier.currency)}
            hint="Order value of deliveries made"
          />
          <Stat
            label="In progress"
            value={courier.inProgress}
            hint={`${courier.awaitingReply} awaiting accept/reject`}
          />
          <Stat label="Rejected" value={courier.rejected} hint="Orders this courier turned down" />
          <Stat
            label="Cancelled while assigned"
            value={courier.cancelledWhileAssigned}
            hint="Cancelled by an admin"
          />
        </section>
  );
}

// A list of order rows linking to each order; verified orders show their
// stars. `menu` adds a per-row action menu (admins).
export function RecentOrders({
  orders,
  menu,
}: {
  orders: Order[];
  menu?: (o: Order) => React.ReactNode;
}) {
  if (orders.length === 0) return <p className="text-sm text-muted-foreground">No orders yet.</p>;
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.id} className="-mx-2 flex items-center gap-2">
          <Link
            to={orderPath(o.id)}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-3 text-sm hover:bg-accent"
          >
            <span className="font-mono font-semibold text-primary">{orderNo(o.orderNumber)}</span>
            <span className="min-w-0 flex-1">
              {o.itemCategory}
              <span className="text-muted-foreground"> · {when(o.createdAt)}</span>
            </span>
            {o.rating && <Stars value={o.rating} showValue={false} />}
            <span>{money(o.price, o.currency)}</span>
            <OrderStatusBadge status={o.status} />
          </Link>
          {menu?.(o)}
        </li>
      ))}
    </ul>
  );
}
