import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { appConfig } from "./config/app.config.js";
import { errorHandlingMiddleware } from "./middleware/error-handler.middleware.js";
import { requestLoggerMiddleware } from "./middleware/request-logger.middleware.js";
import { router } from "./routes/index.js";

type TCreateAppOptions = {
  logger?: Logger;
};

export function createApp({ logger }: TCreateAppOptions = {}) {
  const app = express();

  app.use(requestLoggerMiddleware(logger));
  app.use(helmet());
  app.use(cors({ origin: appConfig.server.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", router);
  app.use(errorHandlingMiddleware);

  return app;
}
