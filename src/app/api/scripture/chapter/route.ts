import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadReaderChapter } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { bookBySlug } from "@/shared/scripture/books";

/**
 * One chapter of text for the reader's continuous scrolling, in the visitor's translation (with
 * the same fallback to the WEB as the chapter page). Never cached: the ESV may not be stored.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const book = bookBySlug(params.get("book") ?? "");
  const chapter = Number(params.get("chapter"));
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapterCount) {
    return Response.json({ error: "Unknown chapter" }, { status: 400 });
  }
  try {
    const loaded = await loadReaderChapter(book.slug, chapter, await getPreferredTranslation());
    return Response.json(loaded, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const missing = error instanceof ScriptureUnavailableError && error.reason === "not-found";
    return Response.json(
      { error: missing ? "Not found" : "The text could not be loaded" },
      { status: missing ? 404 : 502 },
    );
  }
}
