import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type AddressSuggestion, type Order, type Quote, type RoutePreview } from "@/lib/api";
import { money, when } from "@/lib/format";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationMap } from "@/components/LocationMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Truck } from "lucide-react";

export default function CustomerDashboard() {
  const [categories, setCategories] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState("place");

  // order form state
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupPoint, setPickupPoint] = useState<AddressSuggestion | null>(null);
  const [dropoffPoint, setDropoffPoint] = useState<AddressSuggestion | null>(null);
  const [manualKm, setManualKm] = useState("");
  const [needsManual, setNeedsManual] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [route, setRoute] = useState<RoutePreview | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [placing, setPlacing] = useState(false);

  const loadOrders = async () => {
    try {
      const { orders } = await api.listOrders();
      setOrders(orders);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    api.categories().then((r) => setCategories(r.categories)).catch(() => {});
    loadOrders();
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, []);

  const resetQuote = () => {
    setQuote(null);
    setRoute(null);
  };

  const getQuote = async () => {
    if (!pickupPoint || !dropoffPoint) {
      toast.error("Select an address from the suggestions for both pickup and delivery.");
      return;
    }
    setQuoting(true);
    try {
      const km = manualKm ? Number(manualKm) : undefined;
      const [q, routeResult] = await Promise.all([
        api.quote(pickup, dropoff, needsManual ? km : undefined),
        api.routePreview(pickupPoint, dropoffPoint).catch(() => null),
      ]);
      if (q.needsManual) {
        setNeedsManual(true);
        setQuote(null);
        toast.message("Enter the distance manually", {
          description: "Automatic distance is unavailable for these addresses.",
        });
      } else {
        setQuote(q);
      }
      setRoute(routeResult);
      if (!routeResult) {
        toast.message("Route preview unavailable", {
          description: "The price above is still accurate — just couldn't draw the route line.",
        });
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not calculate price");
    } finally {
      setQuoting(false);
    }
  };

  const placeOrder = async () => {
    if (!category) return toast.error("Choose an item category");
    if (!quote) return toast.error("Calculate the price first");
    setPlacing(true);
    try {
      await api.createOrder({
        itemCategory: category,
        itemDescription: description || undefined,
        pickupAddress: pickup,
        dropoffAddress: dropoff,
        manualKm: needsManual && manualKm ? Number(manualKm) : undefined,
      });
      toast.success("Order placed!");
      // reset
      setCategory("");
      setDescription("");
      setPickup("");
      setDropoff("");
      setPickupPoint(null);
      setDropoffPoint(null);
      setManualKm("");
      setNeedsManual(false);
      setQuote(null);
      setRoute(null);
      setTab("orders");
      loadOrders();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  const verify = async (id: string) => {
    try {
      await api.verifyOrder(id);
      toast.success("Delivery verified. Thank you!");
      loadOrders();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not verify");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Your deliveries</h1>
      <p className="mb-6 text-muted-foreground">Place a new order or track existing ones.</p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="place">Place an order</TabsTrigger>
          <TabsTrigger value="orders">My orders ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="place">
          <Card>
            <CardHeader>
              <CardTitle>New delivery</CardTitle>
              <CardDescription>
                We calculate the price from the pickup-to-delivery distance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Item category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Item description (optional)</Label>
                <Textarea
                  id="desc"
                  placeholder="e.g. A4 envelope with contracts"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickup">Pickup address</Label>
                <AddressAutocomplete
                  id="pickup"
                  placeholder="123 King St W, Toronto, ON"
                  value={pickup}
                  onChange={(text) => {
                    setPickup(text);
                    setPickupPoint(null);
                    resetQuote();
                  }}
                  onSelect={(s) => {
                    setPickup(s.label);
                    setPickupPoint(s);
                    resetQuote();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dropoff">Delivery address</Label>
                <AddressAutocomplete
                  id="dropoff"
                  placeholder="456 Queen St E, Toronto, ON"
                  value={dropoff}
                  onChange={(text) => {
                    setDropoff(text);
                    setDropoffPoint(null);
                    resetQuote();
                  }}
                  onSelect={(s) => {
                    setDropoff(s.label);
                    setDropoffPoint(s);
                    resetQuote();
                  }}
                />
              </div>

              {(pickupPoint || dropoffPoint) && (
                <LocationMap
                  className="h-56 overflow-hidden rounded-md border"
                  pickup={pickupPoint ?? undefined}
                  dropoff={dropoffPoint ?? undefined}
                  route={route?.geometry}
                />
              )}

              {(!pickupPoint || !dropoffPoint) && (
                <p className="text-xs text-muted-foreground">
                  Select an address from the suggestions for both fields to calculate a price and route.
                </p>
              )}

              {needsManual && (
                <div className="space-y-2">
                  <Label htmlFor="km">Distance (km)</Label>
                  <Input
                    id="km"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 12.5"
                    value={manualKm}
                    onChange={(e) => {
                      setManualKm(e.target.value);
                      resetQuote();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatic distance lookup is unavailable — please enter the distance.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={getQuote}
                  disabled={quoting || !pickupPoint || !dropoffPoint}
                >
                  <MapPin className="h-4 w-4" />
                  {quoting ? "Calculating…" : "Calculate price"}
                </Button>
                {quote && (
                  <div className="text-sm">
                    <span className="font-medium">{quote.distanceKm} km</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-lg font-bold text-primary">
                      {money(quote.price, quote.currency)}
                    </span>
                    {route && (
                      <>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="text-muted-foreground">~{Math.round(route.durationMin)} min drive</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={placeOrder} disabled={!quote || placing}>
                <Truck className="h-4 w-4" />
                {placing ? "Placing…" : "Place order"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          {orders.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{o.itemCategory}</p>
                        <p className="text-sm text-muted-foreground">{when(o.createdAt)}</p>
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
                      <p>
                        <span className="text-muted-foreground">Distance / price:</span>{" "}
                        {o.distanceKm} km · {money(o.price, o.currency)}
                      </p>
                      {o.courierName && (
                        <p>
                          <span className="text-muted-foreground">Courier:</span> {o.courierName}
                        </p>
                      )}
                    </div>
                    {o.status === "completed" && (
                      <Button className="mt-4" size="sm" onClick={() => verify(o.id)}>
                        Verify delivery completed
                      </Button>
                    )}
                    {o.status === "verified" && (
                      <p className="mt-3 text-sm font-medium text-emerald-600">
                        ✓ Delivery confirmed complete.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
