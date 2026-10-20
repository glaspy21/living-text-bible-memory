import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";

export default function FlashcardsPage() {
  return (
    <Main player>
      <div className="mx-auto w-full max-w-[720px]">
        <PageTitle title="Flashcards" />
        <Placeholder milestone="M12 · Flashcards">
          Flip, advance and back, Shuffle, Switch to Steps. Audio plays only on Play.
        </Placeholder>
      </div>
    </Main>
  );
}
