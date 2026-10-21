import { cn } from "@/client/lib/cn";
import { STATUS_LABELS, type RecordingStatus } from "@/shared/library/admin-library";

const tone: Record<RecordingStatus, string> = {
  DRAFT: "border-[#444] text-muted",
  READY: "border-warn text-warn",
  PUBLISHED: "border-ok text-ok",
};

/** The status of a recording as a small outlined pill. */
export function StatusPill({ status }: { status: RecordingStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-[9px] py-0.5 text-[11.5px] whitespace-nowrap",
        tone[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
