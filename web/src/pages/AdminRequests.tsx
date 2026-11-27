import { useCallback, useEffect, useState } from "react";
import { api, type SupportKind, type SupportRequest, type SupportStatus } from "@/lib/api";
import { SUPPORT_KIND_LABEL, SUPPORT_STATUS_LABEL } from "@/lib/format";
import { SupportRequestRow } from "@/components/SupportBits";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = SupportStatus | "active" | "all";
type KindFilter = SupportKind | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Open & in review" },
  { value: "open", label: SUPPORT_STATUS_LABEL.open },
  { value: "in_review", label: SUPPORT_STATUS_LABEL.in_review },
  { value: "resolved", label: SUPPORT_STATUS_LABEL.resolved },
  { value: "all", label: "All" },
];

// Admin inbox for customer support requests. Open requests (waiting on us)
// come first. `onActiveCount` feeds the tab label.
export default function AdminRequests({ onActiveCount }: { onActiveCount?: (n: number) => void }) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [kind, setKind] = useState<KindFilter>("all");
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.supportRequests({ status, kind });
      setRequests(r.requests);
      if (r.active !== undefined) onActiveCount?.(r.active);
    } catch {
      /* ignore transient errors */
    }
  }, [status, kind, onActiveCount]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="rq-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger id="rq-status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="rq-kind" className="text-xs text-muted-foreground">
            Type
          </Label>
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger id="rq-kind" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(SUPPORT_KIND_LABEL) as SupportKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SUPPORT_KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {requests === null ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No requests match these filters.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <SupportRequestRow key={r.id} r={r} viewer="admin" />
          ))}
        </div>
      )}
    </div>
  );
}
