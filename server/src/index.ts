import { config } from "./config.ts";
import { waitForDb } from "./db.ts";
import { migrateAndSeed } from "./migrate.ts";
import { userFromRequest, type Role, type User } from "./auth.ts";
import { json, error } from "./http.ts";

import * as authR from "./routes/auth.ts";
import * as metaR from "./routes/meta.ts";
import * as geoR from "./routes/geo.ts";
import * as orderR from "./routes/orders.ts";
import * as adminR from "./routes/admin.ts";
import * as courierR from "./routes/courier.ts";
import * as notifR from "./routes/notifications.ts";

type Handler = (req: Request, params: Record<string, string>, user: User) => Promise<Response>;
type Access = "public" | Role[]; // "public" = no auth; array = allowed roles

interface Route {
  method: string;
  pattern: string; // e.g. "/api/orders/:id/accept"
  access: Access;
  handler: Handler;
}

const routes: Route[] = [
  // --- auth ---
  { method: "POST", pattern: "/api/auth/register", access: "public", handler: authR.register },
  { method: "POST", pattern: "/api/auth/login", access: "public", handler: authR.login },
  { method: "POST", pattern: "/api/auth/logout", access: ["customer", "courier", "admin"], handler: authR.logout },
  { method: "GET", pattern: "/api/auth/me", access: ["customer", "courier", "admin"], handler: authR.me },

  // --- meta ---
  { method: "GET", pattern: "/api/categories", access: "public", handler: metaR.categories },
  { method: "GET", pattern: "/api/config", access: "public", handler: metaR.appConfig },

  // --- geo ---
  { method: "GET", pattern: "/api/geo/autocomplete", access: ["customer", "admin"], handler: geoR.getAutocomplete },
  { method: "GET", pattern: "/api/geo/route", access: ["customer", "admin"], handler: geoR.getRoute },

  // --- orders ---
  { method: "POST", pattern: "/api/orders/quote", access: ["customer", "admin"], handler: orderR.quote },
  { method: "POST", pattern: "/api/orders", access: ["customer"], handler: orderR.create },
  { method: "GET", pattern: "/api/orders", access: ["customer", "courier", "admin"], handler: orderR.list },
  { method: "GET", pattern: "/api/orders/:id", access: ["customer", "courier", "admin"], handler: orderR.getOne },
  { method: "POST", pattern: "/api/orders/:id/complete", access: ["courier"], handler: orderR.complete },
  { method: "POST", pattern: "/api/orders/:id/verify", access: ["customer"], handler: orderR.verify },

  // --- courier actions ---
  { method: "POST", pattern: "/api/orders/:id/accept", access: ["courier"], handler: courierR.accept },
  { method: "POST", pattern: "/api/orders/:id/reject", access: ["courier"], handler: courierR.reject },

  // --- admin ---
  { method: "POST", pattern: "/api/orders/:id/recommend", access: ["admin"], handler: adminR.recommend },
  { method: "GET", pattern: "/api/admin/users", access: ["admin"], handler: adminR.listUsers },
  { method: "GET", pattern: "/api/admin/couriers", access: ["admin"], handler: adminR.listCouriers },
  { method: "POST", pattern: "/api/admin/users", access: ["admin"], handler: adminR.createUser },
  { method: "POST", pattern: "/api/admin/users/:id/ban", access: ["admin"], handler: adminR.banUser },
  { method: "POST", pattern: "/api/admin/users/:id/unban", access: ["admin"], handler: adminR.unbanUser },

  // --- notifications ---
  { method: "GET", pattern: "/api/notifications", access: ["customer", "courier", "admin"], handler: notifR.list },
  { method: "POST", pattern: "/api/notifications/read", access: ["customer", "courier", "admin"], handler: notifR.markAllRead },
];

// Match a concrete pathname against a route pattern with :params.
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const pp = pattern.split("/");
  const ap = path.split("/");
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i]!.startsWith(":")) params[pp[i]!.slice(1)] = decodeURIComponent(ap[i]!);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

const STATIC_DIR = process.env.STATIC_DIR ?? new URL("../../web/dist", import.meta.url).pathname;

async function serveStatic(pathname: string): Promise<Response> {
  // Serve built SPA files; fall back to index.html for client-side routing.
  const safe = pathname.replace(/\.\./g, "");
  const candidate = safe === "/" ? "/index.html" : safe;
  const file = Bun.file(STATIC_DIR + candidate);
  if (await file.exists()) return new Response(file);
  const index = Bun.file(STATIC_DIR + "/index.html");
  if (await index.exists()) return new Response(index);
  return new Response("Not found", { status: 404 });
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/api/health") return json({ ok: true });

  if (path.startsWith("/api/")) {
    for (const route of routes) {
      if (route.method !== req.method) continue;
      const params = matchPath(route.pattern, path);
      if (!params) continue;

      let user: User | null = null;
      if (route.access !== "public") {
        user = await userFromRequest(req);
        if (!user) return error("authentication required", 401);
        if (!route.access.includes(user.role)) return error("forbidden", 403);
      }
      try {
        return await route.handler(req, params, user as User);
      } catch (err) {
        console.error(`[api] ${req.method} ${path} failed:`, err);
        return error("internal server error", 500);
      }
    }
    return error("not found", 404);
  }

  // Non-API GET -> static SPA.
  if (req.method === "GET") return serveStatic(path);
  return error("not found", 404);
}

// --- boot ---
console.log("[boot] starting Careful2 server...");
await waitForDb();
await migrateAndSeed();

const server = Bun.serve({
  port: config.port,
  fetch: handle,
});
console.log(`[boot] Careful2 server listening on http://localhost:${server.port}`);
