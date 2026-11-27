import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Ban, FileText, MoreVertical, Undo2 } from "lucide-react";
import { api, ApiError, type Order } from "@/lib/api";
import { orderNo } from "@/lib/format";
import { orderPath } from "@/components/OrderLink";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Statuses an admin can still cancel (mirrors the server's CANCELLABLE).
export const canCancel = (o: Order) =>
  ["placed", "recommended", "accepted", "rejected"].includes(o.status);

// Confirm-and-cancel dialog, shared by the table menu and the order page.
export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onDone,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.cancelOrder(order.id, reason.trim() || undefined);
      toast.success(`Order ${orderNo(order.orderNumber)} cancelled`);
      setReason("");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not cancel the order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel order {orderNo(order.orderNumber)}?</DialogTitle>
          <DialogDescription>
            {order.itemCategory} for {order.customerName}. The order stays on record, marked
            Cancelled. The customer{order.courierName ? ` and ${order.courierName}` : ""} will be
            notified, and a refund will be marked as owed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Reason (optional, shown to the customer)</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            maxLength={500}
            placeholder="e.g. Customer asked to cancel by phone"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The ⋮ menu at the end of each admin Orders row.
export function OrderAdminMenu({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const navigate = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancellable = canCancel(order);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={`Actions for order ${orderNo(order.orderNumber)}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate(orderPath(order.id))}>
            <FileText /> View details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!cancellable}
            onSelect={() => setCancelOpen(true)}
            className="text-destructive focus:text-destructive"
            title={
              cancellable ? undefined : "Delivered or already cancelled orders can't be cancelled"
            }
          >
            <Ban /> Cancel order
          </DropdownMenuItem>
          {/* TODO(refunds): wire to the refund flow in the refunds PR. */}
          <DropdownMenuItem disabled>
            <Undo2 /> Refund
            <span className="ml-auto pl-3 text-xs text-muted-foreground">Coming soon</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CancelOrderDialog
        order={order}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onDone={onChanged}
      />
    </>
  );
}
