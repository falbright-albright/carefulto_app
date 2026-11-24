// config.ts throws on missing required env vars at import time. Unit tests
// never touch the database, so a placeholder URL is enough.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
