// Prisma CLI settings (migrate, generate, seed). The app connects in src/server/db/client.ts.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Empty is fine for `prisma generate`, which needs no connection (e.g. in CI's install step).
    url: process.env.DATABASE_URL ?? "",
  },
});
