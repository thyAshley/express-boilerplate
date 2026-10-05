import { createApp } from "./app.js";
import { appConfig } from "./config/app.config.js";
import { closeDb, getDBStatus } from "./db/client.js";
import { logger } from "./utils/logger.js";

// Fail fast if the database is unreachable instead of serving requests that will error
try {
  await getDBStatus();
  logger.info("Database connected");
} catch (err) {
  logger.fatal({ err }, "Could not connect to the database");
  await closeDb();
  process.exit(1);
}

const app = createApp();

const server = app.listen(appConfig.server.port, async (err) => {
  if (err) {
    logger.fatal({ err }, `Could not listen on port ${appConfig.server.port}`);
    await closeDb();
    process.exit(1);
  }
  logger.info(
    `Server listening on http://localhost:${appConfig.server.port} (${appConfig.environment})`,
  );
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
    if (err && (err as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") {
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
