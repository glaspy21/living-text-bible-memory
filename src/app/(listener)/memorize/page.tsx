import { Main } from "@/client/components/shell/regions";
import { BarLink } from "@/client/components/ui/bar";

export default function MemorizeChoicePage() {
  return (
    <Main className="flex flex-col items-center">
      <div className="w-full max-w-[520px] pt-[60px] max-[520px]:pt-6">
        <h1 className="text-center font-serif text-[30px] font-medium text-text max-[520px]:text-2xl">
          Choose a Memorization Method
        </h1>
        <div className="mt-[34px] flex flex-col gap-[18px]">
          <BarLink
            href="/memorize/steps"
            icon="list"
            title="Memorization Steps"
            subtitle="Listen, Sing, Recall, Chain"
          />
          <BarLink
            href="/memorize/flashcards"
            icon="cards"
            title="Flashcards"
            subtitle="Practice in random order"
          />
        </div>
      </div>
    </Main>
  );
}
