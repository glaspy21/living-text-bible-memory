import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StepsView } from "@/client/components/steps/steps-view";
import { Main } from "@/client/components/shell/regions";
import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadStudyPassage } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { parseStep } from "@/shared/memorize/steps";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/** Without a (valid) passage there is nothing to show: go and choose verses, then come back here. */
const chooseVerses = () => redirect("/memorize/range?from=steps");

async function Steps({
  searchParams,
}: {
  searchParams: PageProps<"/memorize/steps">["searchParams"];
}) {
  const { p, step } = await searchParams;
  const passage = parsePassageParam(Array.isArray(p) ? p[0] : p);
  if (!passage) return chooseVerses();

  const loaded = await loadStudyPassage(passage, await getPreferredTranslation()).catch((error) => {
    if (error instanceof ScriptureUnavailableError && error.reason === "not-found") return null;
    throw error;
  });
  if (!loaded) return chooseVerses();

  return (
    <StepsView
      key={`${p}`}
      passage={passage}
      verses={loaded.verses}
      translation={loaded.translation}
      note={loaded.note}
      initialStep={parseStep(Array.isArray(step) ? step[0] : step)}
    />
  );
}

export default function StepsPage({ searchParams }: PageProps<"/memorize/steps">) {
  return (
    <Suspense
      fallback={
        <Main player>
          <p className="text-muted">Loading…</p>
        </Main>
      }
    >
      <Steps searchParams={searchParams} />
    </Suspense>
  );
}
