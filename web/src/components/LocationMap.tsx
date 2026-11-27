import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

// Ontario bounding box (matches ONTARIO_VIEWBOX on the server): the business
// operates in Ontario only, so the map never pans or zooms out past it.
const ONTARIO_BOUNDS: LatLngBoundsExpression = [
  [41.6, -95.2],
  [56.9, -74.3],
];
// Where the map starts (and returns when both addresses are cleared): the
// service area — Toronto and the GTA down to St. Catharines and Niagara
// Falls across the lake. Customers can still zoom out to all of Ontario.
const SERVICE_AREA: LatLngBoundsExpression = [
  [43.05, -79.7], // south-west: Niagara Falls / St. Catharines, Mississauga
  [43.86, -79.1], // north-east: north Toronto / Markham, Pickering
];

function pin(color: string) {
  return L.divIcon({
    className: "",
    html: `<svg width="24" height="32" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 10.5 18.6 11 19.1.3.3.7.3 1 0 .5-.5 11-10.6 11-19.1C23 5.4 17.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1"/>
      <circle cx="12" cy="12" r="4.5" fill="white"/>
    </svg>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -28],
  });
}

const pickupIcon = pin("#2563eb"); // blue
const dropoffIcon = pin("#dc2626"); // red

interface Point {
  lat: number;
  lng: number;
  label?: string;
}

interface LocationMapProps {
  pickup?: Point;
  dropoff?: Point;
  route?: [number, number][];
  className?: string;
}

function FitToView({
  pickup,
  dropoff,
  route,
}: {
  pickup?: Point;
  dropoff?: Point;
  route?: [number, number][];
}) {
  const map = useMap();
  useEffect(() => {
    // No animation here: Leaflet drops a new zoom request while a zoom
    // animation is still running, so quick changes (e.g. clearing both
    // addresses) could leave the map on a stale view.
    // A real driving route can bow out well beyond the straight line between
    // the two pins (detours, one-ways, etc.) — frame the whole path when we
    // have one instead of just the two points.
    if (route && route.length > 0) {
      map.fitBounds(route, { padding: [32, 32], maxZoom: 14, animate: false });
    } else if (pickup && dropoff) {
      map.fitBounds(
        [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ],
        { padding: [32, 32], maxZoom: 14, animate: false },
      );
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 13, { animate: false });
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 13, { animate: false });
    } else {
      // Both addresses cleared: back to the service-area view.
      map.fitBounds(SERVICE_AREA, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, route]);
  return null;
}

// Leaflet measures its box once; when the box later changes size (layout
// settling, window resize, phone/desktop switch) tell it to re-measure, or
// it leaves grey, unloaded areas.
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Small read-only map preview, bounded to Ontario, showing the selected
// pickup/dropoff pins and, once calculated, a driving route line between
// them. Uses public OSM raster tiles (no API key).
export function LocationMap({ pickup, dropoff, route, className }: LocationMapProps) {
  return (
    // `isolate` gives the map its own stacking context. Leaflet's panes and
    // controls use z-index 400–1000, which would otherwise paint over
    // anything positioned near the map — notably the address-autocomplete
    // dropdown directly above it, hiding the suggestions.
    <div className={`isolate ${className ?? ""}`}>
      <MapContainer
        bounds={SERVICE_AREA}
        // Quarter-step zoom so the short map box fits the service area
        // snugly instead of rounding out a whole level.
        zoomSnap={0.25}
        minZoom={5}
        maxBounds={ONTARIO_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {route && route.length > 0 && (
          <Polyline positions={route} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.8 }} />
        )}
        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>Pickup{pickup.label ? `: ${pickup.label}` : ""}</Popup>
          </Marker>
        )}
        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>Drop-off{dropoff.label ? `: ${dropoff.label}` : ""}</Popup>
          </Marker>
        )}
        <FitToView pickup={pickup} dropoff={dropoff} route={route} />
        <KeepSized />
      </MapContainer>
    </div>
  );
}
