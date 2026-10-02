import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, db, pingDb } from "../src/db/client.js";

// Runs only when a real database is available, e.g. `RUN_DB_TESTS=1 pnpm test`
describe.runIf(process.env.RUN_DB_TESTS)("database (integration)", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("connects and runs a query", async () => {
    await expect(pingDb()).resolves.toBeUndefined();
    const result = await db.execute<{ n: number }>(sql`select 1 as n`);
    expect(result.rows[0]?.n).toBe(1);
  });
});
