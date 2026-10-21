import { getAdminEmail, rejectUnlessAdmin } from "@/server/auth/require-admin";
import { timingEditor } from "@/server/timing";
import { SaveBody } from "@/shared/timing/save-input";

/** The timing sheet the editor works on. Admin only. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/timing">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  const data = await timingEditor.load(id);
  if (!data) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

/** Autosave: store the boundaries in the draft sheet. Admin only. */
export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/timing">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  let parsed;
  try {
    parsed = SaveBody.safeParse(await request.json());
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }
  if (!parsed.success) return Response.json({ error: "The timing is invalid." }, { status: 400 });
  const { id } = await context.params;
  const result = await timingEditor.save(id, parsed.data.setId, parsed.data.rows);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ savedAt: result.savedAt.toISOString() });
}

/** Start a new draft version of a published recording's timing. Admin only. */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/timing">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  const { id } = await context.params;
  const result = await timingEditor.startDraft(id, (await getAdminEmail())!);
  if (!result.ok) {
    return Response.json({ error: "This recording has no published timing." }, { status: 409 });
  }
  return Response.json({ ok: true });
}
