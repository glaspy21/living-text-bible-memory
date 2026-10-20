import { getAdminEmail } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { getStorage } from "@/server/storage";
import { serveAudio } from "@/server/storage/serve";

/**
 * Plays a recording. Listeners can only reach audio whose recording is published; admins can
 * also reach drafts (for the timing editor and previews). Everything else looks like a 404.
 */
export async function GET(request: Request, context: RouteContext<"/api/audio/[assetId]">) {
  const { assetId } = await context.params;
  const asset = await db.audioAsset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, mime: true, recording: { select: { status: true } } },
  });
  if (!asset) return new Response("Not found", { status: 404 });

  const published = asset.recording?.status === "PUBLISHED";
  if (!published && !(await getAdminEmail())) return new Response("Not found", { status: 404 });

  return serveAudio(
    getStorage(),
    { key: asset.storageKey, mime: asset.mime },
    request.headers.get("range"),
    published ? "public, max-age=3600" : "private, no-store",
  );
}
