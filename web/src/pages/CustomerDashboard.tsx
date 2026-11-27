import { useEffect, useState } from "react";
import { OrderTitleLink, useOpenOrderOnClick } from "@/components/OrderLink";
import { toast } from "sonner";
import { api, ApiError, type AddressSuggestion, type Order, type Quote } from "@/lib/api";
import { money, orderNo, when } from "@/lib/format";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationMap } from "@/components/LocationMap";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Truck } from "lucide-react";

// Shown as the grey placeholder in the delivery-notes field.
const NOTES_PLACEHOLDER =
  "Tell your courier exactly where to pick up and drop off: building name, unit, " +
  "entrance, buzzer code or a nearby landmark. If your address wasn't in the " +
  "suggestions, pick the closest one and describe the real location here.";

export default function CustomerDashboard() {
  const openOrder = useOpenOrderOnClick();
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
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
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
    api
      .categories()
      .then((r) => setCategories(r.categories))
      .catch(() => {});
    loadOrders();
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, []);

  const resetQuote = () => setQuote(null);

  const getQuote = async () => {
    if (!pickupPoint || !dropoffPoint) {
      toast.error("Select an address from the suggestions for both pickup and delivery.");
      return;
    }
    setQuoting(true);
    try {
      setQuote(await api.quote(pickupPoint, dropoffPoint));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not calculate price");
    } finally {
      setQuoting(false);
    }
  };

  const placeOrder = async () => {
    if (!category) return toast.error("Choose an item category");
    if (!quote || !pickupPoint || !dropoffPoint) return toast.error("Calculate the price first");
    setPlacing(true);
    try {
      await api.createOrder({
        itemCategory: category,
        itemDescription: description || undefined,
        notes: notes.trim() || undefined,
        pickupAddress: pickup,
        pickupLat: pickupPoint.lat,
        pickupLng: pickupPoint.lng,
        dropoffAddress: dropoff,
        dropoffLat: dropoffPoint.lat,
        dropoffLng: dropoffPoint.lng,
      });
      toast.success("Order placed!");
      // reset
      setCategory("");
      setDescription("");
      setPickup("");
      setDropoff("");
      setPickupPoint(null);
      setDropoffPoint(null);
      setNotes("");
      setQuote(null);
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

              {/* Addresses on the left, map on the right (stacked on phones).
                  The map is always shown: Ontario at first, then a pin per
                  chosen address, then the route once the price is calculated.
                  It stretches to the height of the two address fields. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-4">
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
                </div>
                <LocationMap
                  className="h-56 overflow-hidden rounded-md border sm:h-auto"
                  pickup={pickupPoint ?? undefined}
                  dropoff={dropoffPoint ?? undefined}
                  route={quote?.geometry}
                />
              </div>

              {(!pickupPoint || !dropoffPoint) && (
                <p className="text-xs text-muted-foreground">
                  Select an address from the suggestions for both fields to calculate a price and
                  route.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Delivery notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  // The hint wraps to ~7 lines on a phone but 3 on desktop.
                  className="min-h-[10rem] sm:min-h-0"
                  maxLength={2000}
                  placeholder={NOTES_PLACEHOLDER}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

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
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      ~{Math.round(quote.durationMin)} min drive
                    </span>
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
                <Card
                  key={o.id}
                  className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
                  onClick={openOrder(o.id)}
                >
                  <CardContent className="pt-6">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-semibold text-primary">
                          {orderNo(o.orderNumber)}
                        </p>
                        <OrderTitleLink id={o.id}>{o.itemCategory}</OrderTitleLink>
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
                      {o.notes && (
                        <p className="whitespace-pre-wrap">
                          <span className="text-muted-foreground">Notes:</span> {o.notes}
                        </p>
                      )}
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
