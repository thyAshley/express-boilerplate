import { z } from "zod";

export type TLogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
export type TRunTimeEnvironment = "local" | "development" | "test" | "production";

export function getAppConfig() {
  const configSchema = z.object({
    NODE_ENV: z.enum(["local", "development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGIN: z.string().default("*"),
    POSTGRES_USER: z.string().default("postgres"),
    POSTGRES_PASSWORD: z.string().default("postgres"),
    POSTGRES_DB: z.string().default("app"),
    POSTGRES_HOST: z.string().default("localhost"),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
    DATABASE_SSL: z.stringbool().default(false),
  });

  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }

  return Object.freeze({
    environment: parsed.data.NODE_ENV,
    server: {
      port: parsed.data.PORT,
      logLevel: parsed.data.LOG_LEVEL,
      corsOrigin: parsed.data.CORS_ORIGIN,
    },
    database: Object.freeze({
      host: parsed.data.POSTGRES_HOST,
      port: parsed.data.POSTGRES_PORT,
      name: parsed.data.POSTGRES_DB,
      user: parsed.data.POSTGRES_USER,
      password: parsed.data.POSTGRES_PASSWORD,
      ssl: parsed.data.DATABASE_SSL,
    }),
  });
}

export type TAppConfig = ReturnType<typeof getAppConfig>;

export const appConfig: TAppConfig = getAppConfig();
