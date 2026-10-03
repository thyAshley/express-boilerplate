import { createHealthController } from "./health.controller.js";
import { createHealthRouter } from "./health.routes.js";
import { createHealthService } from "./health.service.js";

export const healthRouter = createHealthRouter(createHealthController(createHealthService()));
