import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { appConfig } from "./config/app.config.js";
import { errorHandler } from "./middleware/error-handler.middleware.js";
import { createRequestLogger } from "./middleware/request-logger.middleware.js";
import { router } from "./routes/index.js";

type TCreateAppOptions = {
  logger?: Logger;
};

export function createApp({ logger }: TCreateAppOptions = {}) {
  const app = express();

  app.use(createRequestLogger(logger));
  app.use(helmet());
  app.use(cors({ origin: appConfig.server.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", router);

  app.use(errorHandler);

  return app;
}
