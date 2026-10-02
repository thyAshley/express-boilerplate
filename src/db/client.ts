import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle Postgres client");
});

export const db = drizzle({ client: pool, schema });

export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
