import { useState } from "react";
import { toast } from "sonner";
import { Navigation } from "lucide-react";
import type { Order } from "@/lib/api";
import { currentPosition, deliveryDirectionsUrl } from "@/lib/googleMaps";
import { Button, type ButtonProps } from "@/components/ui/button";

// Courier: open the whole job in Google Maps — from where they are now (if
// the browser shares it) to the pickup, then on to the drop-off. Used at the
// top of the order page and on the courier dashboard's active orders.
export function DirectionsButton({
  order: o,
  size = "sm",
  variant = "outline",
}: {
  order: Order;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // Open the tab now, inside the click: browsers block pop-ups opened
    // later, and asking for the location takes a moment.
    const tab = window.open("", "_blank");
    if (tab) tab.document.title = "Opening Google Maps…";
    setBusy(true);
    const here = await currentPosition();
    setBusy(false);
    const url = deliveryDirectionsUrl(
      { address: o.pickupAddress, lat: o.pickupLat, lng: o.pickupLng },
      { address: o.dropoffAddress, lat: o.dropoffLat, lng: o.dropoffLng },
      here,
    );
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.href = url; // pop-ups blocked: go in this tab instead
    }
    toast.message(
      here
        ? "Directions opened: your location → pickup → drop-off"
        : "Your location isn't available, so directions start at the pickup",
    );
  };

  return (
    <Button size={size} variant={variant} onClick={open} disabled={busy}>
      <Navigation className="h-4 w-4" />
      {busy ? "Getting your location…" : "Directions in Google Maps"}
    </Button>
  );
}
