import { bookVerseCounts } from "@/server/scripture";
import { bookBySlug } from "@/shared/scripture/books";

/** How many verses each chapter of a book has (WEB numbering), for verse pickers and forms. */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("book") ?? "";
  const book = bookBySlug(slug);
  if (!book) return Response.json({ error: "Unknown book" }, { status: 400 });
  return Response.json(
    { book: book.slug, counts: await bookVerseCounts(book.slug) },
    { headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
