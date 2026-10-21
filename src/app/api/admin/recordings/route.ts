import { z } from "zod";
import { MAX_PEAK_BUCKETS } from "@/shared/audio/peaks";
import { MAX_DESCRIPTION } from "@/shared/library/recording-input";
import { rejectUnlessAdmin, getAdminEmail } from "@/server/auth/require-admin";
import { createDraftRecording } from "@/server/library";

const Body = z.object({
  key: z.string().max(200),
  translation: z.string().max(10),
  book: z.string().max(40),
  chapter: z.number(),
  verseStart: z.number(),
  endChapter: z.number(),
  verseEnd: z.number(),
  genre: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("builtin"), slug: z.string().max(40) }),
    z.object({ kind: z.literal("custom"), name: z.string().max(200) }),
  ]),
  description: z
    .string()
    .max(MAX_DESCRIPTION * 2)
    .nullish(),
  peaks: z.array(z.number()).max(MAX_PEAK_BUCKETS).optional(),
});

/**
 * Save the metadata for an upload that has been verified: creates the draft recording and its
 * empty timing sheet. Admin only. Never replaces an existing recording.
 */
export async function POST(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  let parsed;
  try {
    parsed = Body.safeParse(await request.json());
  } catch {
    return Response.json({ errors: ["That request could not be read."] }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json(
      { errors: ["Some of the details are missing or invalid."] },
      { status: 400 },
    );
  }

  const { peaks, ...input } = parsed.data;
  const email = (await getAdminEmail())!;
  const result = await createDraftRecording(
    {
      ...input,
      translation: input.translation as "WEB" | "ESV",
      description: input.description ?? undefined,
    },
    email,
    peaks,
  );
  if (!result.ok) return Response.json({ errors: result.errors }, { status: result.status });
  return Response.json({ id: result.id }, { status: 201 });
}
