import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Ban, Check, PackageCheck, X } from "lucide-react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { api, ApiError, type Order } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, orderNo, when } from "@/lib/format";
import { CancelOrderDialog, canCancel } from "@/components/OrderAdminMenu";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { RecommendDialog, type Courier } from "@/components/RecommendDialog";
import { Stars } from "@/components/StarRating";
import { VerifyDeliveryDialog } from "@/components/VerifyDeliveryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; order: Order }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

// Detail view for a single order at /orders/:id. Notifications link here.
// Access is enforced by GET /api/orders/:id: admins see every order, couriers
// only orders assigned to them, customers only their own.
export default function OrderPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [couriers, setCouriers] = useState<Courier[]>([]);

  const load = useCallback(async () => {
    try {
      const { order } = await api.getOrder(id);
      setState({ kind: "ok", order });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ kind: "not_found" });
      else if (err instanceof ApiError && err.status === 403) setState({ kind: "forbidden" });
      // Malformed ids make Postgres reject the UUID; treat that as not found.
      else if (err instanceof ApiError && err.status === 500) setState({ kind: "not_found" });
      else
        setState({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Could not load this order.",
        });
    }
  }, [id]);

  useEffect(() => {
    setState({ kind: "loading" });
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    api
      .listCouriers()
      .then((r) => setCouriers(r.couriers))
      .catch(() => {});
  }, [user?.role]);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link to="/app">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>

      {state.kind === "loading" && (
        <p className="py-12 text-center text-muted-foreground">Loading order…</p>
      )}
      {state.kind === "not_found" && (
        <Message title="Order not found" body="This order doesn't exist or has been removed." />
      )}
      {state.kind === "forbidden" && (
        <Message
          title="You don't have access to this order"
          body={
            user?.role === "courier"
              ? "It may have been reassigned to another courier, or you rejected it."
              : "This order belongs to another account."
          }
        />
      )}
      {state.kind === "error" && <Message title="Something went wrong" body={state.message} />}
      {state.kind === "ok" && (
        <OrderDetails
          order={state.order}
          directions={
            user?.role === "courier" &&
            state.order.courierId === user.id &&
            (state.order.status === "recommended" || state.order.status === "accepted") ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Ready to go? Get directions from where you are to the pickup, then to the
                  drop-off.
                </p>
                <DirectionsButton order={state.order} size="default" variant="default" />
              </div>
            ) : undefined
          }
          actions={
            <OrderActions
              order={state.order}
              role={user?.role}
              userId={user?.id}
              couriers={couriers}
              act={act}
              reload={load}
            />
          }
        />
      )}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function OrderDetails({
  order: o,
  actions,
  directions,
}: {
  order: Order;
  actions: React.ReactNode;
  directions?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <p className="font-mono text-sm font-semibold text-primary">
            Order {orderNo(o.orderNumber)}
          </p>
          <CardTitle className="text-2xl">{o.itemCategory}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Placed {when(o.createdAt)}</p>
        </div>
        <OrderStatusBadge status={o.status} />
      </CardHeader>
      <CardContent>
        {directions && <div className="mb-4 rounded-lg border bg-muted/40 p-4">{directions}</div>}
        <dl className="divide-y">
          {o.itemDescription && <Row label="Item description">{o.itemDescription}</Row>}
          <Row label="Pickup address">{o.pickupAddress}</Row>
          <Row label="Delivery address">{o.dropoffAddress}</Row>
          {o.notes && (
            <Row label="Delivery notes">
              <span className="whitespace-pre-wrap">{o.notes}</span>
            </Row>
          )}
          <Row label="Distance">{o.distanceKm} km</Row>
          <Row label="Price">
            <span className="font-semibold">{money(o.price, o.currency)}</span>
          </Row>
          <Row label="Customer">{o.customerName}</Row>
          <Row label="Courier">{o.courierName ?? "Not assigned yet"}</Row>
          <Row label="Verification">
            Courier {o.courierVerifiedAt ? `✓ ${when(o.courierVerifiedAt)}` : "—"} · Customer{" "}
            {o.customerVerifiedAt ? `✓ ${when(o.customerVerifiedAt)}` : "—"}
          </Row>
          {o.status === "verified" && (
            <Row label="Customer rating">
              {o.rating ? <Stars value={o.rating} size="lg" /> : <span className="text-muted-foreground">Not rated</span>}
              {o.ratingComment && (
                <span className="mt-1 block whitespace-pre-wrap text-muted-foreground">
                  “{o.ratingComment}”
                </span>
              )}
            </Row>
          )}
          {o.status === "cancelled" && (
            <Row label="Cancelled">
              {o.cancelledAt ? when(o.cancelledAt) : "—"}
              {o.cancelledByName ? ` by ${o.cancelledByName}` : ""}
              {o.cancelReason && (
                <span className="mt-1 block text-muted-foreground">Reason: {o.cancelReason}</span>
              )}
            </Row>
          )}
          {o.refundStatus && (
            <Row label="Refund">
              {o.refundStatus === "pending" ? (
                <span className="text-amber-600">Pending — will be processed by CarefulTO</span>
              ) : (
                "Refunded"
              )}
            </Row>
          )}
          <Row label="Last updated">{when(o.updatedAt)}</Row>
        </dl>
        {actions}
      </CardContent>
    </Card>
  );
}

// The same actions each role already has on its dashboard, for this order.
function OrderActions({
  order: o,
  role,
  userId,
  couriers,
  act,
  reload,
}: {
  order: Order;
  role: string | undefined;
  userId: string | undefined;
  couriers: Courier[];
  act: (fn: () => Promise<unknown>, success: string) => void;
  reload: () => void;
}) {
  let content: React.ReactNode = null;

  if (role === "admin" && canCancel(o)) {
    content = (
      <>
        {(o.status === "placed" || o.status === "rejected") && (
          <RecommendDialog order={o} couriers={couriers} onDone={reload} />
        )}
        <AdminCancelButton order={o} onDone={reload} />
        {couriers.length === 0 && (o.status === "placed" || o.status === "rejected") && (
          <p className="text-sm text-amber-600">No couriers exist yet — create one first.</p>
        )}
      </>
    );
  } else if (role === "courier" && o.courierId === userId) {
    if (o.status === "recommended") {
      content = (
        <>
          <Button size="sm" onClick={() => act(() => api.acceptOrder(o.id), "Order accepted")}>
            <Check className="h-4 w-4" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => act(() => api.rejectOrder(o.id), "Order rejected")}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </>
      );
    } else if (o.status === "accepted") {
      content = (
        <>
          <Button
            size="sm"
            onClick={() => act(() => api.completeOrder(o.id), "Marked as delivered")}
          >
            <PackageCheck className="h-4 w-4" /> Report delivered
          </Button>
        </>
      );
    } else if (o.status === "completed") {
      content = <p className="text-sm text-muted-foreground">Waiting for customer verification…</p>;
    }
  } else if (role === "customer" && o.status === "completed") {
    content = <VerifyDeliveryDialog order={o} onDone={reload} />;
  }

  if (o.status === "verified") {
    content = (
      <p className="text-sm font-medium text-emerald-600">✓ Delivery confirmed complete.</p>
    );
  }

  if (!content) return null;
  return <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">{content}</div>;
}

function AdminCancelButton({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-4 w-4" /> Cancel order
      </Button>
      <CancelOrderDialog order={order} open={open} onOpenChange={setOpen} onDone={onDone} />
    </>
  );
}
