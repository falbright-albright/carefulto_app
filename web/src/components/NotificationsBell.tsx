import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Bell, ChevronRight } from "lucide-react";
import { api, type Notification } from "@/lib/api";
import { when } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Polls the notification feed and shows an unread badge. `pulse` changes force
// an immediate refetch (e.g. right after the user takes an action).
export function NotificationsBell({ pulse }: { pulse?: number }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { notifications, unread } = await api.notifications();
      setItems(notifications);
      setUnread(unread);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, pulse]);

  const onOpenChange = async (o: boolean) => {
    setOpen(o);
    if (o && unread > 0) {
      await api.markNotificationsRead();
      setUnread(0);
      load();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                {n.order_id ? (
                  // Every order notification is a shortcut to that order's page.
                  <Link
                    to={`/orders/${n.order_id}`}
                    onClick={() => setOpen(false)}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <NotificationText n={n} />
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                ) : (
                  <div className="py-3">
                    <NotificationText n={n} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotificationText({ n }: { n: Notification }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm">{n.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">{when(n.created_at)}</p>
    </div>
  );
}
