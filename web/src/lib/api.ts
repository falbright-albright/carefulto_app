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
  orderNumber: number;
  status: OrderStatus;
  itemCategory: string;
  itemDescription: string | null;
  notes: string | null;
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
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  refundStatus: "pending" | "refunded" | null;
}

export interface AccountDetails {
  user: AdminUser;
  customer?: {
    orders: number;
    open: number;
    delivered: number;
    cancelled: number;
    spent: number;
    lastOrderAt: string | null;
    currency: string;
  };
  courier?: {
    delivered: number;
    deliveredThisMonth: number;
    inProgress: number;
    awaitingReply: number;
    rejected: number;
    cancelledWhileAssigned: number;
    earningsThisMonth: number;
    earningsAllTime: number;
    currency: string;
  };
  recentOrders: Order[];
}

export interface OrderPage {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
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
  durationMin: number;
  price: number;
  currency: string;
  source: string;
  geometry: [number, number][]; // [lat, lng] pairs for the route line
}

export interface AppConfig {
  pricing: { base: number; perKm: number; min: number; currency: string };
  distance: { provider: string };
}

export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PeriodStats {
  requests: number;
  deliveries: number;
  revenue: number;
  avgPrice: number | null;
  avgDistanceKm: number | null;
  activeCouriers: number;
  deliveriesPerActiveCourier: number | null;
  requestingCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  offers: number;
  offersAccepted: number;
  avgMinutesToAccept: number | null;
}

export interface AnalyticsOverview {
  month: string; // YYYY-MM
  firstMonth: string;
  currentMonth: string;
  timeZone: string;
  currency: string;
  totals: {
    customers: number;
    couriers: number;
    couriersActive: number;
    awaitingCourier: number;
    inProgress: number;
    deliveriesAllTime: number;
    revenueAllTime: number;
  };
  current: PeriodStats;
  previous: PeriodStats;
  previousIsPartial: boolean; // previous covers the same elapsed stretch only
  daily: { date: string; deliveries: number; requests: number }[];
  categories: {
    months: string[]; // trailing 12 months, oldest first
    rows: { category: string; month: number; allTime: number; byMonth: number[] }[];
  };
}

export interface RegionStat {
  id: string;
  name: string;
  county: string | null;
  baseline: boolean; // one of the always-drawn GTA/Hamilton municipalities
  pickups: number;
  delivered: number;
  geojson: GeoJSON.Geometry | null;
}

export interface RegionAnalytics {
  month: string; // YYYY-MM or "all"
  unassigned: number;
  regions: RegionStat[];
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

  // geo
  addressAutocomplete: (q: string) =>
    request<{ suggestions: AddressSuggestion[] }>(
      "GET",
      `/geo/autocomplete?q=${encodeURIComponent(q)}`,
    ),

  // orders
  quote: (pickup: GeoPoint, dropoff: GeoPoint) =>
    request<Quote>("POST", "/orders/quote", {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropoffLat: dropoff.lat,
      dropoffLng: dropoff.lng,
    }),
  createOrder: (input: {
    itemCategory: string;
    itemDescription?: string;
    notes?: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
  }) => request<{ order: Order }>("POST", "/orders", input),
  listOrders: () => request<{ orders: Order[] }>("GET", "/orders"),
  getOrder: (id: string) => request<{ order: Order }>("GET", `/orders/${id}`),
  completeOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/complete`),
  verifyOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/verify`),
  acceptOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/accept`),
  rejectOrder: (id: string) => request<{ order: Order }>("POST", `/orders/${id}/reject`),
  cancelOrder: (id: string, reason?: string) =>
    request<{ order: Order }>("POST", `/orders/${id}/cancel`, { reason }),
  searchOrders: (params: { q?: string; month?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.month) qs.set("month", params.month);
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const s = qs.toString();
    return request<OrderPage>("GET", `/admin/orders${s ? `?${s}` : ""}`);
  },
  getAccount: (id: string) => request<AccountDetails>("GET", `/admin/users/${id}`),
  recommendOrder: (id: string, courierId: string) =>
    request<{ order: Order }>("POST", `/orders/${id}/recommend`, { courierId }),

  // admin
  listUsers: () => request<{ users: AdminUser[] }>("GET", "/admin/users"),
  listCouriers: () =>
    request<{ couriers: { id: string; name: string; email: string }[] }>("GET", "/admin/couriers"),
  createUser: (input: {
    email: string;
    name: string;
    password: string;
    role: "courier" | "admin";
  }) => request<{ user: AdminUser }>("POST", "/admin/users", input),
  banUser: (id: string) => request<{ ok: true }>("POST", `/admin/users/${id}/ban`),
  unbanUser: (id: string) => request<{ ok: true }>("POST", `/admin/users/${id}/unban`),
  // No month = the current month (server's business time zone).
  analytics: (month?: string) =>
    request<AnalyticsOverview>(
      "GET",
      month ? `/admin/analytics?month=${encodeURIComponent(month)}` : "/admin/analytics",
    ),
  regionAnalytics: (month: string | "all") =>
    request<RegionAnalytics>("GET", `/admin/analytics/regions?month=${encodeURIComponent(month)}`),

  // notifications
  notifications: () =>
    request<{ notifications: Notification[]; unread: number }>("GET", "/notifications"),
  markNotificationsRead: () => request<{ ok: true }>("POST", "/notifications/read"),
};
