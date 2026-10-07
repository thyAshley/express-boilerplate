import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { hostname } from "node:os";
import { fileURLToPath } from "node:url";
import pino, { type DestinationStream, type Logger } from "pino";
import { appConfig } from "../config/app.config.js";

const SERVICE_NAME = "express-boilerplate";

const require = createRequire(import.meta.url);
const LOGGER_FILE = fileURLToPath(import.meta.url);
const NAMED_STACK_FRAME_PATTERN = /^\s*at (.+?) \(/;

type TCreateLoggerOptions = {
  captureCaller?: boolean;
};

type TRequestLogContext = {
  reqId: string;
  userId?: string;
};

const requestLogContext = new AsyncLocalStorage<TRequestLogContext>();

export function runWithRequestLogContext<T>(context: TRequestLogContext, callback: () => T) {
  return requestLogContext.run(context, callback);
}

export function getRequestLogContext() {
  return requestLogContext.getStore();
}

export function createLogger(
  destination?: DestinationStream,
  { captureCaller = appConfig.environment === "local" }: TCreateLoggerOptions = {},
): Logger {
  const usePrettyStream = appConfig.environment === "local" && !destination;

  return pino(
    {
      level: appConfig.server.logLevel,
      base: {
        pid: process.pid,
        hostname: hostname(),
        service: SERVICE_NAME,
        env: appConfig.environment,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      mixin() {
        const context = requestLogContext.getStore();
        const caller = captureCaller ? getCaller() : undefined;
        return {
          ...(caller && { function: caller }),
          ...(context && { reqId: context.reqId }),
          ...(context?.userId && { userId: context.userId }),
        };
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.password",
          "*.token",
          "*.accessToken",
          "*.refreshToken",
          "*.secret",
        ],
        censor: "[REDACTED]",
      },
    },
    destination ?? (usePrettyStream ? createPrettyStream() : undefined),
  );
}

function createPrettyStream(): DestinationStream {
  const pretty = require("pino-pretty") as typeof import("pino-pretty");
  return pretty({
    colorize: true,
    sync: true,
    translateTime: "SYS:HH:MM:ss",
    ignore: "pid,hostname,service,env",
  });
}

// Names V8 gives to unnamed code: top-level module code ("<anonymous>"), callbacks bound to an object
const ANONYMOUS_CALLER_PATTERN = /<anonymous>|^(Timeout|Immediate)\./;

function getCaller() {
  const frames = new Error().stack?.split("\n").slice(1) ?? [];
  const frame = frames.find(
    (line) =>
      !line.includes(LOGGER_FILE) && !line.includes("node_modules") && !line.includes("node:"),
  );
  const fnName = frame ? NAMED_STACK_FRAME_PATTERN.exec(frame)?.[1] : undefined;
  // V8 names object-literal methods "Object.fn" and prefixes awaited frames with "async "
  const name = fnName?.replace(/^async /, "").replace(/^Object\./, "");
  return name && !ANONYMOUS_CALLER_PATTERN.test(name) ? name : undefined;
}

export const logger = createLogger();

type TServiceLoggerOptions = {
  fn?: string;
  parent?: Logger;
};

export function createServiceLogger(
  service: string,
  { fn, parent = logger }: TServiceLoggerOptions = {},
): Logger {
  return parent.child(fn ? { component: service, fn } : { component: service }, {
    msgPrefix: fn ? `[${service}.${fn}] ` : `[${service}] `,
  });
}
