import type { Request, Response } from "express";
import type { THealthService } from "./health.service.js";

export const createHealthController = (healthService: THealthService) => ({
  getSystemStatus: async (_req: Request, res: Response) => {
    const systemStatus = await healthService.getSystemStatus();
    res.status(systemStatus.status === "ok" ? 200 : 503).json(systemStatus);
  },
});

export type THealthController = ReturnType<typeof createHealthController>;
