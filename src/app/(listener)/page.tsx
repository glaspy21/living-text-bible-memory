import { Logo } from "@/client/components/brand/logo";
import { Main, Placeholder } from "@/client/components/shell/regions";
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
          <BarLink
            href="/read"
            icon="book"
            title="Continue"
            subtitle="Pick up where you left off"
          />
          <BarLink
            href="/read"
            icon="book"
            title="Browse Scripture"
            subtitle="Choose a book and chapter"
          />
          <Placeholder milestone="M8 · Recently studied">
            Hero scenery and the Recently Studied list with scroll reveal.
          </Placeholder>
        </div>
      </div>
    </Main>
  );
}
