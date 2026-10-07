import { STATUS_CODES } from "node:http";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError, statusToCode } from "../utils/http-error.js";

export type TErrorResponseBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

export type TErrorMapper = (err: unknown) => HttpError | undefined;

export type TErrorHandlerOptions = {
  mappers?: TErrorMapper[];
};

type TStatusLikeError = Error & {
  status?: unknown;
  statusCode?: unknown;
  expose?: boolean;
  type?: string;
};

function isErrorStatus(status: unknown): status is number {
  return Number.isInteger(status) && (status as number) >= 400 && (status as number) <= 599;
}

export const mapHttpError: TErrorMapper = (err) => (err instanceof HttpError ? err : undefined);

export const mapZodError: TErrorMapper = (err) => {
  if (!(err instanceof ZodError)) {
    return undefined;
  }
  return new HttpError(400, "Request validation failed", {
    code: "VALIDATION_ERROR",
    details: err.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
      code: issue.code,
    })),
    cause: err,
  });
};

export const mapStatusError: TErrorMapper = (err) => {
  if (!(err instanceof Error)) {
    return undefined;
  }
  const { status, statusCode, expose, type } = err as TStatusLikeError;
  const resolvedStatus = [status, statusCode].find(isErrorStatus) ?? 500;
  return new HttpError(resolvedStatus, err.message, {
    // body-parser sets e.g. type "entity.parse.failed"; keep that as the code when present
    code: type ? type.toUpperCase().replace(/[^A-Z0-9]+/g, "_") : statusToCode(resolvedStatus),
    expose: expose ?? false,
    cause: err,
  });
};

export const defaultErrorMappers: readonly TErrorMapper[] = [
  mapHttpError,
  mapZodError,
  mapStatusError,
];

// Must be registered after all routes. Mappers run in order; the first to return an HttpError wins
export function createErrorHandlingMiddleware({
  mappers = [...defaultErrorMappers],
}: TErrorHandlerOptions = {}): ErrorRequestHandler {
  const toHttpError = (err: unknown) => {
    for (const map of mappers) {
      const httpError = map(err);
      if (httpError) {
        return httpError;
      }
    }
    // `throw "oops"` or a rejected non-Error: wrap it so the log still gets a stack trace
    return new HttpError(500, undefined, { cause: err });
  };

  return (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const httpError = toHttpError(err);

    // pino-http only logs the error and its stack when it is attached to res.err
    if (httpError.status >= 500) {
      res.err = err instanceof Error ? err : httpError;
    }

    if (httpError.headers) {
      res.set(httpError.headers);
    }

    const body: TErrorResponseBody = {
      success: false,
      error: {
        code: httpError.expose ? httpError.code : statusToCode(httpError.status),
        message: httpError.expose
          ? httpError.message
          : (STATUS_CODES[httpError.status] ?? "Internal Server Error"),
        ...(httpError.expose && httpError.details !== undefined && { details: httpError.details }),
        ...(req.id !== undefined && { requestId: String(req.id) }),
      },
    };

    res.status(httpError.status).json(body);
  };
}

export const errorHandlingMiddleware = createErrorHandlingMiddleware();
