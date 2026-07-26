import path from "node:path";
// Load .env so DB-backed tests can find DATABASE_URL; they skip without it.
import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
