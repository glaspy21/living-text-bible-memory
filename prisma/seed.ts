// Run with `npx prisma db seed` (also runs after `prisma migrate reset`).
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "../src/server/db/generated/client";
import { seed } from "./seed-data";

config({ path: ".env.local", quiet: true });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

seed(prisma)
  .then(async () => {
    const [books, genres, translations] = await Promise.all([
      prisma.book.count(),
      prisma.genre.count(),
      prisma.translation.count(),
    ]);
    console.log(`Seeded ${books} books, ${genres} genres, ${translations} translations.`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
