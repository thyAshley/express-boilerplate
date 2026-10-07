import type { RequestHandler } from "express";
import { HttpError } from "../utils/http-error.js";

// Must be registered after all routes, and before the error handler
export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Cannot ${req.method} ${req.path}`, { code: "ROUTE_NOT_FOUND" }));
};
