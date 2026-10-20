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

  /** A recording of John 1:1–18 whose original audio is the file stored under `storageKey`. */
  async addRecording(storageKey: string, bytes: number, status: "DRAFT" | "PUBLISHED") {
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
       VALUES ($1, $2, 43, 1, 1, 1, 18, $3, 1, $4::"RecordingStatus", $5, $6, now())`,
      [randomUUID(), translationId, genreId, status, assetId, userId],
    );
    return assetId as string;
  }

  /** Remove everything this run created, then close the connection. Safe to call repeatedly. */
  async cleanup() {
    const pool = this.pool;
    if (!pool) return;
    this.pool = undefined;
    await pool.query(
      `WITH u AS (SELECT id FROM "User" WHERE email = $1),
            r AS (DELETE FROM "Recording" WHERE "createdById" IN (SELECT id FROM u)
                  RETURNING "originalAssetId")
       DELETE FROM "AudioAsset" WHERE id IN (SELECT "originalAssetId" FROM r)`,
      [this.email],
    );
    await pool.query(`DELETE FROM "User" WHERE email = $1`, [this.email]);
    await pool.end();
  }
}
