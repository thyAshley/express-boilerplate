import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    // Prevent state/mock leaks between tests
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // to set env for testing if any
    env: {
      NODE_ENV: "local",
      LOG_LEVEL: "silent",
    },
    // Code coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/tests/**",
        "dist/**",
        "drizzle/**",
        // Process entry points (listen / exit), exercised by running the app
        "src/server.ts",
        "src/db/migrate.ts",
      ],
    },
  },
});
