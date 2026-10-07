import { STATUS_CODES } from "node:http";

export type THttpErrorOptions = {
  code?: string;
  details?: unknown;
  expose?: boolean;
  headers?: Record<string, string>;
  cause?: unknown;
};

export function statusToCode(status: number) {
  return (STATUS_CODES[status] ?? "Error").toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;
  readonly headers?: Record<string, string>;

  constructor(status: number, message?: string, options: THttpErrorOptions = {}) {
    super(message ?? STATUS_CODES[status] ?? "Error", { cause: options.cause });
    this.name = "HttpError";
    this.status = status;
    this.code = options.code ?? statusToCode(status);
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
    this.headers = options.headers;
  }

  static badRequest(message?: string, options?: THttpErrorOptions) {
    return new HttpError(400, message, options);
  }

  static unauthorized(message?: string, options?: THttpErrorOptions) {
    return new HttpError(401, message, options);
  }

  static forbidden(message?: string, options?: THttpErrorOptions) {
    return new HttpError(403, message, options);
  }

  static notFound(message?: string, options?: THttpErrorOptions) {
    return new HttpError(404, message, options);
  }

  static conflict(message?: string, options?: THttpErrorOptions) {
    return new HttpError(409, message, options);
  }

  static unprocessable(message?: string, options?: THttpErrorOptions) {
    return new HttpError(422, message, options);
  }

  static tooManyRequests(message?: string, options?: THttpErrorOptions) {
    return new HttpError(429, message, options);
  }

  static internal(message?: string, options?: THttpErrorOptions) {
    return new HttpError(500, message, options);
  }

  static serviceUnavailable(message?: string, options?: THttpErrorOptions) {
    return new HttpError(503, message, options);
  }
}
