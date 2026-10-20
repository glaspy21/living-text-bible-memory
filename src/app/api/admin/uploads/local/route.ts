import { rejectUnlessAdmin } from "@/server/auth/require-admin";
import { getStorage } from "@/server/storage";
import { LocalStorageDriver } from "@/server/storage/local";

/** Receives the file in local development (production uploads go straight to R2). Admin only. */
export async function PUT(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const storage = getStorage();
  if (!(storage instanceof LocalStorageDriver)) return new Response("Not found", { status: 404 });

  const token = new URL(request.url).searchParams.get("token");
  const grant = token ? storage.readGrant(token) : null;
  if (!grant) return Response.json({ error: "Upload link expired or invalid." }, { status: 403 });
  if (request.headers.get("content-type") !== grant.mime) {
    return Response.json({ error: "Wrong content type." }, { status: 415 });
  }
  if (!request.body) return Response.json({ error: "No file received." }, { status: 400 });

  try {
    await storage.write(grant.key, request.body, grant.bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json(
      { error: message },
      { status: message.includes("already exists") ? 409 : 422 },
    );
  }
  return new Response(null, { status: 204 });
}
