import { defineConfig } from "drizzle-kit";
import { appConfig } from "./src/config/app.config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  migrations: {
    schema: "",
  },
  introspect: {
    casing: "camel",
  },
  dbCredentials: {
    host: "localhost",
    port: appConfig.database.port,
    database: appConfig.database.name,
    user: appConfig.database.user,
    password: appConfig.database.password,
    ssl:
      appConfig.environment === "local"
        ? false
        : {
            rejectUnauthorized: true,
          },
  },
});
