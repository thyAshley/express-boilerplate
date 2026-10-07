import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db/client.js";
import {
  createErrorHandlingMiddleware,
  defaultErrorMappers,
  errorHandlingMiddleware,
} from "../src/middleware/error-handler.middleware.js";
import { notFoundMiddleware } from "../src/middleware/not-found.middleware.js";
import { requestLoggerMiddleware } from "../src/middleware/request-logger.middleware.js";
import { HttpError } from "../src/utils/http-error.js";
import { createLogger } from "../src/utils/logger.js";

afterAll(async () => {
  await closeDb();
});

function appThrowing(err: unknown) {
  const app = express();
  app.use(requestLoggerMiddleware({ logger: createLogger() }));
  app.get("/fail", () => {
    throw err;
  });
  app.use(notFoundMiddleware);
  app.use(errorHandlingMiddleware);
  return app;
}

describe("error handler", () => {
  it("returns an HttpError's status, code, message and details", async () => {
    const err = HttpError.conflict("Email already registered", {
      code: "EMAIL_TAKEN",
      details: { field: "email" },
    });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: "EMAIL_TAKEN",
        message: "Email already registered",
        details: { field: "email" },
        requestId: res.headers["x-request-id"],
      },
    });
  });

  it("defaults the code and message from the status", async () => {
    const res = await request(appThrowing(HttpError.forbidden())).get("/fail");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "FORBIDDEN", message: "Forbidden" });
  });

  it("sets headers carried by the error", async () => {
    const err = HttpError.tooManyRequests(undefined, { headers: { "Retry-After": "30" } });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("30");
  });

  it("hides the message and details of 5xx errors", async () => {
    const err = HttpError.internal("db password is hunter2", { details: { secret: true } });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal Server Error",
      requestId: expect.any(String),
    });
  });

  it("hides a 4xx message explicitly marked as not exposed", async () => {
    const err = new HttpError(401, "token signature mismatch", { expose: false });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: "UNAUTHORIZED", message: "Unauthorized" });
  });

  it("can expose a deliberate 5xx message", async () => {
    const err = HttpError.serviceUnavailable("Down for maintenance", { expose: true });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe("Down for maintenance");
  });

  it("turns a ZodError into a 400 with field-level details", async () => {
    const result = z.object({ email: z.email(), age: z.number() }).safeParse({ email: "x" });
    const res = await request(appThrowing(result.error)).get("/fail");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: expect.arrayContaining([
        expect.objectContaining({ path: "email" }),
        expect.objectContaining({ path: "age" }),
      ]),
    });
  });

  it("hides the message of a plain 4xx Error unless it opts in with expose", async () => {
    const err = Object.assign(new Error("internal detail"), { status: 400 });
    const res = await request(appThrowing(err)).get("/fail");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "BAD_REQUEST", message: "Bad Request" });
  });

  it.each([
    ["a non-numeric status", { status: "oops" }],
    ["an out-of-range status", { status: 999 }],
    ["a 2xx status", { statusCode: 200 }],
  ])("falls back to 500 for %s", async (_label, fields) => {
    const res = await request(appThrowing(Object.assign(new Error("x"), fields))).get("/fail");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("handles thrown values that are not Errors", async () => {
    const res = await request(appThrowing("just a string")).get("/fail");

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe("Internal Server Error");
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(createApp({ logger: createLogger() })).get("/api/nope");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).toMatchObject({
      code: "ROUTE_NOT_FOUND",
      message: "Cannot GET /api/nope",
    });
  });
});

describe("custom error mappers", () => {
  class PaymentDeclinedError extends Error {}

  it("lets a custom mapper translate a domain error before the defaults run", async () => {
    const app = express();
    app.use(requestLoggerMiddleware({ logger: createLogger() }));
    app.get("/pay", () => {
      throw new PaymentDeclinedError("card declined");
    });
    app.use(
      createErrorHandlingMiddleware({
        mappers: [
          (err) =>
            err instanceof PaymentDeclinedError
              ? new HttpError(402, err.message, { code: "PAYMENT_DECLINED" })
              : undefined,
          ...defaultErrorMappers,
        ],
      }),
    );

    const res = await request(app).get("/pay");

    expect(res.status).toBe(402);
    expect(res.body.error).toMatchObject({ code: "PAYMENT_DECLINED", message: "card declined" });
  });
});

describe("request logger options", () => {
  it("honours a custom request ID header", async () => {
    const app = express();
    app.use(
      requestLoggerMiddleware({ logger: createLogger(), requestIdHeader: "X-Correlation-Id" }),
    );
    app.get("/", (_req, res) => {
      res.end();
    });

    const res = await request(app).get("/").set("x-correlation-id", "corr-1");

    expect(res.headers["x-correlation-id"]).toBe("corr-1");
  });

  it("keeps the base logger's redaction for in-request logs", async () => {
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = createLogger(destination);
    logger.level = "info";
    const app = express();
    app.use(requestLoggerMiddleware({ logger }));
    app.get("/", (req, res) => {
      req.log.info({ user: { password: "hunter2" } }, "login");
      res.end();
    });

    await request(app).get("/");

    expect(lines.join("")).not.toContain("hunter2");
  });
});
