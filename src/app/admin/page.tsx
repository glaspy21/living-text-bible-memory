import { Main, PageTitle, Placeholder } from "@/client/components/shell/regions";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function AdminDashboardPage() {
  await requireAdmin();
  return (
    <Main>
      <PageTitle title="Dashboard" sub="Scripture music workspace" />
      <Placeholder milestone="M14 · Dashboard">
        Recordings by status and recent activity.
      </Placeholder>
    </Main>
  );
}
