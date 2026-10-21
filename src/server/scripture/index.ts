import "server-only";
import { bookBySlug } from "@/shared/scripture/books";
import type { TranslationCode } from "@/shared/scripture/types";
import { EsvProvider } from "./esv";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";
import { WebProvider } from "./web";

export type ScriptureEnv = Record<string, string | undefined>;

/**
 * ESV is behind a flag: it turns on only when ESV_ENABLED=true AND a key exists. The flag is the
 * owner's confirmation that Crossway's terms are met, so it is off until they say otherwise.
 */
export function esvEnabled(env: ScriptureEnv = process.env): boolean {
  return env.ESV_ENABLED === "true" && Boolean(env.ESV_API_KEY?.trim());
}

/** The translations that can be offered right now. WEB is always on. */
export function availableTranslations(env: ScriptureEnv = process.env): TranslationCode[] {
  return esvEnabled(env) ? ["WEB", "ESV"] : ["WEB"];
}

export function createProvider(
  code: TranslationCode,
  env: ScriptureEnv = process.env,
): ScriptureProvider {
  if (code === "WEB") return new WebProvider();
  if (code === "ESV" && esvEnabled(env))
    return new EsvProvider({ apiKey: env.ESV_API_KEY!.trim() });
  throw new ScriptureUnavailableError(`${code} is not available.`, "out-of-scope");
}

const providers = new Map<TranslationCode, ScriptureProvider>();

/** The app's provider for a translation, created once and reused (so caches are shared). */
export function getProvider(code: TranslationCode): ScriptureProvider {
  let provider = providers.get(code);
  if (!provider) {
    provider = createProvider(code);
    providers.set(code, provider);
  }
  return provider;
}

export { ScriptureUnavailableError } from "./types";
export type { ScriptureProvider } from "./types";

/**
 * How many verses each chapter of a book has (chapter n is index n - 1), for the verse grid.
 * Always the WEB's numbering: it is always available, and it differs from the ESV in only a
 * handful of verses.
 */
export async function bookVerseCounts(bookSlug: string): Promise<number[]> {
  const book = bookBySlug(bookSlug);
  if (!book) throw new ScriptureUnavailableError(`There is no book ${bookSlug}.`, "not-found");
  const web = getProvider("WEB");
  return Promise.all(
    Array.from({ length: book.chapterCount }, (_, i) => web.verseCount(book.slug, i + 1)),
  );
}
