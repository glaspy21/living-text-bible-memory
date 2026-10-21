import "server-only";
import { cookies } from "next/headers";
import { isTranslationCode } from "@/shared/scripture/translations";
import type { TranslationCode } from "@/shared/scripture/types";
import { availableTranslations } from "./index";

export const TRANSLATION_COOKIE = "lt_translation";

/** The translation this visitor chose, if it is still offered; otherwise the WEB. */
export async function getPreferredTranslation(): Promise<TranslationCode> {
  const stored = (await cookies()).get(TRANSLATION_COOKIE)?.value;
  return isTranslationCode(stored) && availableTranslations().includes(stored) ? stored : "WEB";
}
