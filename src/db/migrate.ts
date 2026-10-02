import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../utils/logger.js";
import { closeDb, db } from "./client.js";

try {
  await migrate(db, { migrationsFolder: "drizzle" });
  logger.info("Migrations applied");
} catch (err) {
  logger.error({ err }, "Migration failed");
  process.exitCode = 1;
} finally {
  await closeDb();
}
