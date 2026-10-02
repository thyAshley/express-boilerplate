import { pino } from "pino";
import { appConfig } from "../config/appConfig.js";

export const logger = pino({
  level: appConfig.server.logLevel,
  ...(appConfig.environmnent === "development" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});
