import "server-only";
import { TRANSLATIONS } from "@/shared/scripture/translations";
import type { PassageRef, PassageVerse, TranslationCode, Verse } from "@/shared/scripture/types";
import { getProvider } from "./index";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";

export type ReaderChapter<V extends Verse = Verse> = {
  /** The translation the verses are actually in (may differ from the one asked for). */
  translation: TranslationCode;
  verses: V[];
  /** Why the text is not in the translation the reader asked for, if so. */
  note: string | null;
};

type ProviderFor = (code: TranslationCode) => ScriptureProvider;

/**
 * Text in the preferred translation. When that translation can't supply it (outside the ESV
 * scope, or its service is down) the WEB is shown with a plain explanation, so a screen is never
 * blank. An unknown book, chapter or passage still throws.
 */
async function withFallback<V extends Verse>(
  preferred: TranslationCode,
  providerFor: ProviderFor,
  read: (provider: ScriptureProvider) => Promise<V[]>,
  what: string,
): Promise<ReaderChapter<V>> {
  if (preferred !== "WEB") {
    try {
      return { translation: preferred, verses: await read(providerFor(preferred)), note: null };
    } catch (error) {
      if (!(error instanceof ScriptureUnavailableError) || error.reason === "not-found")
        throw error;
      const name = TRANSLATIONS[preferred].name;
      const web = TRANSLATIONS.WEB.name;
      const note =
        error.reason === "out-of-scope"
          ? `The ${name} isn't available for this ${what} yet, so the ${web} is shown.`
          : `The ${name} can't be reached right now, so the ${web} is shown.`;
      return { translation: "WEB", verses: await read(providerFor("WEB")), note };
    }
  }
  return { translation: "WEB", verses: await read(providerFor("WEB")), note: null };
}

/** A chapter for the reader. */
export function loadReaderChapter(
  book: string,
  chapter: number,
  preferred: TranslationCode,
  providerFor: ProviderFor = getProvider,
): Promise<ReaderChapter> {
  return withFallback(preferred, providerFor, (p) => p.getChapter(book, chapter), "chapter");
}

/**
 * A passage (possibly across chapters) for memorization. All of it comes from one translation:
 * if the preferred one can't supply every verse, the whole passage is the WEB, never a mixture.
 */
export function loadStudyPassage(
  ref: PassageRef,
  preferred: TranslationCode,
  providerFor: ProviderFor = getProvider,
): Promise<ReaderChapter<PassageVerse>> {
  return withFallback(preferred, providerFor, (p) => p.getPassage(ref), "passage");
}
