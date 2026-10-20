import { TRANSLATIONS } from "@/shared/scripture/translations";
import type { TranslationCode } from "@/shared/scripture/types";
import { cn } from "@/client/lib/cn";

/**
 * The copyright notice for the translation on screen. Render it wherever ESV text appears
 * (PROJECT.md §7); for WEB it states the public-domain status.
 */
export function Attribution({
  translation,
  className,
}: {
  translation: TranslationCode;
  className?: string;
}) {
  const info = TRANSLATIONS[translation];
  return (
    <p
      className={cn("text-[11px] leading-relaxed text-muted", className)}
      data-testid="scripture-attribution"
      data-translation={translation}
      lang="en"
    >
      {info.notice}
    </p>
  );
}
