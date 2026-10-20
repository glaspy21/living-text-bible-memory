import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function PublishPage() {
  await requireAdmin();
  return (
    <Main>
      <PageTitle title="Preview & publish" sub="Validate, preview and publish a timing version" />
      <Placeholder milestone="M16 · Validation & publish">
        Validation flags, Draft → Ready → Published, versioned timing sets.
      </Placeholder>
    </Main>
  );
}
