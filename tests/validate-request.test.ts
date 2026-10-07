import express from "express";
import request from "supertest";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { errorHandlingMiddleware } from "../src/middleware/error-handler.middleware.js";
import { requestLoggerMiddleware } from "../src/middleware/request-logger.middleware.js";
import { RequestValidationMiddleware } from "../src/middleware/validate-request.middleware.js";
import { createLogger } from "../src/utils/logger.js";

function createTestApp() {
  const app = express();
  app.use(requestLoggerMiddleware({ logger: createLogger() }));
  app.use(express.json());
  app.post(
    "/users/:id",
    RequestValidationMiddleware({
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: z.object({ notify: z.stringbool().default(false) }),
      body: z.object({ email: z.email(), name: z.string().trim().min(1) }),
    }),
    (req, res) => {
      expectTypeOf(req.params.id).toEqualTypeOf<number>();
      expectTypeOf(req.query.notify).toEqualTypeOf<boolean>();
      expectTypeOf(req.body.email).toEqualTypeOf<string>();
      res.json({ params: req.params, query: req.query, body: req.body });
    },
  );
  app.get(
    "/search",
    RequestValidationMiddleware({ query: z.object({ q: z.string() }) }),
    (req, res) => {
      expectTypeOf(req.query.q).toEqualTypeOf<string>();
      expectTypeOf(req.params).toEqualTypeOf<Record<string, string>>();
      res.json(req.query);
    },
  );
  app.use(errorHandlingMiddleware);
  return app;
}

describe("RequestValidationMiddleware", () => {
  it("replaces each part with its parsed value", async () => {
    const res = await request(createTestApp())
      .post("/users/42")
      .send({ email: "a@b.co", name: "  Ada  ", extra: "dropped" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id: 42 },
      query: { notify: false },
      body: { email: "a@b.co", name: "Ada" },
    });
  });

  it("parses the query string", async () => {
    const res = await request(createTestApp()).post("/users/1?notify=true").send({
      email: "a@b.co",
      name: "Ada",
    });

    expect(res.body.query).toEqual({ notify: true });
  });

  it("reports failures from every part in one 400, prefixed with the part", async () => {
    const res = await request(createTestApp())
      .post("/users/abc?notify=maybe")
      .send({ email: "nope" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
      "body.email",
      "body.name",
      "params.id",
      "query.notify",
    ]);
  });

  it("only validates the parts it is given", async () => {
    const res = await request(createTestApp()).get("/search?q=cats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ q: "cats" });
  });

  it("rejects a missing body when a body schema is given", async () => {
    const res = await request(createTestApp()).post("/users/1");

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: "body" })]);
  });
});
