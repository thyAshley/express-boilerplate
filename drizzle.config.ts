import { defineConfig } from "drizzle-kit";
import { appConfig } from "./src/config/app.config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  introspect: {
    casing: "camel",
  },
  dbCredentials: {
    host: appConfig.database.host,
    port: appConfig.database.port,
    database: appConfig.database.name,
    user: appConfig.database.user,
    password: appConfig.database.password,
    // Same setting as the app's pool in src/db/client.ts
    ssl: appConfig.database.ssl && { rejectUnauthorized: true },
  },
});
