import { AdminShell } from "@/client/components/shell/admin-shell";
import { requireAdmin } from "@/server/auth/require-admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
