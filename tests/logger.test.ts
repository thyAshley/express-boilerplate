import { Writable } from "node:stream";
import express from "express";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import * as dbClient from "../src/db/client.js";
import { errorHandlingMiddleware } from "../src/middleware/error-handler.middleware.js";
import { requestLoggerMiddleware } from "../src/middleware/request-logger.middleware.js";
import {
  logger as appLogger,
  createLogger,
  createServiceLogger,
  runWithRequestLogContext,
} from "../src/utils/logger.js";

type TLogLine = Record<string, unknown> & {
  message?: string;
  level?: string;
  context?: Record<string, unknown>;
};

function captureLogs(options?: Parameters<typeof createLogger>[1]) {
  const lines: TLogLine[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of chunk.toString().split("\n").filter(Boolean)) {
        lines.push(JSON.parse(line));
      }
      callback();
    },
  });
  const logger = createLogger(destination, options);
  logger.level = "info";
  return { logger, lines };
}

function createTestApp() {
  const { logger, lines } = captureLogs();
  const app = express();
  app.use(
    requestLoggerMiddleware({
      logger,
      runInContext: (reqId, next) => runWithRequestLogContext({ reqId }, next),
    }),
  );
  app.get("/echo", (req, res) => {
    req.log.info("from req.log");
    res.json({ ok: true });
  });
  app.get("/boom", () => {
    throw new Error("kaboom");
  });
  app.use(errorHandlingMiddleware);
  return { app, lines };
}

const completionLine = (lines: TLogLine[]) => lines.find((line) => "responseTime" in line);

afterAll(async () => {
  await dbClient.closeDb();
});

describe("request logger", () => {
  it("echoes a valid inbound x-request-id and tags every log line with it", async () => {
    const { app, lines } = createTestApp();
    const res = await request(app).get("/echo").set("x-request-id", "abc-123");

    expect(res.headers["x-request-id"]).toBe("abc-123");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(line.context?.txid).toBe("abc-123");
    }
  });

  it("does not duplicate the request id key on in-handler logs", async () => {
    const { app, lines } = createTestApp();
    await request(app).get("/echo");

    const handlerLine = lines.find((line) => line.message === "from req.log");
    expect(handlerLine).toBeDefined();
    expect(Object.keys(handlerLine ?? {})).not.toContain("req");
  });

  it("replaces an invalid inbound x-request-id with a generated one", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/echo").set("x-request-id", "bad id\twith spaces");

    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("logs the path without the query string", async () => {
    const { app, lines } = createTestApp();
    await request(app).get("/echo?token=super-secret");

    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("super-secret");
    expect(completionLine(lines)).toMatchObject({
      level: "info",
      message: "GET /echo [200]",
      req: { method: "GET", path: "/echo" },
      res: { statusCode: 200 },
    });
  });

  it("logs thrown errors with their stack and returns a safe JSON body", async () => {
    const { app, lines } = createTestApp();
    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal Server Error",
    });

    const line = completionLine(lines);
    expect(line?.level).toBe("error");
    expect(line?.err).toMatchObject({
      message: "kaboom",
      stack: expect.stringContaining("kaboom"),
    });
  });

  it("exposes client-safe messages for 4xx errors such as malformed JSON", async () => {
    const res = await request(createApp({ logger: captureLogs().logger }))
      .post("/api/health")
      .set("content-type", "application/json")
      .send("{bad json");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "ENTITY_PARSE_FAILED",
      message: expect.any(String),
    });
    expect(res.body.error.message).not.toBe("Internal Server Error");
  });

  it("does not log successful health checks", async () => {
    vi.spyOn(dbClient, "getDBStatus").mockResolvedValue(true);
    const { logger, lines } = captureLogs();
    await request(createApp({ logger })).get("/api/health?probe=1");

    expect(completionLine(lines)).toBeUndefined();
  });

  it("still logs failing health checks", async () => {
    vi.spyOn(dbClient, "getDBStatus").mockRejectedValue(new Error("ECONNREFUSED"));
    const { logger, lines } = captureLogs();
    await request(createApp({ logger })).get("/api/health");

    expect(completionLine(lines)?.level).toMatch(/warn|error/);
  });
});

describe("logger", () => {
  it("respects LOG_LEVEL", () => {
    expect(appLogger.level).toBe("silent");
  });

  it("emits string levels, an ISO timestamp and the service name in context", () => {
    const { logger, lines } = captureLogs();
    logger.info("hello");

    expect(Object.keys(lines[0] ?? {}).sort()).toEqual([
      "context",
      "level",
      "message",
      "timestamp",
    ]);
    expect(lines[0]).toMatchObject({
      level: "info",
      message: "hello",
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      context: {},
    });
  });

  it("prefixes messages from a service logger", () => {
    const { logger, lines } = captureLogs();
    const serviceLogger = createServiceLogger("UserService", { parent: logger });
    serviceLogger.info({ userId: 1 }, "created user");

    expect(lines[0]).toMatchObject({
      message: "[UserService] created user",
      userId: 1,
    });
  });

  it("includes the method name when fn is given", () => {
    const { logger, lines } = captureLogs();
    createServiceLogger("UserService", { fn: "createUser", parent: logger }).info("created user");

    expect(lines[0]).toMatchObject({
      message: "[UserService.createUser] created user",
    });
  });

  it("adds the calling file, function and line to context when enabled", () => {
    const { logger, lines } = captureLogs({ captureCaller: true });
    const userService = {
      createUser() {
        logger.info("created user");
      },
    };
    userService.createUser();

    expect(lines[0]).toMatchObject({
      message: "created user",
      context: {
        file: expect.stringMatching(/tests[\\/]logger\.test\.ts$/),
        function: "createUser",
        line: expect.any(Number),
      },
    });
  });

  it("omits the function field when the caller is anonymous", () => {
    const { logger, lines } = captureLogs({ captureCaller: true });
    [1].forEach(() => {
      logger.info("from callback");
    });
    // Arrow callback invoked as an object's method: V8 reports it as "Server.<anonymous>"
    const server = { emit: (fn: () => void) => fn.call(server) };
    server.emit(function (this: unknown) {
      logger.info("from bound callback");
    });

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.context).not.toHaveProperty("function");
      expect(line.context).toHaveProperty("file");
    }
  });

  it("does not capture the caller when disabled", () => {
    const { logger, lines } = captureLogs({ captureCaller: false });
    const userService = {
      createUser() {
        logger.info("hello");
      },
    };
    userService.createUser();

    expect(lines[0]?.context).toEqual({});
  });

  it("redacts sensitive fields", () => {
    const { logger, lines } = captureLogs();
    logger.info({ user: { email: "a@b.c", password: "hunter2" } }, "login");

    expect(lines[0]).toMatchObject({ user: { email: "a@b.c", password: "[REDACTED]" } });
  });
});
