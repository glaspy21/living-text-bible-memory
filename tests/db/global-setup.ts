import { execFileSync } from "node:child_process";
import { seed } from "../../prisma/seed-data";
import { TEST_DATABASE_URL, testClient } from "./test-db";

/** Bring the test database to the latest migration and load reference data. */
export default async function setup() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
  const prisma = testClient();
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
