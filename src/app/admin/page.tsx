import { ButtonLink } from "@/client/components/ui/button";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";
import { adminDashboard } from "@/server/library";
import { arrangementLabel } from "@/shared/library/admin-library";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const summary = await adminDashboard();
  const stats = [
    ["Published", summary.counts.PUBLISHED],
    ["Ready for review", summary.counts.READY],
    ["Drafts", summary.counts.DRAFT],
    ["Passages with music", summary.passagesWithMusic],
  ] as const;

  return (
    <Main>
      <PageTitle title="Dashboard" sub="Scripture music workspace" />
      <div
        className="grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-2"
        data-testid="dashboard-stats"
      >
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-line bg-[rgba(18,18,18,.7)] px-[18px] py-4"
            data-testid="stat"
          >
            <span className="text-muted">{label}</span>
            <b className="block font-serif text-[34px] font-medium text-heading">{value}</b>
          </div>
        ))}
      </div>

      <div className="mt-[30px] flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl font-medium text-heading">Needs attention</h2>
        <ButtonLink variant="solid" size="sm" href="/admin/upload">
          Upload recording
        </ButtonLink>
      </div>

      {summary.needsAttention.length === 0 ? (
        <p className="mt-4 text-muted" data-testid="attention-empty">
          {summary.total === 0
            ? "No recordings yet. Upload one to get started."
            : "Nothing is waiting on you."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3.5 w-full border-collapse" data-testid="attention-table">
            <thead>
              <tr className="border-b border-line">
                <th className="px-2.5 py-2 text-left text-[10.5px] font-normal tracking-[.16em] text-gold-dim uppercase">
                  Track
                </th>
                <th className="px-2.5 py-2 text-left text-[10.5px] font-normal tracking-[.16em] text-gold-dim uppercase">
                  Issue
                </th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.needsAttention.map((r) => (
                <tr key={r.id} className="border-b border-line" data-testid="attention-row">
                  <td className="px-2.5 py-3.5">
                    {r.reference} · {r.genreName}
                    {r.arrangementNo > 1 && (
                      <span className="ml-2 text-xs text-muted">
                        {arrangementLabel(r.title, r.arrangementNo)}
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-3.5 text-xs text-warn">{r.attention}</td>
                  <td className="px-2.5 py-3.5 text-right">
                    <ButtonLink size="sm" href={`/admin/timing?recording=${r.id}`}>
                      Open editor
                    </ButtonLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary.recent.length > 0 && (
        <>
          <h2 className="mt-9 font-serif text-2xl font-medium text-heading">Recent activity</h2>
          <ul className="mt-3 border-t border-line" data-testid="recent-list">
            {summary.recent.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-4 border-b border-line px-2.5 py-3"
              >
                <span>
                  {r.reference} · {r.genreName}
                </span>
                <span className="text-xs text-muted">
                  {r.updatedAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Main>
  );
}
