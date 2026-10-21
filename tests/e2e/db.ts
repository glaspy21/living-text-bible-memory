import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/livingtext_test";

/** Plain SQL access to the test database for e2e setup (Playwright can't load the Prisma client). */
export class TestDb {
  private pool?: Pool;
  private readonly email = `e2e-${randomUUID()}@example.test`;

  /** Connects on first use, so runs that skip these tests never open a connection. */
  private get connection(): Pool {
    return (this.pool ??= new Pool({ connectionString: TEST_DATABASE_URL }));
  }

  /**
   * A recording whose original audio is the file stored under `storageKey`. Covers John 1:1–18
   * unless `passage` says otherwise (`bookId` is the canonical 1–66 number).
   */
  async addRecording(
    storageKey: string,
    bytes: number,
    status: "DRAFT" | "PUBLISHED",
    passage: { bookId: number; chapter: number; verseEnd: number } = {
      bookId: 43,
      chapter: 1,
      verseEnd: 18,
    },
  ) {
    const q = (text: string, values: unknown[] = []) => this.connection.query(text, values);
    const one = async (text: string, values: unknown[] = []) => (await q(text, values)).rows[0].id;

    const translationId = await one(`SELECT id FROM "Translation" WHERE code = 'WEB'`);
    const genreId = await one(`SELECT id FROM "Genre" WHERE slug = 'pop'`);
    const userId = await one(
      `INSERT INTO "User" (id, email, role) VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [randomUUID(), this.email],
    );
    const assetId = await one(
      `INSERT INTO "AudioAsset" (id, "storageKey", mime, bytes, "durationMs", sha256)
       VALUES ($1, $2, 'audio/mpeg', $3, 1000, 'x') RETURNING id`,
      [randomUUID(), storageKey, bytes],
    );
    await q(
      `INSERT INTO "Recording"
         (id, "translationId", "bookId", chapter, "verseStart", "endChapter", "verseEnd", "genreId",
          "arrangementNo", status, "originalAssetId", "createdById", "updatedAt")
       VALUES ($1, $2, $7, $8, 1, $8, $9, $3, 1, $4::"RecordingStatus", $5, $6, now())`,
      [
        randomUUID(),
        translationId,
        genreId,
        status,
        assetId,
        userId,
        passage.bookId,
        passage.chapter,
        passage.verseEnd,
      ],
    );
    return assetId as string;
  }

  /**
   * A published recording with published verse timings, for playback tests. `verses` are the
   * boundaries within the audio; `genre` is a genre slug ("pop", "rock", "rnb").
   */
  async addPlayableRecording(opts: {
    storageKey: string;
    mime: string;
    bytes: number;
    durationMs: number;
    bookId: number;
    chapter: number;
    verses: { verse: number; startMs: number; endMs: number }[];
    genre?: string;
    arrangementNo?: number;
  }) {
    const q = (text: string, values: unknown[] = []) => this.connection.query(text, values);
    const one = async (text: string, values: unknown[] = []) => (await q(text, values)).rows[0].id;
    const translationId = await one(`SELECT id FROM "Translation" WHERE code = 'WEB'`);
    const genreId = await one(`SELECT id FROM "Genre" WHERE slug = $1`, [opts.genre ?? "pop"]);
    const userId = await one(
      `INSERT INTO "User" (id, email, role) VALUES ($1, $2, 'ADMIN')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`,
      [randomUUID(), this.email],
    );
    const assetId = await one(
      `INSERT INTO "AudioAsset" (id, "storageKey", mime, bytes, "durationMs", sha256)
       VALUES ($1, $2, $3, $4, $5, 'x') RETURNING id`,
      [randomUUID(), opts.storageKey, opts.mime, opts.bytes, opts.durationMs],
    );
    const recordingId = randomUUID();
    const last = opts.verses[opts.verses.length - 1].verse;
    await q(
      `INSERT INTO "Recording"
         (id, "translationId", "bookId", chapter, "verseStart", "endChapter", "verseEnd", "genreId",
          "arrangementNo", status, "originalAssetId", "createdById", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $4, $6, $7, $8, 'PUBLISHED', $9, $10, now())`,
      [
        recordingId,
        translationId,
        opts.bookId,
        opts.chapter,
        opts.verses[0].verse,
        last,
        genreId,
        opts.arrangementNo ?? 1,
        assetId,
        userId,
      ],
    );
    const timingId = randomUUID();
    await q(
      `INSERT INTO "TimingSet" (id, "recordingId", version, state, "createdById")
       VALUES ($1, $2, 1, 'PUBLISHED', $3)`,
      [timingId, recordingId, userId],
    );
    for (const v of opts.verses) {
      await q(
        `INSERT INTO "VerseTiming" (id, "timingSetId", chapter, verse, "startMs", "endMs")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), timingId, opts.chapter, v.verse, v.startMs, v.endMs],
      );
    }
    await q(`UPDATE "Recording" SET "publishedTimingId" = $1 WHERE id = $2`, [
      timingId,
      recordingId,
    ]);
    return { assetId: assetId as string, recordingId };
  }

  /**
   * Remove the recordings an admin created through the app itself (their rows, timing sheets and
   * audio assets). Use for the shared e2e admin account.
   */
  async removeRecordingsCreatedBy(email: string) {
    const q = (text: string) => this.connection.query(text, [email]);
    await q(`UPDATE "Recording" SET "publishedTimingId" = NULL
             WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)`);
    await q(
      `DELETE FROM "TimingSet" WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)`,
    );
    await q(`WITH r AS (DELETE FROM "Recording"
                        WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)
                        RETURNING "originalAssetId")
             DELETE FROM "AudioAsset" WHERE id IN (SELECT "originalAssetId" FROM r)`);
  }

  /** The audio asset id of the newest recording an admin created. */
  async assetIdOfNewestRecordingBy(email: string): Promise<string> {
    const result = await this.connection.query(
      `SELECT "originalAssetId" AS id FROM "Recording"
       WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)
       ORDER BY "createdAt" DESC LIMIT 1`,
      [email],
    );
    return result.rows[0].id;
  }

  /** The ids of the recordings this run created, keyed by canonical book number. */
  async findRecordingIds(bookIds: number[]): Promise<Record<number, string>> {
    const result = await this.connection.query(
      `SELECT id, "bookId" FROM "Recording"
       WHERE "bookId" = ANY($1::int[])
         AND "createdById" IN (SELECT id FROM "User" WHERE email = $2)`,
      [bookIds, this.email],
    );
    return Object.fromEntries(result.rows.map((r) => [r.bookId, r.id as string]));
  }

  /** The audio asset a recording currently points at (its newest upload). */
  async currentAssetId(recordingId: string): Promise<string> {
    const result = await this.connection.query(
      `SELECT "originalAssetId" AS id FROM "Recording" WHERE id = $1`,
      [recordingId],
    );
    return result.rows[0].id;
  }

  /** Remove everything this run created, then close the connection. Safe to call repeatedly. */
  async cleanup() {
    const pool = this.pool;
    if (!pool) return;
    this.pool = undefined;
    await pool.query(
      `UPDATE "Recording" SET "publishedTimingId" = NULL
       WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)`,
      [this.email],
    );
    // Timing sheets may have been added by another account (replacing audio), and may pin audio
    // that is no longer a recording's current file; remove those assets too.
    const mine = `SELECT id FROM "Recording"
                  WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)`;
    const sheets = await pool.query(
      `DELETE FROM "TimingSet" WHERE "recordingId" IN (${mine}) OR "createdById" IN
         (SELECT id FROM "User" WHERE email = $1) RETURNING "audioAssetId"`,
      [this.email],
    );
    const recordings = await pool.query(
      `DELETE FROM "Recording" WHERE "createdById" IN (SELECT id FROM "User" WHERE email = $1)
       RETURNING "originalAssetId"`,
      [this.email],
    );
    const assets = [
      ...sheets.rows.map((r) => r.audioAssetId),
      ...recordings.rows.map((r) => r.originalAssetId),
    ].filter(Boolean);
    await pool.query(`DELETE FROM "AudioAsset" WHERE id = ANY($1::text[])`, [assets]);
    await pool.query(`DELETE FROM "User" WHERE email = $1`, [this.email]);
    await pool.end();
  }
}
