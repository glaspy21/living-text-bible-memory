import Link from "next/link";
import { notFound } from "next/navigation";
import { WizardSteps } from "@/client/components/admin/wizard-steps";
import { PublishPanel } from "@/client/components/admin/publish-panel";
import { StatusPill } from "@/client/components/admin/status-pill";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";
import { listLibrary } from "@/server/library";
import { timingEditor } from "@/server/timing";
import { formatTime } from "@/shared/audio/format-time";
import { formatReference } from "@/shared/scripture/refs";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function PublishPage({ searchParams }: PageProps<"/admin/publish">) {
  await requireAdmin("/admin/publish");
  const { recording: raw } = await searchParams;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const data = id ? await timingEditor.load(id) : null;
  if (id && !data) notFound();

  if (!data) {
    // No recording chosen: offer the ones that still need a decision.
    const waiting = (await listLibrary("all")).filter(
      (r) => r.status !== "PUBLISHED" || r.hasPendingDraft,
    );
    return (
      <Main>
        <div className="mx-auto w-full max-w-[860px]">
          <PageTitle
            title="Preview & publish"
            sub="Validate, preview and publish a timing version"
          />
          <WizardSteps current={4} />
          {waiting.length === 0 ? (
            <p className="text-muted" data-testid="publish-pick">
              Nothing is waiting. Choose a recording from the{" "}
              <Link href="/admin/library" className="text-gold2 underline">
                track library
              </Link>
              .
            </p>
          ) : (
            <ul
              className="divide-y divide-[var(--line)] rounded-[10px] border border-line"
              data-testid="publish-pick"
            >
              {waiting.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span>
                    <b className="font-serif text-[18px] font-medium text-gold2">{r.reference}</b>
                    <span className="ml-2 text-muted">{r.genreName}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusPill status={r.status} />
                    <Link
                      href={`/admin/publish?recording=${r.id}`}
                      className="text-gold2 underline"
                    >
                      Review
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Main>
    );
  }

  const rec = data.recording;
  return (
    <Main>
      <div className="mx-auto w-full max-w-[860px]">
        <PageTitle title="Preview & publish" sub="Validate, preview and publish a timing version" />
        <WizardSteps current={rec.status === "PUBLISHED" && !data.draft ? 5 : 4} />
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4"
          data-testid="publish-recording"
        >
          <div>
            <b className="block font-serif text-[20px] font-medium text-gold2">
              {formatReference({
                book: rec.bookSlug,
                start: { chapter: rec.chapter, verse: rec.verseStart },
                end: { chapter: rec.endChapter, verse: rec.verseEnd },
              })}
            </b>
            <span className="text-muted">
              {rec.genreName}
              {rec.arrangementNo > 1 ? ` · Default ${rec.arrangementNo}` : ""} ·{" "}
              {formatTime(data.durationMs)}
            </span>
          </div>
          <StatusPill status={rec.status} />
        </div>
        <PublishPanel
          recordingId={rec.id}
          status={rec.status}
          hasDraft={data.draft !== null}
          draftVersion={data.draft?.version ?? null}
          rows={data.rows}
          labels={data.rows.map((r) =>
            rec.chapter === rec.endChapter ? `${r.verse}` : `${r.chapter}:${r.verse}`,
          )}
          audioAssetId={data.audioAssetId}
          durationMs={data.durationMs}
        />
      </div>
    </Main>
  );
}
