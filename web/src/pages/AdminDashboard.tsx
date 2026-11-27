import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, ApiError, type AdminUser } from "@/lib/api";
import { when } from "@/lib/format";
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
import AnalyticsPanel from "@/pages/AnalyticsPanel";
import AdminOrders from "@/pages/AdminOrders";
import type { Courier } from "@/components/RecommendDialog";

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
          <DialogDescription>
            Customers sign up themselves; you create staff here.
          </DialogDescription>
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
            <Input
              id="cu-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  const load = async () => {
    try {
      const [c, u] = await Promise.all([api.listCouriers(), api.listUsers()]);
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

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-bold">Admin dashboard</h1>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <AdminOrders couriers={couriers} />
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
                    <TableCell>
                      <Link
                        to={`/admin/users/${u.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {u.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="capitalize">{u.role}</TableCell>
                    <TableCell>
                      {u.banned_at ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {when(u.created_at)}
                    </TableCell>
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
        <TabsContent value="analytics">
          <AnalyticsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
