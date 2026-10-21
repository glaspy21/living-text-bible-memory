import Link from "next/link";
import { LibraryTable } from "@/client/components/admin/library-table";
import { ButtonLink } from "@/client/components/ui/button";
import { Main } from "@/client/components/shell/regions";
import { cn } from "@/client/lib/cn";
import { requireAdmin } from "@/server/auth/require-admin";
import { listLibrary } from "@/server/library";
import { FILTER_LABELS, LIBRARY_FILTERS, parseFilter } from "@/shared/library/admin-library";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function LibraryPage({ searchParams }: PageProps<"/admin/library">) {
  await requireAdmin("/admin/library");
  const filter = parseFilter((await searchParams).status);
  const rows = await listLibrary(filter);

  return (
    <Main>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] font-medium tracking-[.02em] text-heading max-[520px]:text-2xl">
            Track library
          </h1>
          <p className="mt-1 text-muted">All recordings by passage, genre and status</p>
        </div>
        <ButtonLink variant="solid" size="sm" href="/admin/upload">
          Upload recording
        </ButtonLink>
      </header>

      <nav aria-label="Filter by status" className="flex gap-6 border-b border-line">
        {LIBRARY_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/library" : `/admin/library?status=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-0.5 pb-2.5 text-sm",
              f === filter
                ? "border-gold text-gold2"
                : "border-transparent text-muted hover:text-text",
            )}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 text-muted" data-testid="library-empty">
          {filter === "all"
            ? "No recordings yet. Upload one to get started."
            : "No recordings with this status."}
        </p>
      ) : (
        <LibraryTable rows={rows} />
      )}
    </Main>
  );
}
