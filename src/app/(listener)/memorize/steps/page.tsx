import { Suspense } from "react";
import { StepsView } from "@/client/components/steps/steps-view";
import { Main, PageTitle } from "@/client/components/shell/regions";
import { BarLink } from "@/client/components/ui/bar";
import { getPreferredTranslation } from "@/server/scripture/preference";
import { loadStudyPassage } from "@/server/scripture/reader";
import { ScriptureUnavailableError } from "@/server/scripture/types";
import { parseStep } from "@/shared/memorize/steps";
import { parsePassageParam } from "@/shared/scripture/passage-param";

/** Shown when the page is opened without a (valid) passage. */
function ChooseFirst() {
  return (
    <Main>
      <div className="mx-auto w-full max-w-[720px]">
        <PageTitle title="Memorization Steps" sub="Listen · Sing · Recall · Chain" />
        <BarLink
          href="/memorize/range"
          icon="book"
          title="Choose verses first"
          subtitle="Pick the passage you want to memorize"
        />
      </div>
    </Main>
  );
}

async function Steps({
  searchParams,
}: {
  searchParams: PageProps<"/memorize/steps">["searchParams"];
}) {
  const { p, step } = await searchParams;
  const passage = parsePassageParam(Array.isArray(p) ? p[0] : p);
  if (!passage) return <ChooseFirst />;

  const loaded = await loadStudyPassage(passage, await getPreferredTranslation()).catch((error) => {
    if (error instanceof ScriptureUnavailableError && error.reason === "not-found") return null;
    throw error;
  });
  if (!loaded) return <ChooseFirst />;

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
