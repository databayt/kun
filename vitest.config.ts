import path from "node:path";
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
