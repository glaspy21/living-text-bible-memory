import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/server/db/generated/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/livingtext_test";

// Refuse to run against anything that isn't clearly a test database.
if (!new URL(TEST_DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
}

export function testClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
}
