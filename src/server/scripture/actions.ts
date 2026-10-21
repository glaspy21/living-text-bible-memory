"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isTranslationCode } from "@/shared/scripture/translations";
import { availableTranslations } from "./index";
import { TRANSLATION_COOKIE } from "./preference";

/** Remember the visitor's translation and refresh the page. Unknown or unavailable codes are ignored. */
export async function setTranslation(code: string): Promise<void> {
  if (!isTranslationCode(code) || !availableTranslations().includes(code)) return;
  (await cookies()).set(TRANSLATION_COOKIE, code, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
