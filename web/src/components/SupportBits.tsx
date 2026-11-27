import { Link } from "react-router-dom";
import { ChevronRight, MessageSquareReply } from "lucide-react";
import type { SupportRequest, SupportStatus } from "@/lib/api";
import {
  orderNo,
  SUPPORT_KIND_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_STATUS_VARIANT,
  when,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  return <Badge variant={SUPPORT_STATUS_VARIANT[status]}>{SUPPORT_STATUS_LABEL[status]}</Badge>;
}

// One request in a list, linking to its conversation at /requests/:id.
// `viewer` decides the "waiting" hint: customers are told when support has
// replied, admins when the customer is waiting on them.
export function SupportRequestRow({
  r,
  viewer,
}: {
  r: SupportRequest;
  viewer: "customer" | "admin";
}) {
  const waiting =
    r.status !== "resolved" &&
    (viewer === "customer" ? r.lastAuthorRole === "admin" : r.lastAuthorRole === "customer");
  return (
    <Link
      to={`/requests/${r.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-primary">{r.ref}</span>
          <span className="text-xs text-muted-foreground">{SUPPORT_KIND_LABEL[r.kind]}</span>
          {r.orderNumber !== null && (
            <span className="text-xs text-muted-foreground">· {orderNo(r.orderNumber)}</span>
          )}
        </div>
        <p className="mt-1 truncate font-medium">{r.subject}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {viewer === "admin" && <>{r.customerName} · </>}
          {viewer === "admin" && r.kind === "courier" && r.courierName && (
            <>Courier: {r.courierName} · </>
          )}
          Updated {when(r.lastMessageAt ?? r.updatedAt)}
        </p>
        {waiting && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden />
            {viewer === "customer" ? "Support replied" : "Waiting on us"}
          </p>
        )}
      </div>
      <SupportStatusBadge status={r.status} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
