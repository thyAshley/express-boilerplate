import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db/client.js";

afterAll(async () => {
  await closeDb();
});

describe("unknown routes", () => {
  it("returns a 404 with the method and path", async () => {
    const res = await request(createApp()).post("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      message: "Cannot POST /api/does-not-exist",
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("returns a 404 outside the /api prefix", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("does not echo the query string", async () => {
    const res = await request(createApp()).get("/api/does-not-exist?token=secret");

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });
});
