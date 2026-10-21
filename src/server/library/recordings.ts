import "server-only";
import { createHash } from "node:crypto";
import { mp3DurationMs, wavDurationMs, type ReadBytes } from "@/shared/audio/duration";
import { isValidPeaks } from "@/shared/audio/peaks";
import {
  canonicalMime,
  isOriginalAudioKey,
  peaksKeyFor,
  sniffAudioKind,
  SNIFF_BYTES,
} from "@/shared/audio/upload-rules";
import { checkRecordingInput, type RecordingInput } from "@/shared/library/recording-input";
import { bookBySlug } from "@/shared/scripture/books";
import { expandPassage } from "@/shared/scripture/refs";
import type { PrismaClient } from "@/server/db/generated/client";
import type { StorageDriver } from "@/server/storage/types";

export type CreateResult =
  { ok: true; id: string } | { ok: false; status: 400 | 404 | 409 | 422; errors: string[] };

const HASH_CHUNK = 4 * 1024 * 1024;

/** A lowercase, hyphenated version of a genre name, for its URL-safe slug. */
export function genreSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Turns a verified upload into a draft recording: reads the file's length, fingerprints it, saves
 * the audio asset, recording and an empty timing draft (one blank row per verse, ready for the
 * timing editor), and stores the waveform. A matching passage never replaces an existing
 * recording: it becomes another one, numbered "Default 2", "Default 3", …
 */
export function createRecordings(deps: {
  client: PrismaClient;
  storage: StorageDriver;
  /** Verse count of each chapter of a book (chapter n is index n - 1). */
  verseCounts: (bookSlug: string) => Promise<number[]>;
}) {
  const { client, storage } = deps;

  async function fingerprint(key: string, size: number): Promise<string> {
    const hash = createHash("sha256");
    for (let start = 0; start < size; start += HASH_CHUNK) {
      const end = Math.min(start + HASH_CHUNK, size) - 1;
      hash.update(await storage.readBytes(key, { start, end }));
    }
    return hash.digest("hex");
  }

  return {
    async createDraft(
      input: RecordingInput,
      adminEmail: string,
      peaks?: number[],
    ): Promise<CreateResult> {
      const book = bookBySlug(input.book);
      const counts = book ? await deps.verseCounts(book.slug) : [];
      const checked = checkRecordingInput(input, counts);
      if (!checked.ok) return { ok: false, status: 400, errors: checked.errors };
      const value = checked.value;

      if (!isOriginalAudioKey(value.key)) {
        return { ok: false, status: 400, errors: ["Unknown upload."] };
      }
      const size = await storage.size(value.key);
      if (size === null) {
        return { ok: false, status: 404, errors: ["The file has not arrived yet."] };
      }
      const head = await storage.readBytes(value.key, { start: 0, end: SNIFF_BYTES - 1 });
      const kind = sniffAudioKind(head);
      if (!kind) return { ok: false, status: 422, errors: ["That file is not a real MP3 or WAV."] };

      const read: ReadBytes = async (start, length) =>
        length <= 0 || start >= size
          ? new Uint8Array()
          : storage.readBytes(value.key, { start, end: Math.min(start + length, size) - 1 });
      const durationMs =
        kind === "wav" ? await wavDurationMs(read, size) : await mp3DurationMs(read, size);
      if (!durationMs || durationMs <= 0) {
        return {
          ok: false,
          status: 422,
          errors: ["We couldn't read the length of this recording. Try exporting it again."],
        };
      }
      const sha256 = await fingerprint(value.key, size);

      const book_ = book!;
      const verses = expandPassage(
        {
          book: book_.slug,
          start: { chapter: value.chapter, verse: value.verseStart },
          end: { chapter: value.endChapter, verse: value.verseEnd },
        },
        counts,
      );

      try {
        const recordingId = await client.$transaction(async (tx) => {
          const user = await tx.user.upsert({
            where: { email: adminEmail },
            update: {},
            create: { email: adminEmail, role: "ADMIN" },
          });
          const translation = await tx.translation.findUniqueOrThrow({
            where: { code: value.translation },
          });

          const genre =
            value.genre.kind === "builtin"
              ? await tx.genre.findUniqueOrThrow({ where: { slug: value.genre.slug } })
              : await (async () => {
                  const name = value.genre.kind === "custom" ? value.genre.name : "";
                  const slug = genreSlug(name);
                  return (
                    (await tx.genre.findFirst({
                      where: { OR: [{ slug }, { name: { equals: name, mode: "insensitive" } }] },
                    })) ?? (await tx.genre.create({ data: { slug, name, isCustom: true } }))
                  );
                })();

          const samePassage = await tx.recording.count({
            where: {
              translationId: translation.id,
              bookId: book_.id,
              chapter: value.chapter,
              verseStart: value.verseStart,
              endChapter: value.endChapter,
              verseEnd: value.verseEnd,
              genreId: genre.id,
            },
          });

          const asset = await tx.audioAsset.create({
            data: {
              storageKey: value.key,
              mime: canonicalMime(kind),
              bytes: size,
              durationMs,
              sha256,
            },
          });
          const recording = await tx.recording.create({
            data: {
              translationId: translation.id,
              bookId: book_.id,
              chapter: value.chapter,
              verseStart: value.verseStart,
              endChapter: value.endChapter,
              verseEnd: value.verseEnd,
              genreId: genre.id,
              title: "Default",
              arrangementNo: samePassage + 1,
              description: value.description,
              status: "DRAFT",
              originalAssetId: asset.id,
              createdById: user.id,
            },
          });
          await tx.timingSet.create({
            data: {
              recordingId: recording.id,
              version: 1,
              state: "DRAFT",
              createdById: user.id,
              verses: {
                create: verses.map((v) => ({ chapter: v.chapter, verse: v.verse })),
              },
            },
          });
          return recording.id;
        });

        if (peaks && isValidPeaks(peaks)) {
          // The waveform is a convenience: a failure to store it must not lose the recording.
          try {
            const peaksKey = peaksKeyFor(value.key);
            await storage.put(
              peaksKey,
              new TextEncoder().encode(JSON.stringify(peaks)),
              "application/json",
            );
            await client.audioAsset.update({
              where: { storageKey: value.key },
              data: { peaksKey },
            });
          } catch (error) {
            console.warn("Waveform peaks could not be stored:", error);
          }
        }
        return { ok: true, id: recordingId };
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
          return {
            ok: false,
            status: 409,
            errors: ["This upload is already attached to a recording."],
          };
        }
        throw error;
      }
    },
  };
}
