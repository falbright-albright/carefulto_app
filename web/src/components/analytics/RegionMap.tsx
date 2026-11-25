import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RegionStat } from "@/lib/api";

const FILLS = ["#eef1f5", "#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];

// Quantile class breaks over the non-zero counts (up to 5 classes), so one
// dominant region (Toronto) doesn't wash every other region out to the
// lightest step. Returns ascending upper bounds.
export function classBreaks(values: number[]): number[] {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length === 0) return [];
  const k = Math.min(5, nz.length);
  const out: number[] = [];
  for (let i = 1; i <= k; i++) {
    const b = nz[Math.min(nz.length - 1, Math.ceil((i / k) * nz.length) - 1)]!;
    if (out[out.length - 1] !== b) out.push(b);
  }
  return out;
}

export function classOf(v: number, breaks: number[]): number {
  if (v <= 0) return 0;
  const i = breaks.findIndex((b) => v <= b);
  // Spread the classes we have over the 5 shades, darkest = highest.
  const idx = i === -1 ? breaks.length - 1 : i;
  return breaks.length === 1 ? 5 : 1 + Math.round((idx / (breaks.length - 1)) * 4);
}

// Area-weighted centroid of the largest outer ring — where a region's count
// is printed. Good enough for municipal outlines, which are close to convex.
export function centroid(g: GeoJSON.Geometry): [number, number] | null {
  const rings =
    g.type === "Polygon"
      ? [g.coordinates[0]]
      : g.type === "MultiPolygon"
        ? g.coordinates.map((p) => p[0])
        : [];
  let best: { a: number; x: number; y: number } | null = null;
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i] as [number, number];
      const [x1, y1] = ring[i + 1] as [number, number];
      const f = x0 * y1 - x1 * y0;
      a += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    if (a === 0) continue;
    const c = { a: Math.abs(a / 2), x: cx / (3 * a), y: cy / (3 * a) };
    if (!best || c.a > best.a) best = c;
  }
  return best ? [best.y, best.x] : null;
}

function FitRegions({ regions }: { regions: RegionStat[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    // Frame the GTA + Hamilton core; outlying regions stay reachable by panning
    // or by picking them from the list.
    const core = regions.some((r) => r.baseline) ? regions.filter((r) => r.baseline) : regions;
    const layers = core
      .filter((r) => r.geojson)
      .map((r) => L.geoJSON(r.geojson as GeoJSON.Geometry));
    if (layers.length === 0) return;
    const bounds = L.featureGroup(layers).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [8, 8] });
      fitted.current = true;
    }
  }, [map, regions]);
  return null;
}

function FocusRegion({ region }: { region: RegionStat | null }) {
  const map = useMap();
  useEffect(() => {
    if (!region?.geojson) return;
    const b = L.geoJSON(region.geojson as GeoJSON.Geometry).getBounds();
    if (b.isValid()) map.flyToBounds(b, { padding: [40, 40], maxZoom: 11, duration: 0.6 });
  }, [map, region]);
  return null;
}

export function RegionMap({
  regions,
  breaks,
  selectedId,
  hoverId,
  onSelect,
  onHover,
}: {
  regions: RegionStat[];
  breaks: number[];
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const withShape = useMemo(() => regions.filter((r) => r.geojson), [regions]);
  const selected = regions.find((r) => r.id === selectedId) ?? null;
  // Rebuild layers when the data changes (month switch) so styles + labels update.
  const dataKey = useMemo(() => regions.map((r) => `${r.id}:${r.pickups}`).join("|"), [regions]);

  return (
    <MapContainer
      center={[43.75, -79.5]}
      zoom={9}
      minZoom={6}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "var(--a-paper)" }}
    >
      <TileLayer
        className="a-basemap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {withShape.map((r) => {
        const cls = classOf(r.pickups, breaks);
        const active = r.id === selectedId || r.id === hoverId;
        return (
          <GeoJSON
            key={`${r.id}-${dataKey}-${active}`}
            data={r.geojson as GeoJSON.Geometry}
            style={{
              fillColor: FILLS[cls],
              fillOpacity: cls === 0 ? 0.55 : 0.82,
              color: active ? "#14213d" : "#ffffff",
              weight: active ? 2.5 : 1.25,
            }}
            eventHandlers={{
              add: (e) => {
                const layer = e.target as L.GeoJSON;
                layer.bindTooltip(
                  `<strong>${r.name}</strong>${r.county ? `<br><span style="color:#7c8696">${r.county}</span>` : ""}<br>${r.pickups} pickup ${r.pickups === 1 ? "request" : "requests"}<br><span style="color:#7c8696">${r.delivered} delivered</span>`,
                  { sticky: true, className: "a-region-hover", direction: "top", offset: [0, -8] },
                );
                if (active) layer.bringToFront();
              },
              click: () => onSelect(r.id === selectedId ? null : r.id),
              mouseover: () => onHover(r.id),
              mouseout: () => onHover(null),
            }}
          />
        );
      })}
      {/* Counts printed on the map itself, on every region with pickups. */}
      {withShape
        .filter((r) => r.pickups > 0)
        .map((r) => {
          const c = centroid(r.geojson as GeoJSON.Geometry);
          return c ? (
            <Marker
              key={`label-${r.id}-${r.pickups}`}
              position={c}
              interactive={false}
              keyboard={false}
              icon={L.divIcon({
                className: "a-region-count",
                html: String(r.pickups),
                iconSize: [40, 16],
              })}
            />
          ) : null;
        })}
      <FitRegions regions={withShape} />
      <FocusRegion region={selected} />
    </MapContainer>
  );
}

export function RegionLegend({ breaks }: { breaks: number[] }) {
  if (breaks.length === 0) return null;
  const items: { fill: string; label: string }[] = [{ fill: FILLS[0]!, label: "0" }];
  breaks.forEach((b, i) => {
    const lo = i === 0 ? 1 : breaks[i - 1]! + 1;
    items.push({
      fill: FILLS[classOf(b, breaks)]!,
      label: lo >= b ? String(b) : `${lo}–${b}`,
    });
  });
  return (
    <ul
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--a-ink-2)]"
      aria-label="Map shading"
    >
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-4 rounded-[3px] border border-[var(--a-hair)]"
            style={{ background: it.fill }}
          />
          <span className="a-tabular">{it.label}</span>
        </li>
      ))}
      <li className="text-[var(--a-muted)]">pickup requests</li>
    </ul>
  );
}
