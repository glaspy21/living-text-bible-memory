import "server-only";
import { TRANSLATIONS } from "@/shared/scripture/translations";
import type { TranslationCode, Verse } from "@/shared/scripture/types";
import { getProvider } from "./index";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";

export type ReaderChapter = {
  /** The translation the verses are actually in (may differ from the one asked for). */
  translation: TranslationCode;
  verses: Verse[];
  /** Why the text is not in the translation the reader asked for, if so. */
  note: string | null;
};

type ProviderFor = (code: TranslationCode) => ScriptureProvider;

/**
 * A chapter for the reader in the preferred translation. When that translation can't supply it
 * (outside the ESV scope, or its service is down) the WEB is shown with a plain explanation, so
 * the reader is never blank. An unknown book or chapter still throws.
 */
export async function loadReaderChapter(
  book: string,
  chapter: number,
  preferred: TranslationCode,
  providerFor: ProviderFor = getProvider,
): Promise<ReaderChapter> {
  if (preferred !== "WEB") {
    try {
      const verses = await providerFor(preferred).getChapter(book, chapter);
      return { translation: preferred, verses, note: null };
    } catch (error) {
      if (!(error instanceof ScriptureUnavailableError) || error.reason === "not-found")
        throw error;
      const name = TRANSLATIONS[preferred].name;
      const note =
        error.reason === "out-of-scope"
          ? `The ${name} isn't available for this chapter yet, so the ${TRANSLATIONS.WEB.name} is shown.`
          : `The ${name} can't be reached right now, so the ${TRANSLATIONS.WEB.name} is shown.`;
      const verses = await providerFor("WEB").getChapter(book, chapter);
      return { translation: "WEB", verses, note };
    }
  }
  return {
    translation: "WEB",
    verses: await providerFor("WEB").getChapter(book, chapter),
    note: null,
  };
}
