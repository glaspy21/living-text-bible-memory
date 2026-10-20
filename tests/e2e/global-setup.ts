import { execFileSync } from "node:child_process";

/** Bring the test database to the latest migration and load reference data (books, genres…). */
export default function setup() {
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/livingtext_test",
  };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "ignore" });
  execFileSync("npx", ["prisma", "db", "seed"], { env, stdio: "ignore" });
}
