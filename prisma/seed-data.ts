// Reference data every environment needs. Safe to run repeatedly (upserts only).
import type { PrismaClient } from "../src/server/db/generated/client";
import { DEFAULT_GENRES } from "../src/shared/music/genres";
import { BOOKS } from "../src/shared/scripture/books";
import { ESV_NOTICE } from "../src/shared/scripture/translations";

const TRANSLATIONS = [
  { code: "WEB", name: "World English Bible", licenseNote: "Public domain.", providerKey: "web" },
  { code: "ESV", name: "English Standard Version", licenseNote: ESV_NOTICE, providerKey: "esv" },
];

export async function seed(prisma: PrismaClient) {
  for (const t of TRANSLATIONS) {
    await prisma.translation.upsert({ where: { code: t.code }, update: t, create: t });
  }
  for (const b of BOOKS) {
    await prisma.book.upsert({ where: { id: b.id }, update: b, create: b });
  }
  for (const g of DEFAULT_GENRES) {
    await prisma.genre.upsert({
      where: { slug: g.slug },
      update: { name: g.name },
      create: { ...g, isCustom: false },
    });
  }
}
