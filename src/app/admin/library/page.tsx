import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function LibraryPage() {
  await requireAdmin();
  return (
    <Main>
      <PageTitle title="Track library" sub="All recordings by passage, genre and status" />
      <Placeholder milestone="M14 · Library">
        Filter by status, multiple recordings per passage, replace audio.
      </Placeholder>
    </Main>
  );
}
