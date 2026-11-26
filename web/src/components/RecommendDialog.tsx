import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Order } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Courier = { id: string; name: string; email: string };

// Admin action: recommend a placed/rejected order to a courier. Used on the
// admin dashboard's order table and on the order detail page.
export function RecommendDialog({
  order,
  couriers,
  onDone,
}: {
  order: Order;
  couriers: Courier[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!courierId) return toast.error("Choose a courier");
    setBusy(true);
    try {
      await api.recommendOrder(order.id, courierId);
      toast.success("Order recommended to courier");
      setOpen(false);
      setCourierId("");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not recommend");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={couriers.length === 0}>
          Recommend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recommend order to a courier</DialogTitle>
          <DialogDescription>
            {order.itemCategory} · {order.pickupAddress} → {order.dropoffAddress}
            {order.notes && <span className="mt-2 block whitespace-pre-wrap">Notes: {order.notes}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Courier</Label>
          <Select value={courierId} onValueChange={setCourierId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a courier" />
            </SelectTrigger>
            <SelectContent>
              {couriers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Recommend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
