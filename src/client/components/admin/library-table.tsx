import { ButtonLink } from "@/client/components/ui/button";
import { StatusPill } from "@/client/components/admin/status-pill";
import { ReplaceAudioButton } from "@/client/components/admin/replace-audio-button";
import { arrangementLabel, type LibraryRow } from "@/shared/library/admin-library";
import { formatTime } from "@/shared/audio/format-time";

const th =
  "px-2.5 py-2 text-left text-[10.5px] font-normal tracking-[.16em] text-gold-dim uppercase";
const td = "px-2.5 py-3.5 align-middle";

const uploaded = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** All recordings, one row each; several recordings of one passage and genre sit side by side. */
export function LibraryTable({ rows }: { rows: LibraryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="mt-3.5 w-full border-collapse" data-testid="library-table">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Passage</th>
            <th className={th}>Genre</th>
            <th className={th}>Status</th>
            <th className={th}>Timing</th>
            <th className={th}>Length</th>
            <th className={th}>Uploaded</th>
            <th className={th}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line" data-testid="library-row">
              <td className={td}>
                <span className="text-text">{r.reference}</span>
                {r.translation !== "WEB" && (
                  <span className="ml-2 text-xs text-muted">{r.translation}</span>
                )}
              </td>
              <td className={td}>
                {r.genreName}
                {r.arrangementNo > 1 && (
                  <span className="ml-2 text-xs text-muted">
                    {arrangementLabel(r.title, r.arrangementNo)}
                  </span>
                )}
              </td>
              <td className={td}>
                <StatusPill status={r.status} />
                {r.hasPendingDraft && (
                  <span className="mt-1 block text-xs text-warn">New draft waiting</span>
                )}
              </td>
              <td className={`${td} text-muted`}>
                {r.progress.total === 0 ? "—" : `${r.progress.timed} of ${r.progress.total} verses`}
              </td>
              <td className={`${td} text-muted`}>{formatTime(r.durationMs)}</td>
              <td className={`${td} text-muted`}>{uploaded(r.createdAt)}</td>
              <td className={td}>
                <span className="flex flex-wrap items-start justify-end gap-2">
                  <ButtonLink size="sm" href={`/admin/timing?recording=${r.id}`}>
                    Timing
                  </ButtonLink>
                  <ReplaceAudioButton recordingId={r.id} published={r.status === "PUBLISHED"} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
