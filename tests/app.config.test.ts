import { describe, expect, it, vi } from "vitest";
import { getAppConfig } from "../src/config/app.config.js";

describe("app config", () => {
  it("throws a readable error naming the invalid variable", () => {
    vi.stubEnv("PORT", "abc");

    expect(() => getAppConfig()).toThrow(/Invalid environment configuration:[\s\S]*PORT/);
  });

  it("disables database SSL by default", () => {
    vi.stubEnv("DATABASE_SSL", undefined);

    expect(getAppConfig().database.ssl).toBe(false);
  });

  it.each([
    ["true", true],
    ["1", true],
    ["false", false],
    ["0", false],
  ])("parses DATABASE_SSL=%s as %s", (value, expected) => {
    vi.stubEnv("DATABASE_SSL", value);

    expect(getAppConfig().database.ssl).toBe(expected);
  });

  it("rejects an unrecognised DATABASE_SSL value", () => {
    vi.stubEnv("DATABASE_SSL", "maybe");

    expect(() => getAppConfig()).toThrow(/DATABASE_SSL/);
  });
});
