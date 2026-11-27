// Google Maps "Maps URLs" (https://developers.google.com/maps/documentation/urls):
// a plain link that opens the Google Maps app on Android/iOS and
// maps.google.com on desktop, with driving directions already filled in.

export interface LatLng {
  lat: number;
  lng: number;
}

interface Stop {
  address: string;
  lat: number | null;
  lng: number | null;
}

// Prefer the exact pin the customer picked: Google re-geocoding our address
// text could land somewhere else (OSM postal codes aren't always right).
// Old orders without pins fall back to the address text.
function place(s: Stop): string {
  if (s.lat !== null && s.lng !== null) return `${s.lat},${s.lng}`;
  return s.address;
}

// Directions for a delivery job:
//   with the courier's location: here → pickup (stop) → drop-off
//   without it:                  pickup → drop-off
export function deliveryDirectionsUrl(
  pickup: Stop,
  dropoff: Stop,
  courier?: LatLng | null,
): string {
  const params = new URLSearchParams({ api: "1", travelmode: "driving" });
  if (courier) {
    params.set("origin", `${courier.lat},${courier.lng}`);
    params.set("waypoints", place(pickup));
  } else {
    params.set("origin", place(pickup));
  }
  params.set("destination", place(dropoff));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// The courier's current position, or null if the browser can't or won't
// share it (no permission, no GPS fix, insecure page, too slow).
export function currentPosition(timeoutMs = 8000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
