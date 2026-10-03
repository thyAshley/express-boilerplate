import { Router } from "express";

import type { THealthController } from "./health.controller.js";

export const createHealthRouter = (healthController: THealthController) => {
  const router = Router();

  router.get("/", healthController.getSystemStatus);

  return router;
};
