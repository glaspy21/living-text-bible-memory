import { cn } from "@/client/lib/cn";

const STEPS = ["Upload", "Metadata", "Verse timing", "Validation", "Preview", "Publish"] as const;

/** The admin workflow bar: Upload → Metadata → Verse timing → Validation → Preview → Publish. */
export function WizardSteps({ current }: { current: number }) {
  return (
    <ol className="mt-[18px] mb-[22px] flex flex-wrap items-center gap-1" aria-label="Steps">
      {STEPS.map((label, i) => {
        const state = i === current ? "current" : i < current ? "done" : "todo";
        return (
          <li
            key={label}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 text-[13px] [&:not(:first-child)]:before:mr-1.5 [&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:w-[18px] [&:not(:first-child)]:before:bg-line [&:not(:first-child)]:before:content-['']",
              state === "current" ? "text-gold2" : "text-muted",
            )}
          >
            <i
              className={cn(
                "grid h-[22px] w-[22px] place-items-center rounded-full border text-[11px] not-italic",
                state === "current" && "border-gold bg-gold text-[#111]",
                state === "done" && "border-ok text-ok",
                state === "todo" && "border-line",
              )}
            >
              {state === "done" ? "✓" : i + 1}
            </i>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
