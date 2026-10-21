import { playableFor } from "@/server/library";
import { bookVerseCounts } from "@/server/scripture";
import { expandPassage } from "@/shared/scripture/refs";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/**
 * What the player needs for a passage: its verses, and every published recording that touches it
 * with the published verse timings. Public (listeners play published music), nothing else.
 * Choosing a genre or arrangement happens in the browser, so switching needs no new request.
 */
export async function GET(request: Request) {
  const passage = parsePassageParam(new URL(request.url).searchParams.get("p"));
  if (!passage) return Response.json({ error: "Not a valid passage" }, { status: 400 });

  const [counts, music] = await Promise.all([bookVerseCounts(passage.book), playableFor(passage)]);
  return Response.json(
    { passage, verses: expandPassage(passage, counts), ...music },
    { headers: { "Cache-Control": "no-store" } },
  );
}
