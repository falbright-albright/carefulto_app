import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { api, ApiError, type Order, type OrderPage } from "@/lib/api";
import { money, orderNo, when } from "@/lib/format";
import { OrderTitleLink, orderPath, useOpenOrderOnClick } from "@/components/OrderLink";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { OrderAdminMenu } from "@/components/OrderAdminMenu";
import { RecommendDialog, type Courier } from "@/components/RecommendDialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SEARCH_DEBOUNCE_MS = 300;

function verificationCell(o: Order) {
  if (o.status === "verified") return <span className="text-emerald-600">Both ✓</span>;
  if (o.status === "completed") {
    return (
      <span className="text-xs text-muted-foreground">
        Courier ✓ · Customer {o.customerVerifiedAt ? "✓" : "…"}
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

// The admin Orders tab: search box + month filter above a paginated table
// (50 per page, newest first). Searching hits the server, so it covers every
// order in the database, not just the ones on screen.
export default function AdminOrders({ couriers }: { couriers: Courier[] }) {
  const openOrder = useOpenOrderOnClick();
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Only the newest request may update the table (typing fires several).
  const requestId = useRef(0);

  const load = useCallback(async (params: { q: string; month: string; page: number }) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await api.searchOrders(params);
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
      // A cancel or filter change can leave us past the last page.
      if (params.page > result.pageCount) setPage(result.pageCount);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : "Could not load orders");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Typing waits for a short pause; month and page changes load at once.
  const typed = useRef(false);
  useEffect(() => {
    const delay = typed.current ? SEARCH_DEBOUNCE_MS : 0;
    typed.current = false;
    const t = setTimeout(() => load({ q, month, page }), delay);
    return () => clearTimeout(t);
  }, [q, month, page, load]);

  // Keep the current view fresh, like the rest of the dashboard.
  useEffect(() => {
    const t = setInterval(() => load({ q, month, page }), 15000);
    return () => clearInterval(t);
  }, [q, month, page, load]);

  const reload = () => load({ q, month, page });
  const filtered = q.trim() !== "" || month !== "";
  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="order-search">Search orders</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="order-search"
              type="search"
              className="pl-9"
              placeholder="Order no., customer, address, courier, price, item or date"
              value={q}
              onChange={(e) => {
                typed.current = true;
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="order-month">Month placed</Label>
          <Input
            id="order-month"
            type="month"
            className="sm:w-44"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              setMonth("");
              setPage(1);
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {error
          ? error
          : !data
            ? "Loading orders…"
            : data.total === 0
              ? filtered
                ? "No orders match this search."
                : "No orders yet."
              : `Showing ${first}–${last} of ${data.total} ${data.total === 1 ? "order" : "orders"}${loading ? " · updating…" : ""}`}
      </p>

      {data && data.orders.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Placed</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orders.map((o) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={openOrder(o.id)}>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      to={orderPath(o.id)}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {orderNo(o.orderNumber)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {when(o.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/users/${o.customerId}`}
                      className="text-primary hover:underline"
                      title={`View ${o.customerName}'s account`}
                    >
                      {o.customerName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <OrderTitleLink id={o.id}>{o.itemCategory}</OrderTitleLink>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-xs">
                    <div className="truncate">{o.pickupAddress}</div>
                    <div className="truncate text-muted-foreground">→ {o.dropoffAddress}</div>
                    <div className="text-muted-foreground">{o.distanceKm} km</div>
                    {o.notes && (
                      <div className="mt-1 line-clamp-2 text-foreground" title={o.notes}>
                        <span className="text-muted-foreground">Notes:</span> {o.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{money(o.price, o.currency)}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                    {o.refundStatus === "pending" && (
                      <div className="mt-1 text-xs text-amber-600">Refund pending</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{o.courierName ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{verificationCell(o)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(o.status === "placed" || o.status === "rejected") && (
                        <RecommendDialog order={o} couriers={couriers} onDone={reload} />
                      )}
                      <OrderAdminMenu order={o} onChanged={reload} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.pageCount > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Orders pages">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
