import { playableFor } from "@/server/library";
import { bookVerseCounts } from "@/server/scripture";
import { expandPassageAcrossBooks, splitByBook } from "@/shared/scripture/refs";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/**
 * What the player needs for a passage: its verses, and every published recording that touches it
 * with the published verse timings. Public (listeners play published music), nothing else.
 * Choosing a genre or arrangement happens in the browser, so switching needs no new request.
 */
export async function GET(request: Request) {
  const passage = parsePassageParam(new URL(request.url).searchParams.get("p"));
  if (!passage) return Response.json({ error: "Not a valid passage" }, { status: 400 });

  const slugs = splitByBook(passage).map((part) => part.book);
  const [countList, music] = await Promise.all([
    Promise.all(slugs.map((slug) => bookVerseCounts(slug))),
    playableFor(passage),
  ]);
  const counts = new Map(slugs.map((slug, i) => [slug, countList[i]]));
  return Response.json(
    { passage, verses: expandPassageAcrossBooks(passage, (b) => counts.get(b) ?? []), ...music },
    { headers: { "Cache-Control": "no-store" } },
  );
}
