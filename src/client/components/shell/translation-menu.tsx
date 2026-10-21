"use client";

import { useRef, useState, useTransition } from "react";
import { TRANSLATIONS } from "@/shared/scripture/translations";
import type { TranslationCode } from "@/shared/scripture/types";
import { cn } from "@/client/lib/cn";

const label = "shell-esv font-serif text-lg text-text max-[520px]:text-base";

/**
 * The header's translation badge. With only one translation on offer it is a plain label;
 * otherwise it opens a small menu. Choosing remembers the translation and refreshes the page.
 */
export function TranslationMenu({
  current,
  available,
  onChoose,
}: {
  current: TranslationCode;
  available: readonly TranslationCode[];
  onChoose: (code: TranslationCode) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);

  if (available.length < 2) {
    return (
      <span className={label} aria-label={`Translation: ${TRANSLATIONS[current].name}`}>
        {TRANSLATIONS[current].label}
      </span>
    );
  }

  const choose = (code: TranslationCode) => {
    setOpen(false);
    if (code !== current) startTransition(() => onChoose(code));
  };

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Translation: ${TRANSLATIONS[current].name}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(label, "flex items-center gap-1", pending && "opacity-60")}
      >
        {TRANSLATIONS[current].label} <small className="text-[10px] text-gold">▾</small>
      </button>
      {open && (
        <div
          role="menu"
          className="popin absolute top-[calc(100%+10px)] right-0 z-50 w-[220px] rounded-[10px] border border-line2 bg-[#0c0c0c] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,.75)]"
        >
          {available.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={code === current}
              onClick={() => choose(code)}
              className="flex w-full items-center gap-3 rounded-md p-2.5 text-left text-text hover:bg-[rgba(201,164,92,.08)]"
            >
              <span>
                {TRANSLATIONS[code].label}
                <small className="block text-[11px] text-muted">{TRANSLATIONS[code].name}</small>
              </span>
              {code === current && (
                <span className="ml-auto text-base text-gold" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
