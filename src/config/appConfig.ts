import { z } from "zod";

export function getAppConfig() {
  const configSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGIN: z.string().default("*"),
    POSTGRES_USER: z.string().default("postgres"),
    POSTGRES_PASSWORD: z.string().default("postgres"),
    POSTGRES_DB: z.string().default("app"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  });

  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    // to throw a error later
    // console.error("Invalid environment variables:", z.treeifyError(parsed.error));
    process.exit(1);
  }

  return Object.freeze({
    environmnent: parsed.data.NODE_ENV,
    server: {
      port: parsed.data.PORT,
      logLevel: parsed.data.LOG_LEVEL,
      corsOrigin: parsed.data.CORS_ORIGIN,
    },
    database: Object.freeze({
      host: "localhost",
      port: parsed.data.POSTGRES_PORT,
      name: parsed.data.POSTGRES_DB,
      user: parsed.data.POSTGRES_USER,
      password: parsed.data.POSTGRES_PASSWORD,
    }),
  });
}

export type TAppConfig = ReturnType<typeof getAppConfig>;

export const appConfig: TAppConfig = getAppConfig();
