import type { TimingRow } from "./timing";

/**
 * Checks a timing sheet before it can be marked Ready or published. Pure rules, no data access.
 *
 * Blocking problems (errors) can't be waved through: a missing boundary, an end that isn't after
 * its start, a time outside the recording, or a verse that begins before the one preceding it.
 * Gaps and overlaps between neighbours can be intentional, so they are warnings the admin
 * acknowledges; they are never fixed or removed automatically.
 */

export type IssueKind =
  | "missing-start"
  | "missing-end"
  | "end-not-after-start"
  | "outside-recording"
  | "out-of-order"
  | "gap"
  | "overlap";

export type Issue = {
  kind: IssueKind;
  severity: "error" | "warning";
  /** The verse the issue belongs to (for a gap or overlap: the earlier of the two verses). */
  index: number;
  /** For gaps and overlaps: the size in milliseconds. */
  ms?: number;
  /** Warnings only: the admin has said this is intended. */
  acknowledged: boolean;
};

export type ValidationResult = {
  issues: Issue[];
  /** Blocking problems. */
  errors: Issue[];
  /** Gaps and overlaps. */
  warnings: Issue[];
  /** Warnings the admin hasn't acknowledged yet. */
  unacknowledged: Issue[];
  /** Verses with both boundaries. */
  timed: number;
  /** True when nothing blocks marking the timing Ready and every warning is acknowledged. */
  ok: boolean;
};

export function validateTiming(rows: readonly TimingRow[], durationMs: number): ValidationResult {
  const issues: Issue[] = [];
  const add = (issue: Omit<Issue, "acknowledged"> & { acknowledged?: boolean }) =>
    issues.push({ acknowledged: false, ...issue });

  rows.forEach((r, index) => {
    if (r.startMs === null) add({ kind: "missing-start", severity: "error", index });
    if (r.endMs === null) add({ kind: "missing-end", severity: "error", index });
    if (r.startMs !== null && r.endMs !== null && r.endMs <= r.startMs) {
      add({ kind: "end-not-after-start", severity: "error", index });
    }
    if (
      (r.startMs !== null && (r.startMs < 0 || r.startMs > durationMs)) ||
      (r.endMs !== null && (r.endMs < 0 || r.endMs > durationMs))
    ) {
      add({ kind: "outside-recording", severity: "error", index });
    }
  });

  // Neighbours in verse order: a verse can't begin before the previous one began.
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (a.startMs !== null && b.startMs !== null && b.startMs < a.startMs) {
      add({ kind: "out-of-order", severity: "error", index: i + 1 });
      continue;
    }
    if (a.endMs === null || b.startMs === null) continue;
    if (b.startMs > a.endMs) {
      add({
        kind: "gap",
        severity: "warning",
        index: i,
        ms: b.startMs - a.endMs,
        acknowledged: a.ackGap,
      });
    } else if (b.startMs < a.endMs) {
      add({
        kind: "overlap",
        severity: "warning",
        index: i,
        ms: a.endMs - b.startMs,
        acknowledged: a.ackOverlap,
      });
    }
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const unacknowledged = warnings.filter((i) => !i.acknowledged);
  return {
    issues,
    errors,
    warnings,
    unacknowledged,
    timed: rows.filter((r) => r.startMs !== null && r.endMs !== null).length,
    ok: errors.length === 0 && unacknowledged.length === 0 && rows.length > 0,
  };
}

/** Sets the acknowledgement for every gap (or every overlap) in one go; nothing else changes. */
export function acknowledgeAll(
  rows: readonly TimingRow[],
  durationMs: number,
  kind: "gap" | "overlap",
): TimingRow[] {
  const targets = new Set(
    validateTiming(rows, durationMs)
      .warnings.filter((w) => w.kind === kind)
      .map((w) => w.index),
  );
  return rows.map((r, i) =>
    targets.has(i) ? { ...r, [kind === "gap" ? "ackGap" : "ackOverlap"]: true } : r,
  );
}

/** One plain sentence for an issue, naming the verse by its label ("3" or "1:3"). */
export function describeIssue(issue: Issue, labels: readonly string[]): string {
  const verse = labels[issue.index] ?? String(issue.index + 1);
  const next = labels[issue.index + 1] ?? String(issue.index + 2);
  const seconds = issue.ms === undefined ? "" : `${(issue.ms / 1000).toFixed(2)} s`;
  switch (issue.kind) {
    case "missing-start":
      return `Verse ${verse} has no start time.`;
    case "missing-end":
      return `Verse ${verse} has no end time.`;
    case "end-not-after-start":
      return `Verse ${verse} ends at or before it starts.`;
    case "outside-recording":
      return `Verse ${verse} has a time outside the recording.`;
    case "out-of-order":
      return `Verse ${verse} starts before the verse above it.`;
    case "gap":
      return `${seconds} of silence between verse ${verse} and verse ${next}.`;
    case "overlap":
      return `Verse ${verse} and verse ${next} overlap by ${seconds}.`;
  }
}
