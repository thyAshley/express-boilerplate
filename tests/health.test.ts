import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import * as dbClient from "../src/db/client.js";

afterAll(async () => {
  await dbClient.closeDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("returns 200 when the database is reachable", async () => {
    vi.spyOn(dbClient, "getDBStatus").mockResolvedValue(true);
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      services: { database: "healthy" },
      system: { nodeVersion: process.version },
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
    expect(res.body.uptime).toMatch(/^\d+s$/);
    expect(res.body.system.memoryHeapUsed).toMatch(/^\d+MB$/);
  });

  it("returns 503 when the database is unreachable", async () => {
    vi.spyOn(dbClient, "getDBStatus").mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ status: "unready", services: { database: "unhealthy" } });
    expect(res.body.timestamp).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});
