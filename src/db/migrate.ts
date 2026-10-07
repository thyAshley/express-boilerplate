import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../utils/logger.js";
import { closeDb, db } from "./client.js";

// Applies pending migrations from ./drizzle (relative to the working directory), then exits
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("Migrations applied");
} catch (err) {
  logger.fatal({ err }, "Migration failed");
  process.exitCode = 1;
} finally {
  await closeDb();
}
