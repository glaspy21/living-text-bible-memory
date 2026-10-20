import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

// One client per process; dev hot reload would otherwise open a new pool on every edit.
const globalForDb = globalThis as unknown as { db?: PrismaClient };

export const db =
  globalForDb.db ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
