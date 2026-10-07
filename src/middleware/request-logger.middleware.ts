import type { NextFunction, Request, RequestHandler, Response } from "express";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

export type TRequestLoggerOptions = {
  logger: Logger;
  // Paths whose successful requests log at debug instead of info, e.g. health checks
  quietPaths?: string[];
  requestIdHeader?: string;
  // Runs the rest of the request inside a context, e.g. AsyncLocalStorage so app logs carry reqId
  runInContext?: (requestId: string, next: () => void) => void;
};

const REQUEST_ID_PATTERN = /^[\w\-.:]{1,128}$/;

function getRequestPath(req: IncomingMessage & { originalUrl?: string }) {
  const [path = "/"] = (req.originalUrl ?? req.url ?? "/").split("?");
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function resolveRequestId(headerValue: string | string[] | undefined) {
  const candidate = typeof headerValue === "string" ? headerValue.trim() : undefined;
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export function requestLoggerMiddleware({
  logger,
  quietPaths = [],
  requestIdHeader = "x-request-id",
  runInContext,
}: TRequestLoggerOptions): RequestHandler[] {
  const quietPathSet = new Set(quietPaths);
  const headerName = requestIdHeader.toLowerCase();

  const httpLogger = pinoHttp({
    logger,
    genReqId: (req, res) => {
      const requestId = resolveRequestId(req.headers[headerName]);
      res.setHeader(headerName, requestId);
      return requestId;
    },
    // With a context hook the ID is attached by the logger itself, so don't also bind it per request
    quietReqLogger: !runInContext,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) {
        return "error";
      }
      if (res.statusCode >= 400) {
        return "warn";
      }
      return quietPathSet.has(getRequestPath(req)) ? "debug" : "info";
    },
    serializers: {
      req: (req) => req,
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    customSuccessMessage: (req, res) => `${req.method} ${getRequestPath(req)} [${res.statusCode}]`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${getRequestPath(req)} failed [${res.statusCode}]: ${err.message}`,
  });

  if (!runInContext) {
    return [httpLogger];
  }

  const requestContext = (req: Request, _res: Response, next: NextFunction) => {
    // Handler logs carry the ID from the context; drop the per-request `req` binding
    req.log = httpLogger.logger;
    runInContext(String(req.id), next);
  };

  return [httpLogger, requestContext];
}
