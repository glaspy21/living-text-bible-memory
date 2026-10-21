import { z } from "zod";
import type { TimingRow } from "./timing";

const ms = z
  .number()
  .int()
  .min(0)
  .max(24 * 3600 * 1000)
  .nullable();

/** What the timing editor sends to be saved: every verse's boundaries and acknowledgements. */
export const SaveBody = z.object({
  setId: z.string().min(1).max(64),
  rows: z
    .array(
      z.object({
        chapter: z.number().int().min(1).max(200),
        verse: z.number().int().min(1).max(200),
        startMs: ms,
        endMs: ms,
        ackGap: z.boolean(),
        ackOverlap: z.boolean(),
        note: z.string().max(500).nullish(),
      }),
    )
    .min(1)
    .max(1200),
});

export type SaveInput = z.infer<typeof SaveBody>;

/** The saved snapshot of an editing session: tolerant of anything it doesn't recognise. */
export function parseSnapshot(value: unknown): TimingRow[] | null {
  const parsed = z.object({ rows: SaveBody.shape.rows }).safeParse(value);
  return parsed.success ? parsed.data.rows.map((r) => ({ ...r, note: r.note ?? null })) : null;
}
