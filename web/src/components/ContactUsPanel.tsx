import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CircleCheck, HelpCircle, MessageCircle, Package, Send, UserRound } from "lucide-react";
import { api, ApiError, type Order, type SupportKind, type SupportRequest } from "@/lib/api";
import { orderNo, SUPPORT_REPLY_PROMISE, when } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupportRequestRow } from "@/components/SupportBits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Must match server/src/support.ts.
const SUBJECT_MAX = 120;
const MESSAGE_MAX = 4000;

const KINDS: { kind: SupportKind; title: string; hint: string; icon: typeof Package }[] = [
  { kind: "delivery", title: "A delivery", hint: "Late, damaged, missing…", icon: Package },
  { kind: "courier", title: "A courier", hint: "How your courier behaved", icon: UserRound },
  { kind: "question", title: "A question", hint: "About our service", icon: HelpCircle },
  { kind: "comment", title: "A comment", hint: "Feedback or ideas", icon: MessageCircle },
];

const MESSAGE_PLACEHOLDER: Record<SupportKind, string> = {
  delivery:
    "What went wrong? Include when you noticed it and anything that would help us look into it.",
  courier: "What happened with your courier? Please describe it as specifically as you can.",
  question: "What would you like to know?",
  comment: "We read every comment. What's on your mind?",
};

const needsOrder = (k: SupportKind) => k === "delivery" || k === "courier";

export interface ContactPreset {
  kind: SupportKind;
  orderId?: string;
}

// The customer's "Contact us" tab: a form for a new request, then the
// customer's past requests. `preset` (from "Report a problem" on an order)
// pre-fills the topic and order.
export function ContactUsPanel({ orders, preset }: { orders: Order[]; preset?: ContactPreset }) {
  const [kind, setKind] = useState<SupportKind | null>(preset?.kind ?? null);
  const [orderId, setOrderId] = useState(preset?.orderId ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<SupportRequest | null>(null);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests((await api.supportRequests()).requests);
    } catch {
      /* ignore transient errors */
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // A courier complaint can only be about an order that had a courier.
  const choosable = useMemo(
    () => (kind === "courier" ? orders.filter((o) => o.courierId) : orders),
    [kind, orders],
  );
  const order = orders.find((o) => o.id === orderId);

  const pickKind = (k: SupportKind) => {
    setKind(k);
    if (!needsOrder(k)) setOrderId("");
    else if (k === "courier" && order && !order.courierId) setOrderId("");
  };

  const submit = async () => {
    if (!kind) return toast.error("Choose what this is about");
    if (needsOrder(kind) && !orderId) return toast.error("Choose the order this is about");
    if (!subject.trim()) return toast.error("Add a subject");
    if (!message.trim()) return toast.error("Write a message");
    setSending(true);
    try {
      const { request } = await api.createSupportRequest({
        kind,
        orderId: needsOrder(kind) ? orderId : undefined,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSent(request);
      setKind(null);
      setOrderId("");
      setSubject("");
      setMessage("");
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send your request");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {sent ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <CircleCheck className="h-8 w-8 text-emerald-600" aria-hidden />
            <div>
              <p className="text-lg font-semibold">Thanks, we've got it.</p>
              <p className="text-sm text-muted-foreground">
                Your reference is <span className="font-mono font-semibold">{sent.ref}</span>.{" "}
                {SUPPORT_REPLY_PROMISE} You'll get a notification when we do.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={`/requests/${sent.id}`}>View request</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSent(null)}>
                Send another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>How can we help?</CardTitle>
            <CardDescription>
              Report a problem, ask a question or tell us what you think. {SUPPORT_REPLY_PROMISE}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">What's this about?</legend>
              <div className="grid grid-cols-2 gap-2">
                {KINDS.map(({ kind: k, title, hint, icon: Icon }) => (
                  <label
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      kind === k
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="contact-kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => pickKind(k)}
                      className="sr-only"
                    />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {kind && needsOrder(kind) && (
              <div className="space-y-2">
                <Label htmlFor="cu-order">Which order?</Label>
                {choosable.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    {kind === "courier"
                      ? "None of your orders has had a courier assigned yet."
                      : "You don't have any orders yet."}{" "}
                    You can still send us a question instead.
                  </p>
                ) : (
                  <Select value={orderId} onValueChange={setOrderId}>
                    <SelectTrigger id="cu-order">
                      <SelectValue placeholder="Choose an order" />
                    </SelectTrigger>
                    <SelectContent>
                      {choosable.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {orderNo(o.orderNumber)} · {o.itemCategory} · {when(o.createdAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {order && (
                  <p className="text-xs text-muted-foreground">
                    {order.pickupAddress} → {order.dropoffAddress}
                    {kind === "courier" && order.courierName && (
                      <>
                        <br />
                        Courier:{" "}
                        <span className="font-medium text-foreground">{order.courierName}</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            )}

            {kind && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cu-subject">Subject</Label>
                  <Input
                    id="cu-subject"
                    maxLength={SUBJECT_MAX}
                    placeholder="A few words, e.g. “Package arrived damaged”"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cu-message">Message</Label>
                  <Textarea
                    id="cu-message"
                    rows={5}
                    maxLength={MESSAGE_MAX}
                    placeholder={MESSAGE_PLACEHOLDER[kind]}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={submit} disabled={sending}>
                  <Send className="h-4 w-4" />
                  {sending ? "Sending…" : "Send"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your requests</h2>
        {requests === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't contacted us yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <SupportRequestRow key={r.id} r={r} viewer="customer" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
