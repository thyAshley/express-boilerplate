import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { appConfig } from "./config/app.config.js";
import { router } from "./routes/index.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: appConfig.server.corsOrigin }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));

  app.use("/api", router);

  return app;
}
