import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type Order } from "@/lib/api";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { StarPicker } from "@/components/StarRating";

const COMMENT_MAX = 1000;
const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

// Customer action on a completed order: confirm the delivery and, optionally,
// rate it 1–5 stars with a short comment. Used on the customer dashboard and
// the order page.
export function VerifyDeliveryDialog({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.verifyOrder(order.id, {
        rating,
        comment: rating && comment.trim() ? comment.trim() : undefined,
      });
      toast.success(
        rating ? "Delivery verified. Thanks for rating it!" : "Delivery verified. Thank you!",
      );
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not verify");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Verify delivery completed</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm your delivery</DialogTitle>
          <DialogDescription>
            {order.courierName ? `${order.courierName} reported` : "Your courier reported"} this{" "}
            {order.itemCategory.toLowerCase()} delivered. How did it go? Rating is optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <StarPicker value={rating} onChange={setRating} />
            <p className="h-5 text-sm text-muted-foreground">
              {rating ? `${rating}/5 · ${LABELS[rating]}` : "No rating"}
            </p>
          </div>
          {rating !== null && (
            <div className="space-y-2">
              <Label htmlFor={`rating-comment-${order.id}`}>Comment (optional)</Label>
              <Textarea
                id={`rating-comment-${order.id}`}
                rows={3}
                maxLength={COMMENT_MAX}
                placeholder="Anything CarefulTO should know about this delivery?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shared with CarefulTO only, not with your courier.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Verifying…" : rating ? "Verify and submit rating" : "Verify without rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
