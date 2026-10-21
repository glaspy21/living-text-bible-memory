import { Suspense } from "react";
import { HeaderReference } from "@/client/components/shell/listener-nav";
import { ListenerShell } from "@/client/components/shell/listener-shell";
import { TranslationMenu } from "@/client/components/shell/translation-menu";
import { booksWithMusic } from "@/server/library";
import { setTranslation } from "@/server/scripture/actions";
import { availableTranslations } from "@/server/scripture";
import { getPreferredTranslation } from "@/server/scripture/preference";

/** The header's book selector, with a dot beside each book that has published music. */
async function ReferenceWithMusic() {
  const musicBooks = [...(await booksWithMusic())];
  // HeaderReference reads the URL, which needs its own Suspense boundary.
  return (
    <Suspense fallback={<span />}>
      <HeaderReference musicBooks={musicBooks} />
    </Suspense>
  );
}

/** The header's translation badge, showing what this visitor chose and what is on offer. */
async function TranslationControl() {
  return (
    <TranslationMenu
      current={await getPreferredTranslation()}
      available={availableTranslations()}
      onChoose={setTranslation}
    />
  );
}

export default function ListenerLayout({ children }: LayoutProps<"/">) {
  return (
    <ListenerShell
      translation={
        <Suspense fallback={<span className="shell-esv" />}>
          <TranslationControl />
        </Suspense>
      }
      reference={
        <Suspense fallback={<span />}>
          <ReferenceWithMusic />
        </Suspense>
      }
    >
      {children}
    </ListenerShell>
  );
}
