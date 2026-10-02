import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import * as dbClient from "../src/db/client.js";

afterAll(async () => {
  await dbClient.closeDb();
});

describe("GET /api/health/ready", () => {
  it("returns 200 when the database is reachable", async () => {
    vi.spyOn(dbClient, "pingDb").mockResolvedValue();
    const res = await request(createApp()).get("/api/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "up" });
  });

  it("returns 503 when the database is unreachable", async () => {
    vi.spyOn(dbClient, "pingDb").mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await request(createApp()).get("/api/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "unavailable", db: "down" });
  });
});
