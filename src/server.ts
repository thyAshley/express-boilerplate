import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDb, pingDb } from "./db/client.js";
import { logger } from "./utils/logger.js";

// Fail fast if the database is unreachable instead of serving requests that will error
try {
  await pingDb();
  logger.info("Database connected");
} catch (err) {
  logger.fatal({ err }, "Could not connect to the database");
  await closeDb();
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async (err) => {
    try {
      await closeDb();
    } catch (dbErr) {
      logger.error({ err: dbErr }, "Error closing database pool");
      process.exit(1);
    }
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
  // Force exit if connections don't close in time
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
