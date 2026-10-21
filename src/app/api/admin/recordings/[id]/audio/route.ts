import { z } from "zod";
import { MAX_PEAK_BUCKETS } from "@/shared/audio/peaks";
import { getAdminEmail, rejectUnlessAdmin } from "@/server/auth/require-admin";
import { replaceRecordingAudio } from "@/server/library";

const Body = z.object({
  key: z.string().max(200),
  peaks: z.array(z.number()).max(MAX_PEAK_BUCKETS).optional(),
});

/**
 * Replace a recording's audio with a verified upload. Admin only. The old audio is kept, and the
 * new audio gets a new timing draft seeded from the old boundaries; a published recording keeps
 * playing what it plays until that draft is published.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/audio">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  let parsed;
  try {
    parsed = Body.safeParse(await request.json());
  } catch {
    return Response.json({ errors: ["That request could not be read."] }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ errors: ["The upload is missing or invalid."] }, { status: 400 });
  }

  const { id } = await context.params;
  const email = (await getAdminEmail())!;
  const result = await replaceRecordingAudio(id, parsed.data.key, email, parsed.data.peaks);
  if (!result.ok) return Response.json({ errors: result.errors }, { status: result.status });
  return Response.json({ id: result.id }, { status: 200 });
}
