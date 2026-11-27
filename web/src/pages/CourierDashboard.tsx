import { useEffect, useState } from "react";
import { DirectionsButton } from "@/components/DirectionsButton";
import { OrderTitleLink, useOpenOrderOnClick } from "@/components/OrderLink";
import { toast } from "sonner";
import { api, ApiError, type Order } from "@/lib/api";
import { money, orderNo, when } from "@/lib/format";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Stars } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, PackageCheck } from "lucide-react";

export default function CourierDashboard() {
  const openOrder = useOpenOrderOnClick();
  const [orders, setOrders] = useState<Order[]>([]);

  const load = async () => {
    try {
      const { orders } = await api.listOrders();
      setOrders(orders);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  const recommended = orders.filter((o) => o.status === "recommended");
  const active = orders.filter((o) => o.status === "accepted");
  const done = orders.filter((o) => ["completed", "verified"].includes(o.status));

  const OrderCard = ({ o, children }: { o: Order; children?: React.ReactNode }) => (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
      onClick={openOrder(o.id)}
    >
      <CardContent className="pt-6">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{orderNo(o.orderNumber)}</p>
            <OrderTitleLink id={o.id}>{o.itemCategory}</OrderTitleLink>
            <p className="text-sm text-muted-foreground">
              For {o.customerName} · {when(o.createdAt)}
            </p>
          </div>
          <OrderStatusBadge status={o.status} />
        </div>
        <div className="grid gap-1 text-sm">
          <p>
            <span className="text-muted-foreground">From:</span> {o.pickupAddress}
          </p>
          <p>
            <span className="text-muted-foreground">To:</span> {o.dropoffAddress}
          </p>
          {o.itemDescription && (
            <p>
              <span className="text-muted-foreground">Item:</span> {o.itemDescription}
            </p>
          )}
          {o.notes && (
            <p className="whitespace-pre-wrap">
              <span className="text-muted-foreground">Customer notes:</span> {o.notes}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Distance / payout:</span> {o.distanceKm} km ·{" "}
            {money(o.price, o.currency)}
          </p>
        </div>
        {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
      </CardContent>
    </Card>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Courier dashboard</h1>

      <Section title={`Recommended to you (${recommended.length})`}>
        {recommended.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new recommendations.</p>
        ) : (
          <div className="space-y-3">
            {recommended.map((o) => (
              <OrderCard key={o.id} o={o}>
                <Button
                  size="sm"
                  onClick={() => act(() => api.acceptOrder(o.id), "Order accepted")}
                >
                  <Check className="h-4 w-4" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(() => api.rejectOrder(o.id), "Order rejected")}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </OrderCard>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Active deliveries (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active deliveries.</p>
        ) : (
          <div className="space-y-3">
            {active.map((o) => (
              <OrderCard key={o.id} o={o}>
                <DirectionsButton order={o} variant="default" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(() => api.completeOrder(o.id), "Marked as delivered")}
                >
                  <PackageCheck className="h-4 w-4" /> Report delivered
                </Button>
              </OrderCard>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Completed (${done.length})`}>
        {done.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing completed yet.</p>
        ) : (
          <div className="space-y-3">
            {done.map((o) => (
              <OrderCard key={o.id} o={o}>
                {o.status === "completed" && (
                  <p className="text-sm text-muted-foreground">
                    Waiting for customer verification…
                  </p>
                )}
                {o.status === "verified" && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    Customer rating:{" "}
                    {o.rating ? <Stars value={o.rating} /> : <span>not rated</span>}
                  </p>
                )}
              </OrderCard>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
