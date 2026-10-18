// Typed client for the Careful2 API. Token is kept in localStorage and sent as
// a Bearer header. All requests are same-origin (/api/*), proxied to the Bun
// server in dev and served by it in production.

export type Role = "customer" | "courier" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type OrderStatus =
  | "placed"
  | "recommended"
  | "accepted"
  | "rejected"
  | "completed"
  | "verified"
  | "cancelled";

export interface Order {
  id: string;
  status: OrderStatus;
  itemCategory: string;
  itemDescription: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  distanceSource: string;
  price: number;
  currency: string;
  customerId: string;
  customerName: string;
  courierId: string | null;
  courierName: string | null;
  customerVerifiedAt: string | null;
  courierVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  order_id: string;
  type: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  banned_at: string | null;
  created_at: string;
}

export interface Quote {
  distanceKm: number;
  price: number;
  currency: string;
  source: string;
  needsManual?: boolean;
  reason?: string;
}

export interface AppConfig {
  pricing: { base: number; perKm: number; min: number; currency: string };
  distance: { provider: string; configured: boolean };
}

const TOKEN_KEY = "careful2_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { okStatuses?: number[] },
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok && !opts?.okStatuses?.includes(res.status)) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data);
  }
  return data as T;
}

export const api = {
  // auth
  register: (email: string, name: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/register", { email, name, password }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/login", { email, password }),
  logout: () => request<{ ok: true }>("POST", "/auth/logout"),
  me: () => request<{ user: User }>("GET", "/auth/me"),

  // meta
  categories: () => request<{ categories: string[] }>("GET", "/categories"),
  config: () => request<AppConfig>("GET", "/config"),

  // orders
  quote: (pickupAddress: string, dropoffAddress: string, manualKm?: number) =>
    request<Quote>(
      "POST",
      "/orders/quote",
      { pickupAddress, dropoffAddress, manualKm },
      { okStatuses: [422] },
    ),
  createOrder: (input: {
    itemCategory: string;
    itemDescription?: string;
    pickupAddress: string;
    dropoffAddress: string;
    manualKm?: number;
  }) => request<{ order: Order }>("POST", "/orders", input),
  listOrders: () => request<{ orders: Order[] }>("GET", "/orders"),
  getOrder: (id: string) => request<{ order: Order }>("GET", `/orders/${id}`),
  completeOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/complete`),
  verifyOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/verify`),
  acceptOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/accept`),
  rejectOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/reject`),
  recommendOrder: (id: string, courierId: string) =>
    request<{ order: Order }>("POST", `/orders/${id}/recommend`, { courierId }),

  // admin
  listUsers: () => request<{ users: AdminUser[] }>("GET", "/admin/users"),
  listCouriers: () => request<{ couriers: { id: string; name: string; email: string }[] }>(
    "GET",
    "/admin/couriers",
  ),
  createUser: (input: { email: string; name: string; password: string; role: "courier" | "admin" }) =>
    request<{ user: AdminUser }>("POST", "/admin/users", input),
  banUser: (id: string) => request<{ ok: true }>("POST", `/admin/users/${id}/ban`),
  unbanUser: (id: string) => request<{ ok: true }>("POST", `/admin/users/${id}/unban`),

  // notifications
  notifications: () =>
    request<{ notifications: Notification[]; unread: number }>("GET", "/notifications"),
  markNotificationsRead: () => request<{ ok: true }>("POST", "/notifications/read"),
};
