import type { ErrorRequestHandler } from "express";

// Global Error Handler
export const errorHandlingMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const logLevel = statusCode >= 500 ? "error" : "warn";

  // Use Pino child logger attached to req
  req.log[logLevel]({ err }, err.message);

  res.status(statusCode).json({
    error: {
      message: err.message,
      code: err.code || "INTERNAL_SERVER_ERROR",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};