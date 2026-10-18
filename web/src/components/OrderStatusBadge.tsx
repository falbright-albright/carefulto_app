import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/format";
import type { OrderStatus } from "@/lib/api";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
