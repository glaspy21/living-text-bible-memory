import "server-only";
import { validateTiming, type ValidationResult } from "@/shared/timing/validation";
import type { PrismaClient } from "@/server/db/generated/client";

export type StatusResult =
  | { ok: true; status: "DRAFT" | "READY" | "PUBLISHED" }
  | {
      ok: false;
      status: 404 | 409 | 422;
      error: string;
      validation?: ValidationResult;
    };

/**
 * The Draft → Ready for review → Published lifecycle. Validation is always re-run here, on the
 * server, against what is stored (never trusting the browser's idea of "valid"). Publishing is
 * one transaction: the draft sheet becomes the published one, the old published sheet is kept as
 * history, and listeners switch to the new sheet (and its audio) all at once. Nothing is deleted.
 */
export function createPublisher(client: PrismaClient) {
  async function draftFor(tx: Pick<PrismaClient, "timingSet">, recordingId: string) {
    return tx.timingSet.findFirst({
      where: { recordingId, state: "DRAFT" },
      orderBy: { version: "desc" },
      include: { verses: true, audioAsset: true },
    });
  }

  function validated(
    draft: NonNullable<Awaited<ReturnType<typeof draftFor>>>,
    fallbackDurationMs: number,
  ) {
    const rows = [...draft.verses]
      .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
      .map((v) => ({ ...v }));
    return validateTiming(rows, draft.audioAsset?.durationMs ?? fallbackDurationMs);
  }

  const invalid = (validation: ValidationResult): StatusResult => ({
    ok: false,
    status: 422,
    error: "The timing has problems to fix first.",
    validation,
  });

  return {
    /** Draft → Ready for review. Only a valid, fully acknowledged draft sheet can be marked. */
    async markReady(recordingId: string): Promise<StatusResult> {
      return client.$transaction(async (tx) => {
        const rec = await tx.recording.findUnique({
          where: { id: recordingId },
          include: { originalAsset: true },
        });
        if (!rec) return { ok: false, status: 404, error: "Recording not found." };
        if (rec.status === "PUBLISHED") {
          return {
            ok: false,
            status: 409,
            error: "This recording is published. Publish its new draft instead.",
          };
        }
        const draft = await draftFor(tx, recordingId);
        if (!draft) return { ok: false, status: 409, error: "There is no draft timing." };
        const validation = validated(draft, rec.originalAsset.durationMs);
        if (!validation.ok) return invalid(validation);
        await tx.recording.update({ where: { id: recordingId }, data: { status: "READY" } });
        return { ok: true, status: "READY" };
      });
    },

    /** Ready → Draft (to keep editing). A published recording is left alone. */
    async backToDraft(recordingId: string): Promise<StatusResult> {
      const rec = await client.recording.findUnique({ where: { id: recordingId } });
      if (!rec) return { ok: false, status: 404, error: "Recording not found." };
      if (rec.status === "PUBLISHED") return { ok: true, status: "PUBLISHED" };
      await client.recording.update({ where: { id: recordingId }, data: { status: "DRAFT" } });
      return { ok: true, status: "DRAFT" };
    },

    /**
     * Make the draft the live timing. A recording must be Ready first; one that is already
     * published may publish its new draft version directly (it has been reviewed before).
     */
    async publish(recordingId: string): Promise<StatusResult> {
      return client.$transaction(async (tx) => {
        const rec = await tx.recording.findUnique({
          where: { id: recordingId },
          include: { originalAsset: true },
        });
        if (!rec) return { ok: false, status: 404, error: "Recording not found." };
        if (rec.status === "DRAFT") {
          return { ok: false, status: 409, error: "Mark the timing Ready for review first." };
        }
        const draft = await draftFor(tx, recordingId);
        if (!draft)
          return { ok: false, status: 409, error: "There is no draft timing to publish." };
        const validation = validated(draft, rec.originalAsset.durationMs);
        if (!validation.ok) return invalid(validation);

        if (rec.publishedTimingId && rec.publishedTimingId !== draft.id) {
          await tx.timingSet.update({
            where: { id: rec.publishedTimingId },
            data: { state: "ARCHIVED" },
          });
        }
        await tx.timingSet.update({ where: { id: draft.id }, data: { state: "PUBLISHED" } });
        await tx.recording.update({
          where: { id: recordingId },
          data: { status: "PUBLISHED", publishedTimingId: draft.id },
        });
        return { ok: true, status: "PUBLISHED" };
      });
    },
  };
}
