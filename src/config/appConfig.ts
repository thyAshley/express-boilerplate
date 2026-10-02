import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres"),
  POSTGRES_DB: z.string().default("app"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // biome-ignore lint/suspicious/noConsole: logger depends on env, so it cannot be used here
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const appConfig = {
  ...parsed.data,
  database: {
    host: "localhost",
    port: parsed.data.POSTGRES_PORT,
    name: parsed.data.POSTGRES_DB,
    user: parsed.data.POSTGRES_USER,
    password: parsed.data.POSTGRES_PASSWORD,
  },
};

export type TAppConfig = typeof appConfig;
