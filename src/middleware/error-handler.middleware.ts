import type { ErrorRequestHandler } from "express";
import { STATUS_CODES } from "node:http";
import { statusToCode } from "../utils/http-error.js";

function isErrorStatus(status: unknown): status is number {
  return Number.isInteger(status) && (status as number) >= 400 && (status as number) <= 599;
}

export const errorHandlingMiddleware: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = [err?.status, err?.statusCode].find(isErrorStatus) ?? 500;
  const expose = typeof err?.expose === "boolean" ? err.expose : false;

  if (statusCode >= 500) {
    res.err = err instanceof Error ? err : new Error(String(err));
  }

  if (err?.headers) {
    res.set(err.headers);
  }

  res.status(statusCode).json({
    error: {
      message: expose ? err.message : (STATUS_CODES[statusCode] ?? "Internal Server Error"),
      code:
        (expose && (err.code ?? err.type?.toUpperCase().replace(/[^A-Z0-9]+/g, "_"))) ||
        statusToCode(statusCode),
      ...(expose && err.details !== undefined && { details: err.details }),
      ...(process.env.NODE_ENV !== "production" && { stack: err?.stack }),
    },
  });
};
