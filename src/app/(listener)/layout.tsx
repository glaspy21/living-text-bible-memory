import { Suspense } from "react";
import { HeaderReference } from "@/client/components/shell/listener-nav";
import { ListenerShell } from "@/client/components/shell/listener-shell";
import { booksWithMusic } from "@/server/library";

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

export default function ListenerLayout({ children }: LayoutProps<"/">) {
  return (
    <ListenerShell
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
