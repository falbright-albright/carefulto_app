import postgres from "postgres";
import { config } from "./config.ts";

// A single shared connection pool for the whole server.
export const sql = postgres(config.databaseUrl, {
  max: 10,
  onnotice: () => {}, // silence NOTICE spam from IF NOT EXISTS DDL
});

// Wait for Postgres to be reachable (the db container may still be starting).
export async function waitForDb(retries = 30, delayMs = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`[db] not ready yet, retrying (${i + 1}/${retries})...`);
      await Bun.sleep(delayMs);
    }
  }
}
