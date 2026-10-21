import { Suspense } from "react";
import { Main } from "@/client/components/shell/regions";
import { BarLink } from "@/client/components/ui/bar";
import { parsePassageParam, withPassage } from "@/shared/scripture/passage-param";
import { formatReference } from "@/shared/scripture/refs";

async function Choice({ searchParams }: { searchParams: PageProps<"/memorize">["searchParams"] }) {
  const { p } = await searchParams;
  const passage = parsePassageParam(Array.isArray(p) ? p[0] : p);
  // Without a passage, choosing a method first means choosing verses.
  const to = (path: string, from: string) =>
    passage ? withPassage(path, passage) : `/memorize/range?from=${from}`;
  return (
    <>
      <p className="mt-2 mb-[34px] text-center text-muted" data-testid="choice-passage">
        {passage ? formatReference(passage) : "No verses chosen yet"}
      </p>
      <div className="flex flex-col gap-[18px]">
        <BarLink
          href={to("/memorize/steps", "steps")}
          icon="list"
          title="Memorization Steps"
          subtitle="Listen, Sing, Recall, Chain"
        />
        <BarLink
          href={to("/memorize/flashcards", "flashcards")}
          icon="cards"
          title="Flashcards"
          subtitle="Practice in random order"
        />
      </div>
    </>
  );
}

export default function MemorizeChoicePage({ searchParams }: PageProps<"/memorize">) {
  return (
    <Main className="flex flex-col items-center">
      <div className="w-full max-w-[520px] pt-[60px] max-[520px]:pt-6">
        <h1 className="text-center font-serif text-[30px] font-medium text-text max-[520px]:text-2xl">
          Choose a Memorization Method
        </h1>
        <Suspense fallback={<p className="mt-2 mb-[34px] text-center text-muted">&nbsp;</p>}>
          <Choice searchParams={searchParams} />
        </Suspense>
      </div>
    </Main>
  );
}
