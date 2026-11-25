import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError, type AnalyticsOverview, type RegionAnalytics } from "@/lib/api";
import { compact, minutes, money, monthLabel, monthRange, pctChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { KpiBox, type KpiDelta } from "@/components/analytics/KpiBox";
import { DailyDeliveriesChart, Sparkline } from "@/components/analytics/DailyDeliveriesChart";
import { CategoryBars, CategoryHeatGrid } from "@/components/analytics/CategoryCharts";
import { classBreaks, RegionLegend, RegionMap } from "@/components/analytics/RegionMap";

type Scope = "month" | "all";

// Today's date (YYYY-MM-DD) in the business time zone.
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <fieldset className="inline-flex rounded-lg bg-[var(--a-paper)] p-0.5 text-[13px]">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--a-data)]",
            value === o.value
              ? "bg-[var(--a-surface)] text-[var(--a-ink)] shadow-[0_1px_2px_rgba(20,33,61,0.12)]"
              : "text-[var(--a-ink-2)] hover:text-[var(--a-ink)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--a-hair)] bg-[var(--a-surface)] p-5",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
          {description && (
            <p className="mt-1 text-[13px] leading-snug text-[var(--a-ink-2)]">{description}</p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

// Metrics worth adding next. "ready" ones can be computed from data the
// platform already stores; the rest need something new to be collected.
const NEXT_METRICS: { name: string; why: string; needs: string | null }[] = [
  {
    name: "Customer retention by sign-up month",
    why: "Share of each month's new customers who order again within 30 days. The clearest early signal of whether growth is sticking.",
    needs: null,
  },
  {
    name: "Busiest hours of the week",
    why: "A weekday-by-hour grid of requests, to plan courier shifts around real demand.",
    needs: null,
  },
  {
    name: "Pickup to drop-off flows",
    why: "Which region pairs carry the most deliveries (e.g. Vaughan to Toronto), to spot routes worth pricing or staffing differently.",
    needs: null,
  },
  {
    name: "Time from delivery to customer sign-off",
    why: "How long customers take to verify a delivery. Long waits hide disputes and slow down courier pay.",
    needs: null,
  },
  {
    name: "On-time delivery rate",
    why: "Deliveries completed inside the window the customer was promised. The metric customers care about most.",
    needs: "A promised pickup/delivery window on each order.",
  },
  {
    name: "Margin per delivery",
    why: "Price minus courier payout, per delivery and per km, so growth isn't bought at a loss.",
    needs: "Courier payout amounts.",
  },
  {
    name: "Courier utilisation",
    why: "Deliveries per courier-hour online, to tell whether you need more couriers or better dispatch.",
    needs: "Courier online/offline status (part of the planned live-location work).",
  },
  {
    name: "Cancellation rate and reasons",
    why: "How many requests are abandoned and why: price, wait time or availability.",
    needs: "A cancel action for customers and admins (the status already exists).",
  },
];

export default function AnalyticsPanel() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [regions, setRegions] = useState<RegionAnalytics | null>(null);
  const [regionScope, setRegionScope] = useState<Scope>("month");
  const [categoryScope, setCategoryScope] = useState<Scope>("month");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .analytics(month ?? undefined)
      .then((d) => {
        if (!live) return;
        setData(d);
        setErr(null);
        if (month === null) setMonth(d.month);
      })
      .catch((e) => live && setErr(e instanceof ApiError ? e.message : "Could not load analytics"));
    return () => {
      live = false;
    };
  }, [month]);

  const regionKey = regionScope === "all" ? "all" : month;
  useEffect(() => {
    if (!regionKey) return;
    let live = true;
    setRegions(null);
    api
      .regionAnalytics(regionKey)
      .then((r) => live && setRegions(r))
      .catch(() => live && setRegions({ month: regionKey, unassigned: 0, regions: [] }));
    return () => {
      live = false;
    };
  }, [regionKey]);

  const months = useMemo(
    () => (data ? monthRange(data.firstMonth, data.currentMonth) : []),
    [data],
  );
  const breaks = useMemo(
    () => classBreaks(regions?.regions.map((r) => r.pickups) ?? []),
    [regions],
  );

  if (err && !data) {
    return <p className="py-12 text-center text-muted-foreground">{err}</p>;
  }
  if (!data || !month) {
    return <p className="py-12 text-center text-muted-foreground">Loading analytics…</p>;
  }

  const { current: cur, previous: prev, totals } = data;
  const monthName = monthLabel(data.month);
  const prevName = monthLabel(months[months.indexOf(data.month) + 1] ?? shiftLabel(data.month));
  const vs = data.previousIsPartial
    ? `vs same days of ${prevName.split(" ")[0]}`
    : `vs ${prevName.split(" ")[0]}`;
  const d = (c: number | null, p: number | null, upIsGood = true): KpiDelta => ({
    change: pctChange(c, p),
    upIsGood,
    vs,
  });
  const today = todayIn(data.timeZone);
  const isCurrent = data.month === data.currentMonth;
  const idx = months.indexOf(data.month);
  const realDays = data.daily.filter((x) => x.date <= today);
  const acceptance = cur.offers > 0 ? cur.offersAccepted / cur.offers : null;
  const prevAcceptance = prev.offers > 0 ? prev.offersAccepted / prev.offers : null;
  const repeat = cur.requestingCustomers > 0 ? cur.repeatCustomers / cur.requestingCustomers : null;
  const prevRepeat =
    prev.requestingCustomers > 0 ? prev.repeatCustomers / prev.requestingCustomers : null;
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const regionTotal = regions?.regions.reduce((s, r) => s + r.pickups, 0) ?? 0;
  const ranked = regions?.regions.filter((r) => r.pickups > 0) ?? [];
  const quiet = regions?.regions.filter((r) => r.pickups === 0) ?? [];
  const scopeName = (s: Scope) => (s === "all" ? "all time" : monthName);

  return (
    <div className="analytics -mx-1 space-y-5 rounded-3xl bg-[var(--a-paper)] p-3 sm:p-5">
      {/* Month picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--a-ink-2)]">
          {isCurrent ? "Month to date, " : ""}times in Eastern time ({data.timeZone})
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--a-ink-2)] hover:bg-[var(--a-surface)] disabled:opacity-30"
            onClick={() => setMonth(months[idx + 1]!)}
            disabled={idx >= months.length - 1}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={data.month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
            className="rounded-lg border border-[var(--a-hair)] bg-[var(--a-surface)] px-3 py-1.5 text-[14px] font-semibold"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--a-ink-2)] hover:bg-[var(--a-surface)] disabled:opacity-30"
            onClick={() => setMonth(months[idx - 1]!)}
            disabled={idx <= 0}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hero: the month's deliveries */}
      <section className="grid gap-6 rounded-2xl bg-[var(--a-ink)] p-6 text-white sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <h2 className="text-[15px] font-medium text-white/70">
            Deliveries completed in {monthName}
          </h2>
          <p className="a-figure mt-3 text-[64px] sm:text-[80px]">{compact(cur.deliveries)}</p>
          <p className="mt-3 text-[14px] text-white/75">
            {(() => {
              const c = pctChange(cur.deliveries, prev.deliveries);
              if (c === null)
                return `First month with deliveries. ${cur.requests} requests placed.`;
              return `${c >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(c * 100))}% ${vs}. ${cur.requests} requests placed.`;
            })()}
          </p>
          <p className="mt-4 text-[13px] text-white/55">
            {compact(totals.deliveriesAllTime)} deliveries and{" "}
            {money(totals.revenueAllTime, data.currency)} recorded since launch
          </p>
        </div>
        <div className="text-[#86b6ef]">
          <Sparkline values={realDays.map((x) => x.deliveries)} />
          <p className="mt-1 text-right text-[12px] text-white/55">Daily deliveries this month</p>
        </div>
      </section>

      {/* KPI boxes */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox
          label="Registered customers"
          value={compact(totals.customers)}
          sub={`+${cur.newCustomers} in ${monthName.split(" ")[0]}`}
          definition="Every customer account on the platform, banned included."
        />
        <KpiBox
          label="Couriers"
          value={compact(totals.couriersActive)}
          sub={totals.couriers > totals.couriersActive ? `active of ${totals.couriers}` : "active"}
          definition={`${cur.activeCouriers} completed at least one delivery in ${monthName.split(" ")[0]}.`}
        />
        <KpiBox
          label="New customers"
          value={compact(cur.newCustomers)}
          delta={d(cur.newCustomers, prev.newCustomers)}
          definition="Customer accounts created this month."
        />
        <KpiBox
          label="Delivery requests"
          value={compact(cur.requests)}
          delta={d(cur.requests, prev.requests)}
          definition="Orders placed this month, in any status."
        />
        <KpiBox
          label="Average delivery price"
          value={cur.avgPrice === null ? "—" : money(cur.avgPrice, data.currency)}
          delta={d(cur.avgPrice, prev.avgPrice)}
          definition="Mean price of deliveries completed this month."
        />
        <KpiBox
          label="Deliveries per courier"
          value={
            cur.deliveriesPerActiveCourier === null
              ? "—"
              : cur.deliveriesPerActiveCourier.toFixed(1)
          }
          delta={d(cur.deliveriesPerActiveCourier, prev.deliveriesPerActiveCourier)}
          definition="Deliveries divided by couriers who delivered this month."
        />
        <KpiBox
          label="Revenue recorded"
          value={money(cur.revenue, data.currency)}
          delta={d(cur.revenue, prev.revenue)}
          definition="Sum of prices of completed deliveries. Not yet charged."
        />
        <KpiBox
          label="Average distance"
          value={cur.avgDistanceKm === null ? "—" : cur.avgDistanceKm.toFixed(1)}
          sub="km"
          definition="Mean driving distance (from OSRM) of completed deliveries."
        />
        <KpiBox
          label="Courier acceptance rate"
          value={pct(acceptance)}
          delta={d(acceptance, prevAcceptance)}
          definition="Share of courier offers accepted rather than rejected."
        />
        <KpiBox
          label="Time to courier acceptance"
          value={cur.avgMinutesToAccept === null ? "—" : minutes(cur.avgMinutesToAccept)}
          delta={d(cur.avgMinutesToAccept, prev.avgMinutesToAccept, false)}
          definition="Average wait from order placed to a courier accepting it."
        />
        <KpiBox
          label="Repeat customers"
          value={pct(repeat)}
          delta={d(repeat, prevRepeat)}
          definition="Customers who placed two or more requests this month."
        />
        <KpiBox
          label="Waiting for a courier"
          value={compact(totals.awaitingCourier)}
          sub={`${totals.inProgress} in progress`}
          definition="Orders right now that still need a courier assigned."
        />
      </div>

      <Panel
        title={`Deliveries per day, ${monthName}`}
        description="Deliveries are counted on the day the courier reported them delivered. Hover a day for its count and new requests."
      >
        <DailyDeliveriesChart days={data.daily} today={today} />
      </Panel>

      <Panel
        title="Pickup requests by region"
        description="Each request is placed in the municipality its pickup address falls in. Click a region on the map or in the list to zoom to it."
        actions={
          <Segmented
            label="Region time range"
            value={regionScope}
            onChange={setRegionScope}
            options={[
              { value: "month", label: monthName },
              { value: "all", label: "All time" },
            ]}
          />
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="relative h-[420px] overflow-hidden rounded-xl border border-[var(--a-hair)] sm:h-[520px]">
              {regions ? (
                <RegionMap
                  regions={regions.regions}
                  breaks={breaks}
                  selectedId={selectedRegion}
                  hoverId={hoverRegion}
                  onSelect={setSelectedRegion}
                  onHover={setHoverRegion}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[13px] text-[var(--a-muted)]">
                  Loading regions…
                </div>
              )}
            </div>
            <div className="mt-3">
              <RegionLegend breaks={breaks} />
            </div>
          </div>
          <div>
            <p className="text-[13px] text-[var(--a-ink-2)]">
              <span className="a-figure text-[22px] text-[var(--a-ink)]">
                {compact(regionTotal)}
              </span>{" "}
              pickups in {ranked.length} {ranked.length === 1 ? "region" : "regions"},{" "}
              {scopeName(regionScope)}
            </p>
            <ol className="mt-3 max-h-[440px] space-y-0.5 overflow-y-auto pr-1">
              {ranked.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRegion(r.id === selectedRegion ? null : r.id)}
                    onMouseEnter={() => setHoverRegion(r.id)}
                    onMouseLeave={() => setHoverRegion(null)}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto] items-baseline gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--a-data)]",
                      r.id === selectedRegion
                        ? "bg-[var(--a-data-soft)]"
                        : "hover:bg-[var(--a-paper)]",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.name}</span>
                      {r.county && (
                        <span className="block truncate text-[11px] text-[var(--a-muted)]">
                          {r.county}
                        </span>
                      )}
                    </span>
                    <span className="a-tabular font-semibold">{r.pickups}</span>
                  </button>
                </li>
              ))}
            </ol>
            {quiet.length > 0 && (
              <p className="mt-3 border-t border-[var(--a-hair)] pt-3 text-[12px] leading-relaxed text-[var(--a-muted)]">
                No pickups yet: {quiet.map((r) => r.name).join(", ")}.
              </p>
            )}
            {regions && regions.unassigned > 0 && (
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--a-muted)]">
                {regions.unassigned} {regions.unassigned === 1 ? "request has" : "requests have"} a
                pickup outside any municipality boundary, or not yet matched.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Requests by item category"
        description="What customers are sending. The grid shows the twelve months up to the selected one; the outlined column is the selected month."
        actions={
          <Segmented
            label="Category time range"
            value={categoryScope}
            onChange={setCategoryScope}
            options={[
              { value: "month", label: monthName },
              { value: "all", label: "All time" },
            ]}
          />
        }
      >
        <div className="grid gap-8">
          <CategoryBars
            rows={data.categories.rows}
            scope={categoryScope === "all" ? "allTime" : "month"}
          />
          <CategoryHeatGrid
            rows={data.categories.rows}
            months={data.categories.months}
            selected={data.month}
          />
        </div>
      </Panel>

      <Panel
        title="Metrics to add next"
        description="Suggestions for seeing where the business is heading. The first four can be built from data the platform already collects."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NEXT_METRICS.map((m) => (
            <article
              key={m.name}
              className="flex flex-col rounded-xl border border-dashed border-[var(--a-axis)] p-4"
            >
              <h4 className="text-[14px] font-semibold leading-snug">{m.name}</h4>
              <p className="mt-2 text-[12.5px] leading-snug text-[var(--a-ink-2)]">{m.why}</p>
              <p
                className={cn(
                  "mt-auto pt-3 text-[12px] font-medium",
                  m.needs ? "text-[var(--a-muted)]" : "text-[var(--a-up)]",
                )}
              >
                {m.needs ? `Needs: ${m.needs}` : "Data already collected"}
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function shiftLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const i = y! * 12 + m! - 2;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}
