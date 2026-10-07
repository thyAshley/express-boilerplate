import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { ROUTES } from "../routes/routes.constants.js";
import { logger as defaultLogger, runWithRequestLogContext } from "../utils/logger.js";

const REQUEST_ID_HEADER = "x-request-id";

// Inbound IDs are echoed back and written to every log line, so only accept short, plain values
const REQUEST_ID_PATTERN = /^[\w\-.:]{1,128}$/;

// Probes hit these constantly, so successes log at debug (hidden at the usual production level of info)
const QUIET_PATHS = new Set([`/api${ROUTES.health.getSystemStatus}`]);

// Path only: query strings can carry tokens, reset codes, etc.
function getRequestPath(req: IncomingMessage & { originalUrl?: string }) {
  const url = req.originalUrl ?? req.url ?? "/";
  const queryIndex = url.indexOf("?");
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function resolveRequestId(headerValue: string | string[] | undefined) {
  const candidate = typeof headerValue === "string" ? headerValue.trim() : undefined;
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function requestLoggerMiddleware(logger: Logger = defaultLogger) {
  const httpLogger = pinoHttp({
    logger,

    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    // In-handler `req.log` lines only carry reqId (via the mixin); the full req object is logged once on completion
    quietReqLogger: true,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) {
        return "error";
      }
      if (res.statusCode >= 400) {
        return "warn";
      }
      if (QUIET_PATHS.has(getRequestPath(req))) {
        return "debug";
      }
      return "info";
    },
    serializers: {
      req: (req) => {
        const raw = req.raw as Request;
        return {
          method: req.method,
          path: getRequestPath(raw),
          ip: raw.ip,
          userAgent: req.headers["user-agent"],
        };
      },
      res: (res) => ({
        statusCode: res.statusCode,
        contentLength: res.headers["content-length"],
      }),
    },
    customSuccessMessage: (req, res) => `${req.method} ${getRequestPath(req)} [${res.statusCode}]`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${getRequestPath(req)} failed [${res.statusCode}]: ${err.message}`,
  });

  // pino-http assigns req.id; the context makes it available to any logger call made during the request
  const requestLogContext = (req: Request, _res: Response, next: NextFunction) => {
    runWithRequestLogContext({ reqId: String(req.id) }, next);
  };

  // Order matters, so they are only exposed as a pair
  return [httpLogger, requestLogContext];
}
