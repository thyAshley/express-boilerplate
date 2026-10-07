import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { appConfig } from "./config/app.config.js";
import { errorHandlingMiddleware } from "./middleware/error-handler.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware.js";
import { router } from "./routes/index.js";
import { ROUTES } from "./routes/routes.constants.js";
import { logger as appLogger, runWithRequestLogContext } from "./utils/logger.js";

type TCreateAppOptions = {
  logger?: Logger;
};

export function createApp({ logger = appLogger }: TCreateAppOptions = {}) {
  const app = express();

  app.use(
    requestLoggerMiddleware({
      logger,
      quietPaths: [`/api${ROUTES.health.getSystemStatus}`],
      runInContext: (reqId, next) => runWithRequestLogContext({ reqId }, next),
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: appConfig.server.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", router);
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);

  return app;
}
