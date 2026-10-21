import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminLibrary } from "../../src/server/library/admin-library";
import { testClient } from "./test-db";

const prisma = testClient();
const library = createAdminLibrary(prisma);
const tag = `al${Date.now()}`;
let userId = "";

async function make(opts: {
  status: "DRAFT" | "READY" | "PUBLISHED";
  chapter: number;
  arrangementNo?: number;
  genre?: string;
  /** [start, end] per verse; null entries are untimed. */
  timing?: ([number, number] | null)[];
}) {
  const [translation, genre] = await Promise.all([
    prisma.translation.findUniqueOrThrow({ where: { code: "WEB" } }),
    prisma.genre.findUniqueOrThrow({ where: { slug: opts.genre ?? "pop" } }),
  ]);
  const asset = await prisma.audioAsset.create({
    data: {
      storageKey: `${tag}/${opts.chapter}-${opts.status}-${opts.arrangementNo ?? 1}-${opts.genre ?? "pop"}.mp3`,
      mime: "audio/mpeg",
      bytes: 1,
      durationMs: 61_000,
      sha256: "x",
    },
  });
  const recording = await prisma.recording.create({
    data: {
      translationId: translation.id,
      bookId: 31, // Obadiah: one chapter only, so other tests' data cannot overlap by chapter
      chapter: opts.chapter,
      verseStart: 1,
      endChapter: opts.chapter,
      verseEnd: 3,
      genreId: genre.id,
      arrangementNo: opts.arrangementNo ?? 1,
      status: opts.status,
      originalAssetId: asset.id,
      createdById: userId,
    },
  });
  const timing = opts.timing ?? [null, null, null];
  const set = await prisma.timingSet.create({
    data: {
      recordingId: recording.id,
      version: 1,
      state: opts.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      createdById: userId,
      verses: {
        create: timing.map((t, i) => ({
          chapter: opts.chapter,
          verse: i + 1,
          startMs: t?.[0] ?? null,
          endMs: t?.[1] ?? null,
        })),
      },
    },
  });
  if (opts.status === "PUBLISHED") {
    await prisma.recording.update({
      where: { id: recording.id },
      data: { publishedTimingId: set.id },
    });
  }
  return recording.id;
}

const mine = <T extends { id: string }>(rows: T[], ids: string[]) =>
  rows.filter((r) => ids.includes(r.id));

let ids: Record<string, string> = {};

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `${tag}@example.test`, role: "ADMIN" } })).id;
  ids = {
    untouched: await make({ status: "DRAFT", chapter: 1 }),
    halfway: await make({
      status: "DRAFT",
      chapter: 1,
      arrangementNo: 2,
      timing: [[0, 1], null, null],
    }),
    done: await make({
      status: "DRAFT",
      chapter: 1,
      genre: "rock",
      timing: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    }),
    ready: await make({
      status: "READY",
      chapter: 1,
      genre: "rnb",
      timing: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    }),
    published: await make({
      status: "PUBLISHED",
      chapter: 1,
      arrangementNo: 3,
      timing: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    }),
  };
  // A published recording with a newer draft waiting.
  const pending = ids.published;
  await prisma.timingSet.create({
    data: { recordingId: pending, version: 2, state: "DRAFT", createdById: userId },
  });
});

afterAll(async () => {
  const all = (await prisma.recording.findMany({ where: { createdById: userId } })).map(
    (r) => r.id,
  );
  await prisma.recording.updateMany({
    where: { id: { in: all } },
    data: { publishedTimingId: null },
  });
  await prisma.timingSet.deleteMany({ where: { recordingId: { in: all } } });
  await prisma.recording.deleteMany({ where: { id: { in: all } } });
  await prisma.audioAsset.deleteMany({ where: { storageKey: { startsWith: tag } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

const all = () => Object.values(ids);

describe("library list", () => {
  it("filters by status", async () => {
    expect(mine(await library.list("all"), all())).toHaveLength(5);
    expect(
      mine(await library.list("drafts"), all())
        .map((r) => r.id)
        .sort(),
    ).toEqual([ids.untouched, ids.halfway, ids.done].sort());
    expect(mine(await library.list("ready"), all()).map((r) => r.id)).toEqual([ids.ready]);
    expect(mine(await library.list("published"), all()).map((r) => r.id)).toEqual([ids.published]);
  });

  it("shows several recordings of the same passage and genre side by side", async () => {
    const pop = mine(await library.list("all"), all()).filter((r) => r.genreName === "Pop");
    expect(pop.map((r) => r.arrangementNo).sort()).toEqual([1, 2, 3]);
    expect(
      new Set(pop.map((r) => `${r.bookSlug} ${r.chapter}:${r.verseStart}-${r.verseEnd}`)).size,
    ).toBe(1);
  });

  it("reports timing progress and why each recording needs attention", async () => {
    const rows = mine(await library.list("all"), all());
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by(ids.untouched)).toMatchObject({
      progress: { timed: 0, total: 3 },
      attention: "Verse timing not started",
    });
    expect(by(ids.halfway)).toMatchObject({
      progress: { timed: 1, total: 3 },
      attention: "2 of 3 verses still untimed",
    });
    expect(by(ids.done).attention).toBe("Timing done — review and mark ready");
    expect(by(ids.ready).attention).toBeNull();
    expect(by(ids.published)).toMatchObject({
      hasPendingDraft: true,
      progress: { timed: 0, total: 0 },
      attention: "New draft waiting to be published",
    });
  });
});

describe("dashboard", () => {
  it("counts recordings by status and lists those needing attention", async () => {
    const before = await library.dashboard();
    expect(before.total).toBe(before.counts.DRAFT + before.counts.READY + before.counts.PUBLISHED);
    expect(before.counts.DRAFT).toBeGreaterThanOrEqual(3);
    expect(before.counts.READY).toBeGreaterThanOrEqual(1);
    expect(before.counts.PUBLISHED).toBeGreaterThanOrEqual(1);
    const attention = mine(before.needsAttention, all())
      .map((r) => r.id)
      .sort();
    expect(attention).toEqual([ids.untouched, ids.halfway, ids.done, ids.published].sort());
    expect(before.recent.length).toBeLessThanOrEqual(5);
  });
});
