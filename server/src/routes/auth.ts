import { sql } from "../db.ts";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
  publicUser,
  type User,
} from "../auth.ts";
import { json, error, readJson, reqStr } from "../http.ts";

// POST /api/auth/register  — self-service signup, always creates a customer.
export async function register(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = reqStr(body.email)?.toLowerCase();
  const name = reqStr(body.name);
  const password = reqStr(body.password);
  if (!email || !name || !password) return error("email, name and password are required");
  if (password.length < 8) return error("password must be at least 8 characters");

  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) return error("an account with that email already exists", 409);

  const hash = await hashPassword(password);
  const rows = await sql<User[]>`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (${email}, ${name}, ${hash}, 'customer')
    RETURNING id, email, name, role, banned_at, created_at
  `;
  const user = rows[0]!;
  const token = await createSession(user.id);
  return json({ token, user: publicUser(user) }, 201);
}

// POST /api/auth/login
export async function login(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = reqStr(body.email)?.toLowerCase();
  const password = reqStr(body.password);
  if (!email || !password) return error("email and password are required");

  const rows = await sql<(User & { password_hash: string })[]>`
    SELECT id, email, name, role, banned_at, created_at, password_hash
    FROM users WHERE email = ${email}
  `;
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return error("invalid email or password", 401);
  }
  if (user.banned_at) return error("this account has been banned", 403);

  const token = await createSession(user.id);
  return json({ token, user: publicUser(user) });
}

// POST /api/auth/logout  (authenticated)
export async function logout(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token) await destroySession(token);
  return json({ ok: true });
}

// GET /api/auth/me
export async function me(_req: Request, _p: Record<string, string>, user: User): Promise<Response> {
  return json({ user: publicUser(user) });
}
