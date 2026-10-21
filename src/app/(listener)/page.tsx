import { Logo } from "@/client/components/brand/logo";
import { ContinueBar } from "@/client/components/recent/continue-bar";
import { RecentlyStudied } from "@/client/components/recent/recently-studied";
import { Main } from "@/client/components/shell/regions";
import { BarLink } from "@/client/components/ui/bar";

export default function HomePage() {
  return (
    <Main screen="home" className="flex flex-col items-center">
      <div className="flex w-full max-w-[880px] flex-col items-center gap-[18px] pt-1.5">
        <h1 className="sr-only">Living Text</h1>
        <div className="flex h-[250px] w-full items-center justify-center rounded-2xl border border-line max-[520px]:rounded-none max-[520px]:border-0 max-[520px]:border-b">
          <Logo variant="lockup" height={190} />
        </div>
        <div className="flex w-full max-w-[720px] flex-col gap-[18px] max-[520px]:px-4">
          <ContinueBar />
          <BarLink
            href="/read"
            icon="book"
            title="Browse Scripture"
            subtitle="Choose a book and chapter"
          />
          <RecentlyStudied />
        </div>
      </div>
    </Main>
  );
}
