import { z } from "zod";
import { rejectUnlessAdmin } from "@/server/auth/require-admin";
import { publisher } from "@/server/timing";

const Body = z.object({ action: z.enum(["ready", "draft", "publish"]) });

/**
 * Move a recording through Draft → Ready for review → Published. Admin only; validation runs
 * again on the server, so a problem sheet can't be marked Ready or published from anywhere.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/recordings/[id]/status">,
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Unknown action." }, { status: 400 });
  const { id } = await context.params;
  const run = {
    ready: publisher.markReady,
    draft: publisher.backToDraft,
    publish: publisher.publish,
  }[body.data.action];
  const result = await run(id);
  if (!result.ok) {
    return Response.json(
      { error: result.error, validation: result.validation },
      { status: result.status },
    );
  }
  return Response.json({ status: result.status });
}
