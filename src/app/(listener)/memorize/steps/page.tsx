import { Main, PageTitle, Placeholder, RightPanel } from "@/client/components/shell/regions";

export default function StepsPage() {
  return (
    <>
      <Main player>
        <div className="mx-auto w-full max-w-[720px]">
          <PageTitle title="Memorization Steps" sub="Listen · Sing · Recall · Chain" />
          <Placeholder milestone="M11 · Steps">
            Stepper, single/multi-verse focus, Reveal Scripture, help, Switch to Flashcards.
          </Placeholder>
        </div>
      </Main>
      <RightPanel label="Passage settings">
        <Placeholder milestone="M11">Passage, When the verse ends, Genre.</Placeholder>
      </RightPanel>
    </>
  );
}
