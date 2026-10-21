import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FlashcardsView } from "@/client/components/flashcards/flashcards-view";
import { Main } from "@/client/components/shell/regions";
import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadStudyPassage } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/** Without a (valid) passage there is nothing to show: go and choose verses, then come back here. */
const chooseVerses = () => redirect("/memorize/range?from=flashcards");

async function Flashcards({
  searchParams,
}: {
  searchParams: PageProps<"/memorize/flashcards">["searchParams"];
}) {
  const { p } = await searchParams;
  const param = Array.isArray(p) ? p[0] : p;
  const passage = parsePassageParam(param);
  if (!passage) return chooseVerses();

  const loaded = await loadStudyPassage(passage, await getPreferredTranslation()).catch((error) => {
    if (error instanceof ScriptureUnavailableError && error.reason === "not-found") return null;
    throw error;
  });
  if (!loaded) return chooseVerses();

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
