// Database tests: run against a separate *_test database (`npm run test:db`).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
  },
});
