import { AsyncLocalStorage } from "node:async_hooks";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";
import pino, { type DestinationStream, type Logger } from "pino";
import { appConfig } from "../config/app.config.js";

const SERVICE_NAME = "express-boilerplate";

const LOGGER_FILE = fileURLToPath(import.meta.url);
// "    at SqsPoller.logInfo (/app/src/SqsPoller.ts:160:9)" or "    at /app/src/index.ts:3:1"
const STACK_FRAME_PATTERN = /^\s*at (?:(.+?) \()?(.+?):(\d+):\d+\)?$/;
// pino and pino-http frames sit between the caller and the logger
const PINO_FRAME_PATTERN = /[\\/]node_modules[\\/]pino/;

type TCreateLoggerOptions = {
  captureCaller?: boolean;
};

type TRequestLogContext = {
  reqId: string;
  userId?: string;
};

type TCaller = {
  file: string;
  function?: string;
  line: number;
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
  { captureCaller = true }: TCreateLoggerOptions = {},
): Logger {
  const usePrettyStream = appConfig.server.logFormat === "pretty" && !destination;

  return pino(
    {
      level: appConfig.server.logLevel,
      base: null,
      messageKey: "message",
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        level: (label) => ({ level: label }),
      },
      mixin() {
        const requestContext = requestLogContext.getStore();
        const caller = captureCaller ? getCaller() : undefined;
        return {
          context: {
            ...caller,
            ...(requestContext && { txid: requestContext.reqId }),
            ...(requestContext?.userId && { userId: requestContext.userId }),
          },
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

const LEVEL_COLORS: Record<string, Parameters<typeof styleText>[0]> = {
  fatal: "magenta",
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
  trace: "gray",
};

// Same record as the JSON output, indented for reading in a terminal
function createPrettyStream(): DestinationStream {
  return {
    write(line: string) {
      const { context, level, message, timestamp, ...rest } = JSON.parse(line);
      // Stacks are escaped onto one line in JSON; print them below the record instead
      const stack = typeof rest.err?.stack === "string" ? rest.err.stack : undefined;
      if (stack) {
        rest.err = { ...rest.err, stack: undefined };
      }
      const json = JSON.stringify({ context, level, message, timestamp, ...rest }, null, 4);
      const color = LEVEL_COLORS[level];
      const output = color
        ? json.replace(`"level": "${level}"`, (match) => styleText(color, match))
        : json;
      process.stdout.write(`${output}${stack ? `\n${styleText("red", stack)}` : ""}\n`);
    },
  };
}

// Names V8 gives to unnamed code: top-level module code ("<anonymous>"), callbacks bound to an object
const ANONYMOUS_CALLER_PATTERN = /<anonymous>|^(Timeout|Immediate)\./;

function getCaller(): TCaller | undefined {
  const frames = new Error().stack?.split("\n").slice(1) ?? [];
  for (const frame of frames) {
    const [, fnName, location, line] = STACK_FRAME_PATTERN.exec(frame) ?? [];
    if (!location || !line) {
      continue;
    }
    const file = location.startsWith("file://") ? fileURLToPath(location) : location;
    if (file === LOGGER_FILE || file.startsWith("node:") || PINO_FRAME_PATTERN.test(file)) {
      continue;
    }
    // V8 names object-literal methods "Object.fn" and prefixes awaited frames with "async "
    const name = fnName?.replace(/^async /, "").replace(/^Object\./, "");
    return {
      file,
      ...(name && !ANONYMOUS_CALLER_PATTERN.test(name) && { function: name }),
      line: Number(line),
    };
  }
  return undefined;
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
  return parent.child({}, { msgPrefix: fn ? `[${service}.${fn}] ` : `[${service}] ` });
}
