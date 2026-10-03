import { getDBStatus } from "../../db/client.js";

export const createHealthService = () => ({
  getSystemStatus: async () => {
    const memory = process.memoryUsage();
    const dbStatus = await getDBStatus();

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      services: {
        database: dbStatus ? "healthy" : "unhealthy",
      },
      system: {
        memoryHeapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        nodeVersion: process.version,
      },
    };
  },
});

export type THealthService = ReturnType<typeof createHealthService>;
