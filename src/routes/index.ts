import { Router } from "express";
import { healthRouter } from "../modules/health/index.js";
import { ROUTES } from "./routes.constants.js";

export const router = Router();

router.use(ROUTES.health.getSystemStatus, healthRouter);
