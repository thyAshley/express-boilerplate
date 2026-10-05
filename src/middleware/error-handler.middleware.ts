import type { NextFunction, Request, Response } from "express";

type THttpError = Error & { status?: number; statusCode?: number; expose?: boolean };

// Must be registered after all routes. Responds with JSON instead of Express's HTML page (which includes the stack outside production)
export function errorHandler(err: THttpError, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500) {
    // pino-http only logs the error and stack trace when it is attached here
    res.err = err;
  }

  // http-errors (e.g. from express.json) marks client-safe messages with `expose`
  const message = status < 500 && err.expose ? err.message : "Internal Server Error";

  res.status(status).json({ error: message, requestId: req.id });
}
