import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // biome-ignore lint/suspicious/noConsole: logger depends on env, so it cannot be used here
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
