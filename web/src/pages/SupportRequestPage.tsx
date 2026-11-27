import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { api, ApiError, type SupportStatus, type SupportThread } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  orderNo,
  SUPPORT_KIND_LABEL,
  SUPPORT_REPLY_PROMISE,
  SUPPORT_STATUS_LABEL,
  when,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupportStatusBadge } from "@/components/SupportBits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESSAGE_MAX = 4000; // must match server/src/support.ts

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; thread: SupportThread }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "error"; message: string };

// A support request and its conversation, at /requests/:id. Customers see
// their own requests; admins see all and can change the status.
export default function SupportRequestPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ kind: "ok", thread: await api.supportRequest(id) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState({ kind: "not_found" });
      else if (err instanceof ApiError && err.status === 403) setState({ kind: "forbidden" });
      else
        setState({
          kind: "error",
          message: err instanceof ApiError ? err.message : "Could not load this request.",
        });
    }
  }, [id]);

  useEffect(() => {
    setState({ kind: "loading" });
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Resolves true when the reply was sent.
  const send = async (): Promise<boolean> => {
    if (!reply.trim()) {
      toast.error("Write a message first");
      return false;
    }
    setBusy(true);
    try {
      setState({ kind: "ok", thread: await api.replySupportRequest(id, reply.trim()) });
      setReply("");
      toast.success("Reply sent");
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send your reply");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status: SupportStatus) => {
    setBusy(true);
    try {
      setState({ kind: "ok", thread: await api.setSupportStatus(id, status) });
      toast.success(`Marked ${SUPPORT_STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change the status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link to={isAdmin ? "/app?tab=requests" : "/app?tab=contact"}>
          <ArrowLeft className="h-4 w-4" /> {isAdmin ? "Back to requests" : "Back to Contact us"}
        </Link>
      </Button>

      {state.kind === "loading" && (
        <p className="py-12 text-center text-muted-foreground">Loading request…</p>
      )}
      {(state.kind === "not_found" || state.kind === "forbidden" || state.kind === "error") && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold">
              {state.kind === "error" ? "Something went wrong" : "Request not found"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.kind === "error"
                ? state.message
                : "This request doesn't exist or belongs to another account."}
            </p>
          </CardContent>
        </Card>
      )}

      {state.kind === "ok" && (
        <Thread
          thread={state.thread}
          isAdmin={isAdmin}
          myId={user?.id}
          reply={reply}
          setReply={setReply}
          busy={busy}
          send={send}
          changeStatus={changeStatus}
        />
      )}
    </div>
  );
}

function Thread({
  thread: { request: r, messages },
  isAdmin,
  myId,
  reply,
  setReply,
  busy,
  send,
  changeStatus,
}: {
  thread: SupportThread;
  isAdmin: boolean;
  myId: string | undefined;
  reply: string;
  setReply: (s: string) => void;
  busy: boolean;
  send: () => Promise<boolean>;
  changeStatus: (s: SupportStatus) => void;
}) {
  const resolved = r.status === "resolved";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-primary">{r.ref}</p>
            <CardTitle className="mt-1 break-words text-xl">{r.subject}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {SUPPORT_KIND_LABEL[r.kind]} · opened {when(r.createdAt)}
            </p>
          </div>
          <SupportStatusBadge status={r.status} />
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          {isAdmin && (
            <p>
              <span className="text-muted-foreground">Customer:</span>{" "}
              <Link
                to={`/admin/users/${r.customerId}`}
                className="text-primary underline underline-offset-2"
              >
                {r.customerName}
              </Link>
            </p>
          )}
          {r.orderId && r.orderNumber !== null && (
            <p>
              <span className="text-muted-foreground">Order:</span>{" "}
              <Link
                to={`/orders/${r.orderId}`}
                className="font-mono text-primary underline underline-offset-2"
              >
                {orderNo(r.orderNumber)}
              </Link>
            </p>
          )}
          {r.courierName && (
            <p>
              <span className="text-muted-foreground">Courier:</span>{" "}
              {isAdmin && r.courierId ? (
                <Link
                  to={`/admin/users/${r.courierId}`}
                  className="text-primary underline underline-offset-2"
                >
                  {r.courierName}
                </Link>
              ) : (
                r.courierName
              )}
            </p>
          )}
          {isAdmin && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
              <Label htmlFor="sr-status" className="text-muted-foreground">
                Status
              </Label>
              <Select
                value={r.status}
                onValueChange={(v) => changeStatus(v as SupportStatus)}
                disabled={busy}
              >
                <SelectTrigger id="sr-status" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["open", "in_review", "resolved"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUPPORT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <ol className="space-y-3" aria-label="Conversation">
        {messages.map((m) => {
          const mine = m.authorId === myId;
          const staff = m.authorRole === "admin";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg border px-4 py-3",
                  staff ? "border-primary/20 bg-primary/5" : "bg-card",
                )}
              >
                <p className="text-xs font-medium">
                  {mine ? "You" : m.authorName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {when(m.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {!isAdmin && !resolved && r.lastAuthorRole === "customer" && (
        <p className="text-sm text-muted-foreground">{SUPPORT_REPLY_PROMISE}</p>
      )}

      <Card>
        <CardContent className="space-y-3 pt-6">
          <Label htmlFor="sr-reply">
            {isAdmin ? `Reply to ${r.customerName}` : resolved ? "Still need help?" : "Add a reply"}
          </Label>
          {!isAdmin && resolved && (
            <p className="text-xs text-muted-foreground">
              This request is resolved. Replying will reopen it.
            </p>
          )}
          <Textarea
            id="sr-reply"
            rows={4}
            maxLength={MESSAGE_MAX}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-2">
            {isAdmin && !resolved && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (reply.trim() && !(await send())) return;
                  changeStatus("resolved");
                }}
              >
                {reply.trim() ? "Send & resolve" : "Mark resolved"}
              </Button>
            )}
            <Button onClick={send} disabled={busy || !reply.trim()}>
              <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send reply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
