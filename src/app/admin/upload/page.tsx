import { PageTitle, Main } from "@/client/components/shell/regions";
import { UploadWizard } from "@/client/components/admin/upload-wizard";
import { requireAdmin } from "@/server/auth/require-admin";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function UploadPage() {
  await requireAdmin("/admin/upload");
  return (
    <Main>
      <div className="mx-auto w-full max-w-[860px]">
        <PageTitle title="Upload music" />
        <UploadWizard />
      </div>
    </Main>
  );
}
