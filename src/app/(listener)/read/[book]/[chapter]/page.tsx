import { Suspense } from "react";
import { Main, PageTitle, Placeholder, RightPanel } from "@/client/components/shell/regions";
import { readerTitle } from "@/shared/routes";

async function ReaderTitle({ params }: { params: PageProps<"/read/[book]/[chapter]">["params"] }) {
  const { book, chapter } = await params;
  return <PageTitle title={readerTitle(`/read/${book}/${chapter}`)} />;
}

export default function ReaderPage({ params }: PageProps<"/read/[book]/[chapter]">) {
  return (
    <>
      <Main player>
        <div className="mx-auto w-full max-w-[720px]">
          <Suspense fallback={<PageTitle title="" />}>
            <ReaderTitle params={params} />
          </Suspense>
          <Placeholder milestone="M7 · M8 · Reader">
            Chapter text with hanging verse numbers, verse tap-to-select, Prev/Next chapter.
          </Placeholder>
        </div>
      </Main>
      <RightPanel label="Memorize">
        <h2 className="mb-3 font-serif text-[22px] font-medium text-heading">Memorize</h2>
        <Placeholder milestone="M8">
          Selected passage, music availability, Edit verse range.
        </Placeholder>
      </RightPanel>
    </>
  );
}
