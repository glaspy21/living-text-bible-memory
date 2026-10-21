import { z } from "zod";
import { rejectUnlessAdmin } from "@/server/auth/require-admin";
import { timingEditor } from "@/server/timing";

/** Earlier editing sessions of a recording, newest first. Admin only. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/timing/sessions">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  return Response.json(
    { sessions: await timingEditor.sessions(id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Return to an earlier session: its boundaries replace the draft's. Admin only. */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/timing/sessions">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  const body = z
    .object({ sessionId: z.string().min(1).max(64) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Choose a session." }, { status: 400 });
  const { id } = await context.params;
  const result = await timingEditor.restore(id, body.data.sessionId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ savedAt: result.savedAt.toISOString() });
}
