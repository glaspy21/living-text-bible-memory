import { rejectUnlessAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { getStorage } from "@/server/storage";

/** The waveform peaks stored for a recording's audio (the timing editor draws these). Admin only. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/peaks">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const asset = await db.recording.findUnique({
    where: { id },
    select: { originalAsset: { select: { peaksKey: true } } },
  });
  const key = asset?.originalAsset.peaksKey;
  if (!key) return new Response("Not found", { status: 404 });

  const storage = getStorage();
  const size = await storage.size(key);
  if (size === null) return new Response("Not found", { status: 404 });
  const bytes = await storage.readBytes(key, { start: 0, end: size - 1 });
  return new Response(bytes as BodyInit, {
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
