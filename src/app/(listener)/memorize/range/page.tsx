import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";

export default function VerseRangePage() {
  return (
    <Main>
      <div className="mx-auto w-full max-w-[720px]">
        <PageTitle title="Choose verses" />
        <Placeholder milestone="M9 · Verse range">
          Book and chapter, verse grid, tap start then end; ranges may cross chapters.
        </Placeholder>
      </div>
    </Main>
  );
}
