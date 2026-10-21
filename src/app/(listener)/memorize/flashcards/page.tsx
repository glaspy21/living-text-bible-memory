import { Suspense } from "react";
import { FlashcardsView } from "@/client/components/flashcards/flashcards-view";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { BarLink } from "@/client/components/ui/bar";
import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadStudyPassage } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/** Shown when the page is opened without a (valid) passage. */
function ChooseFirst() {
  return (
    <Main>
      <div className="mx-auto w-full max-w-[720px]">
        <PageTitle title="Flashcards" />
        <BarLink
          href="/memorize/range"
          icon="book"
          title="Choose verses first"
          subtitle="Pick the passage you want to practice"
        />
      </div>
    </Main>
  );
}

async function Flashcards({
  searchParams,
}: {
  searchParams: PageProps<"/memorize/flashcards">["searchParams"];
}) {
  const { p } = await searchParams;
  const param = Array.isArray(p) ? p[0] : p;
  const passage = parsePassageParam(param);
  if (!passage) return <ChooseFirst />;

  const loaded = await loadStudyPassage(passage, await getPreferredTranslation()).catch((error) => {
    if (error instanceof ScriptureUnavailableError && error.reason === "not-found") return null;
    throw error;
  });
  if (!loaded) return <ChooseFirst />;

  return (
    <FlashcardsView
      key={param}
      passage={passage}
      verses={loaded.verses}
      translation={loaded.translation}
      note={loaded.note}
    />
  );
}

export default function FlashcardsPage({ searchParams }: PageProps<"/memorize/flashcards">) {
  return (
    <Suspense
      fallback={
        <Main player>
          <p className="text-muted">Loading…</p>
        </Main>
      }
    >
      <Flashcards searchParams={searchParams} />
    </Suspense>
  );
}
