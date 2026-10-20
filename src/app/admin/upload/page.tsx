import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function UploadPage() {
  await requireAdmin("/admin/upload");
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
