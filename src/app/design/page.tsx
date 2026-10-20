import { notFound } from "next/navigation";
import { Logo } from "@/client/components/brand/logo";
import { Bar } from "@/client/components/ui/bar";
import { Button } from "@/client/components/ui/button";
import { END_MODES, ICON_NAMES, Icon } from "@/client/components/ui/icons";
import { Sun } from "@/client/components/ui/sun";

export const metadata = { title: "Design reference" };

const COLORS = [
  ["bg", "#070707"],
  ["panel", "#121212"],
  ["gold-bright", "#edbf64"],
  ["gold", "#d0a34f"],
  ["gold-shade", "#ae8640"],
  ["gold2", "#e8cb8a"],
  ["gold-dim", "#8e6c34"],
  ["text", "#ece6d8"],
  ["muted", "#948c7a"],
  ["ok", "#8bb27a"],
  ["warn", "#d9a441"],
  ["err", "#d86a5a"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-gold-dim">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Development-only page for checking tokens and primitives against the prototype. */
export default function DesignReference() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <Sun />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-10 sm:px-11">
        <h1 className="mb-10 font-serif text-[34px] font-medium tracking-[0.02em] text-heading max-sm:text-2xl">
          Design reference
        </h1>

        <Section title="Logo">
          <div className="flex flex-wrap items-end gap-10">
            <Logo variant="mark" height={96} />
            <Logo variant="lockup" height={140} />
            <Logo variant="mark" tone="flat" height={64} className="text-[#c0955a]" />
          </div>
        </Section>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COLORS.map(([name, value]) => (
              <div key={name} className="text-xs text-muted">
                <div
                  className="mb-1 h-10 rounded-md border border-line"
                  style={{ background: value }}
                />
                {name}
                <br />
                {value}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <h1 className="font-serif text-[34px] font-medium text-heading max-sm:text-2xl">
            In the beginning
          </h1>
          <p className="mt-3 font-serif text-[22px] leading-[1.6] max-sm:text-[17.5px]">
            <span className="mr-3 text-[21px] text-gold">1</span>
            In the beginning was the Word, and the Word was with God, and the Word was God.
          </p>
          <p className="mt-3 text-[10.5px] uppercase tracking-[0.16em] text-gold-dim">
            Small caps label · Inter UI sans
          </p>
        </Section>

        <Section title="Bars (hover to see the gold wipe)">
          <div className="flex flex-col gap-4">
            <Bar icon="note" title="Continue" subtitle="John 1:1 · last: Sing" />
            <Bar icon="book" title="Browse Scripture" subtitle="Choose a book and chapter" />
            <Bar icon="list" title="Memorization Steps" subtitle="Listen, Sing, Recall, Chain" />
            <Bar icon="cards" title="Flashcards" subtitle="Practice in random order" />
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Memorize</Button>
            <Button variant="solid">Publish</Button>
            <Button variant="ghost">Exit admin</Button>
            <Button size="sm">Small</Button>
            <Button>
              <Icon name="shuffle" /> Shuffle
            </Button>
          </div>
        </Section>

        <Section title="End modes">
          <div className="flex gap-8 text-gold">
            {END_MODES.map((mode) => (
              <div key={mode.id} className="flex flex-col items-center gap-2 text-xs text-muted">
                <Icon name={mode.id} size={34} />
                {mode.label}
              </div>
            ))}
          </div>
        </Section>

        <Section title="All icons">
          <div className="grid grid-cols-4 gap-5 text-gold sm:grid-cols-6">
            {ICON_NAMES.map((name) => (
              <div key={name} className="flex flex-col items-center gap-2 text-[11px] text-muted">
                <Icon name={name} size={28} />
                {name}
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
