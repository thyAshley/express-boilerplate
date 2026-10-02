import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../utils/HttpError.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: "Validation failed", code: "VALIDATION_ERROR", details: err.issues },
    });
    return;
  }

  // Errors raised by body-parser (e.g. malformed JSON) carry a status
  const status =
    err instanceof HttpError ? err.status : Number.isInteger(err?.status) ? err.status : 500;

  if (status >= 500) {
    req.log?.error({ err }, "Unhandled error");
  }

  res.status(status).json({
    error: {
      message:
        status >= 500 && env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
      code: err instanceof HttpError ? err.code : undefined,
      details: err instanceof HttpError ? err.details : undefined,
      stack: env.NODE_ENV === "production" ? undefined : err.stack,
    },
  });
};
