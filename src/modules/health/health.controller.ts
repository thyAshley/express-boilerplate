import type { Request, Response } from "express";
import type { THealthService } from "./health.service.js";

export const createHealthController = (healthService: THealthService) => ({
  getSystemStatus: async (_req: Request, res: Response) => {
    res.json(await healthService.getSystemStatus());
  },
});

export type THealthController = ReturnType<typeof createHealthController>;
