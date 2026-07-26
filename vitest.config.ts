import path from "node:path";
// Load .env so DB-backed tests can find DATABASE_URL; they skip without it.
import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The DB-backed tests round-trip to Neon in another region; the 5s
    // default is tight enough to make them flaky rather than meaningful.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
