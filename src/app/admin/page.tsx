import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

// Admin pages wait for the session check; nothing is shown before it.
export const instant = false;

export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  return (
    <Main>
      <PageTitle title="Dashboard" sub="Scripture music workspace" />
      <Placeholder milestone="M14 · Dashboard">
        Recordings by status and recent activity.
      </Placeholder>
    </Main>
  );
}
