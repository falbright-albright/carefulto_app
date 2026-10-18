import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, type AdminUser, type Order } from "@/lib/api";
import { money, when } from "@/lib/format";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { UserPlus } from "lucide-react";

type Courier = { id: string; name: string; email: string };

function RecommendDialog({
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

function CreateUserDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"courier" | "admin">("courier");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !email || password.length < 8) {
      return toast.error("Name, email and an 8+ char password are required");
    }
    setBusy(true);
    try {
      await api.createUser({ name, email, password, role });
      toast.success(`${role} account created`);
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("courier");
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> New courier / admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create courier or admin</DialogTitle>
          <DialogDescription>Customers sign up themselves; you create staff here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "courier" | "admin")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="courier">Courier</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-name">Full name</Label>
            <Input id="cu-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-pw">Temporary password</Label>
            <Input
              id="cu-pw"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const load = async () => {
    try {
      const [o, c, u] = await Promise.all([
        api.listOrders(),
        api.listCouriers(),
        api.listUsers(),
      ]);
      setOrders(o.orders);
      setCouriers(c.couriers);
      setUsers(u.users);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const setBan = async (u: AdminUser) => {
    try {
      if (u.banned_at) {
        await api.unbanUser(u.id);
        toast.success(`${u.name} un-banned`);
      } else {
        await api.banUser(u.id);
        toast.success(`${u.name} banned`);
      }
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    }
  };

  const verificationCell = (o: Order) => {
    if (o.status === "verified") return <span className="text-emerald-600">Both ✓</span>;
    if (o.status === "completed") {
      return (
        <span className="text-xs text-muted-foreground">
          Courier ✓ · Customer {o.customerVerifiedAt ? "✓" : "…"}
        </span>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Admin dashboard</h1>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          {orders.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No orders yet.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placed</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {when(o.createdAt)}
                      </TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell>{o.itemCategory}</TableCell>
                      <TableCell className="max-w-[220px] text-xs">
                        <div className="truncate">{o.pickupAddress}</div>
                        <div className="truncate text-muted-foreground">→ {o.dropoffAddress}</div>
                        <div className="text-muted-foreground">{o.distanceKm} km</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {money(o.price, o.currency)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="text-sm">{o.courierName ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{verificationCell(o)}</TableCell>
                      <TableCell className="text-right">
                        {(o.status === "placed" || o.status === "rejected") && (
                          <RecommendDialog order={o} couriers={couriers} onDone={load} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {couriers.length === 0 && (
            <p className="mt-3 text-sm text-amber-600">
              No couriers exist yet — create one in the Users tab before recommending orders.
            </p>
          )}
        </TabsContent>

        <TabsContent value="users">
          <div className="mb-4 flex justify-end">
            <CreateUserDialog onDone={load} />
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>
                      {u.banned_at ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(u.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant={u.banned_at ? "outline" : "destructive"}
                          onClick={() => setBan(u)}
                        >
                          {u.banned_at ? "Un-ban" : "Ban"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
