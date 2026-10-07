import { getDBStatus } from "../../db/client.js";
import { createServiceLogger } from "../../utils/logger.js";

const healthServiceLogger = createServiceLogger("HealthService");

export const createHealthService = () => ({
  getSystemStatus: async () => {
    const memory = process.memoryUsage();
    const isDbHealthy = await getDBStatus().catch(() => false);
    healthServiceLogger.debug("Getting system status");
    return {
      status: isDbHealthy ? ("ok" as const) : ("unready" as const),
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      services: {
        database: isDbHealthy ? "healthy" : "unhealthy",
      },
      system: {
        memoryHeapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        nodeVersion: process.version,
      },
    };
  },
});

export type THealthService = ReturnType<typeof createHealthService>;
