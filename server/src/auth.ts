import { randomBytes } from "node:crypto";
import { sql } from "./db.ts";
import { config } from "./config.ts";

export type Role = "customer" | "courier" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  banned_at: string | null;
  created_at: string;
}

export async function hashPassword(pw: string): Promise<string> {
  return Bun.password.hash(pw); // bcrypt by default
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(pw, hash);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expires})
  `;
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

// Resolve the bearer token on a request to a live, non-banned user.
export async function userFromRequest(req: Request): Promise<User | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const rows = await sql<User[]>`
    SELECT u.id, u.email, u.name, u.role, u.banned_at, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > now()
  `;
  const user = rows[0];
  if (!user) return null;
  if (user.banned_at) return null; // banned users are locked out immediately
  return user;
}

export function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}
