import type { TranslationCode } from "./types";

/** Crossway's required notice, shown wherever ESV text appears (PROJECT.md §7). */
export const ESV_NOTICE =
  "The ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language. Used by permission. All rights reserved.";

export type TranslationInfo = {
  code: TranslationCode;
  name: string;
  /** Short label for the header badge. */
  label: string;
  /** The notice that must appear with the text. */
  notice: string;
};

export const TRANSLATIONS: Record<TranslationCode, TranslationInfo> = {
  WEB: {
    code: "WEB",
    name: "World English Bible",
    label: "WEB",
    notice: "The World English Bible is in the public domain.",
  },
  ESV: { code: "ESV", name: "English Standard Version", label: "ESV", notice: ESV_NOTICE },
};

export function isTranslationCode(value: unknown): value is TranslationCode {
  return value === "WEB" || value === "ESV";
}
