import Link from "next/link";
import { notFound } from "next/navigation";
import { WizardSteps } from "@/client/components/admin/wizard-steps";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db/client";
import { formatReference } from "@/shared/scripture/refs";
import { formatTime } from "@/shared/audio/format-time";
import { TimingEditor } from "@/client/components/admin/timing-editor";
import { timingEditor } from "@/server/timing";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function TimingPage({ searchParams }: PageProps<"/admin/timing">) {
  await requireAdmin("/admin/timing");
  const { recording: raw } = await searchParams;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const recording = id
    ? await db.recording.findUnique({
        where: { id },
        include: { book: true, genre: true, originalAsset: true },
      })
    : null;
  if (id && !recording) notFound();
  const data = id ? await timingEditor.load(id) : null;

  return (
    <Main>
      <div className="mx-auto w-full max-w-[860px]">
        <PageTitle title="Timing editor" />
        <WizardSteps current={2} />
        {recording && (
          <div
            className="mb-5 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
            data-testid="saved-recording"
          >
            <b className="block font-serif text-[20px] font-medium text-gold2">
              {formatReference({
                book: recording.book.slug,
                start: { chapter: recording.chapter, verse: recording.verseStart },
                end: { chapter: recording.endChapter, verse: recording.verseEnd },
              })}
            </b>
            <span className="text-muted">
              {recording.genre.name} · {recording.title}
              {recording.arrangementNo > 1 ? ` ${recording.arrangementNo}` : ""} ·{" "}
              {formatTime(recording.originalAsset.durationMs)} ·{" "}
              {recording.status === "DRAFT" ? "Draft" : recording.status}
            </span>
          </div>
        )}
        {data ? (
          <TimingEditor
            // a new key remounts the editor when the draft it works on changes
            key={data.draft?.id ?? "published"}
            recordingId={data.recording.id}
            status={data.recording.status}
            draft={data.draft}
            audioAssetId={data.audioAssetId}
            durationMs={data.durationMs}
            initialRows={data.rows}
            labels={data.rows.map((r) =>
              data.recording.chapter === data.recording.endChapter
                ? `${r.verse}`
                : `${r.chapter}:${r.verse}`,
            )}
          />
        ) : (
          <p className="text-muted" data-testid="timing-pick">
            Choose a recording from the{" "}
            <Link href="/admin/library" className="text-gold2 underline">
              track library
            </Link>{" "}
            to set its verse timing.
          </p>
        )}
      </div>
    </Main>
  );
}
