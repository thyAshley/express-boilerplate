import { Router } from "express";
import { pingDb } from "../db/client.js";

export const healthRouter = Router();

// Liveness: the process is up
healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Readiness: dependencies are reachable
healthRouter.get("/ready", async (req, res) => {
  try {
    await pingDb();
    res.json({ status: "ok", db: "up" });
  } catch (err) {
    req.log.warn({ err }, "Readiness check failed");
    res.status(503).json({ status: "unavailable", db: "down" });
  }
});
