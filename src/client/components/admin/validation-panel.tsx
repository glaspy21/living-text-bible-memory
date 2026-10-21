"use client";

import { useMemo } from "react";
import { Button } from "@/client/components/ui/button";
import { cn } from "@/client/lib/cn";
import type { TimingRow } from "@/shared/timing/timing";
import { describeIssue, validateTiming } from "@/shared/timing/validation";

type Props = {
  rows: TimingRow[];
  durationMs: number;
  labels: string[];
  /** Present when the sheet can be edited: lets the admin acknowledge gaps and overlaps. */
  onAcknowledge?: (index: number, kind: "gap" | "overlap", value: boolean) => void;
  onAcknowledgeAll?: (kind: "gap" | "overlap") => void;
  onSelect?: (index: number) => void;
};

/**
 * The validation result for a timing sheet, live. Blocking problems are listed first; gaps and
 * overlaps (which can be intentional) can be acknowledged one by one or all at once. Nothing here
 * changes a boundary.
 */
export function ValidationPanel({
  rows,
  durationMs,
  labels,
  onAcknowledge,
  onAcknowledgeAll,
  onSelect,
}: Props) {
  const result = useMemo(() => validateTiming(rows, durationMs), [rows, durationMs]);
  const gaps = result.warnings.filter((w) => w.kind === "gap");
  const overlaps = result.warnings.filter((w) => w.kind === "overlap");

  return (
    <section
      aria-label="Validation"
      data-testid="validation-panel"
      data-ok={result.ok}
      className="rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-[20px] font-medium text-heading">Validation</h2>
        <span
          data-testid="validation-summary"
          className={cn("text-[13px]", result.ok ? "text-ok" : "text-warn")}
        >
          {result.ok
            ? "Ready: every verse is timed and nothing is left to review."
            : `${result.errors.length} to fix · ${result.unacknowledged.length} to review`}
        </span>
      </div>

      {result.issues.length === 0 && (
        <p className="mt-2 text-[13px] text-muted">No problems found.</p>
      )}

      {result.errors.length > 0 && (
        <ul className="mt-3 space-y-1.5" data-testid="validation-errors">
          {result.errors.map((issue, k) => (
            <li
              key={`${issue.kind}${issue.index}${k}`}
              className="flex items-start gap-2 text-[14px]"
            >
              <span className="mt-[3px] text-err" aria-hidden="true">
                ●
              </span>
              <button
                type="button"
                className="text-left text-text underline decoration-[var(--line)] underline-offset-2 hover:decoration-[var(--gold)]"
                onClick={() => onSelect?.(issue.index)}
              >
                {describeIssue(issue, labels)}
              </button>
              <span className="sr-only">Must be fixed.</span>
            </li>
          ))}
        </ul>
      )}

      {result.warnings.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted">
              Gaps and overlaps can be intentional (a pause, a held note). Tick each one you mean.
              Nothing is removed for you.
            </p>
            {onAcknowledgeAll && (
              <span className="flex gap-1.5">
                {gaps.some((g) => !g.acknowledged) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAcknowledgeAll("gap")}
                    data-testid="ack-all-gaps"
                  >
                    Acknowledge all gaps
                  </Button>
                )}
                {overlaps.some((o) => !o.acknowledged) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onAcknowledgeAll("overlap")}
                    data-testid="ack-all-overlaps"
                  >
                    Acknowledge all overlaps
                  </Button>
                )}
              </span>
            )}
          </div>
          <ul className="space-y-1" data-testid="validation-warnings">
            {result.warnings.map((issue) => (
              <li
                key={`${issue.kind}${issue.index}`}
                className="flex items-center gap-2.5 text-[14px]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--gold)]"
                  checked={issue.acknowledged}
                  disabled={!onAcknowledge}
                  aria-label={`Acknowledge: ${describeIssue(issue, labels)}`}
                  onChange={(e) =>
                    onAcknowledge?.(issue.index, issue.kind as "gap" | "overlap", e.target.checked)
                  }
                />
                <button
                  type="button"
                  className={cn("text-left", issue.acknowledged ? "text-muted" : "text-text")}
                  onClick={() => onSelect?.(issue.index)}
                >
                  {describeIssue(issue, labels)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
