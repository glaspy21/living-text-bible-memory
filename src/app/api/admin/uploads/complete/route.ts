import { z } from "zod";
import { rejectUnlessAdmin } from "@/server/auth/require-admin";
import { getStorage } from "@/server/storage";
import { completeUpload } from "@/server/storage/uploads";

const Body = z.object({ key: z.string().max(200), bytes: z.number().int().positive() });

/** Step 2: the browser finished uploading; check the file is what was declared. Admin only. */
export async function POST(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const result = await completeUpload(getStorage(), body.data);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}
