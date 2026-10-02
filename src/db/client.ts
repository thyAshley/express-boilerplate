import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { appConfig } from "../config/appConfig.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

export const pool = new Pool({
  host: appConfig.database.host,
  port: appConfig.database.port,
  database: appConfig.database.name,
  user: appConfig.database.user,
  password: appConfig.database.password,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle Postgres client");
});
export const db = drizzle({ client: pool, schema });

export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
  logger.info("Pinged the database successfully");
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
