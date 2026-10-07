import type { NextFunction, Request, Response } from "express";

type THttpError = Error & { status?: number; statusCode?: number; expose?: boolean };

export function errorHandlingMiddleware(
  err: THttpError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500) {
    res.err = err;
  }

  const message = status < 500 && err.expose ? err.message : "Internal Server Error";

  res.status(status).json({ error: message, requestId: req.id });
}
