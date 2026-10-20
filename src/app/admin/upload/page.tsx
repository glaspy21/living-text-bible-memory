import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function UploadPage() {
  await requireAdmin();
  return (
    <Main>
      <PageTitle
        title="Upload music"
        sub="Upload → Metadata → Verse timing → Validation → Preview → Publish"
      />
      <Placeholder milestone="M13 · Upload">
        Direct-to-storage upload, metadata form, duration probe, peaks.
      </Placeholder>
    </Main>
  );
}
