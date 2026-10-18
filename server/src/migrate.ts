import { sql } from "./db.ts";
import { config } from "./config.ts";
import { hashPassword } from "./auth.ts";

// Applies db/schema.sql (idempotent) and seeds the default admin account.
// Runs on every boot; safe to repeat.
export async function migrateAndSeed(): Promise<void> {
  // schema.sql lives at <repo>/db/schema.sql. This file is <repo>/server/src.
  const schemaPath = new URL("../../db/schema.sql", import.meta.url).pathname;
  const schema = await Bun.file(schemaPath).text();
  await sql.unsafe(schema);
  console.log("[db] schema applied");

  // Seed the default admin if it does not exist.
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${config.admin.email}
  `;
  if (existing.length === 0) {
    const hash = await hashPassword(config.admin.password);
    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${config.admin.email}, ${config.admin.name}, ${hash}, 'admin')
    `;
    console.log(`[db] seeded default admin: ${config.admin.email}`);
  }
}
