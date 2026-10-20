import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function PublishPage() {
  await requireAdmin("/admin/publish");
  return (
    <Main>
      <PageTitle title="Preview & publish" sub="Validate, preview and publish a timing version" />
      <Placeholder milestone="M16 · Validation & publish">
        Validation flags, Draft → Ready → Published, versioned timing sets.
      </Placeholder>
    </Main>
  );
}
