import { Suspense } from "react";
import { AdminShell } from "@/client/components/shell/admin-shell";
import { signOutToHome } from "@/server/auth/actions";
import { requireAdmin } from "@/server/auth/require-admin";

async function AdminFrame({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();
  return (
    <AdminShell email={email} signOutAction={signOutToHome}>
      {children}
    </AdminShell>
  );
}

// Nothing renders until the session is checked, so no admin markup reaches signed-out visitors.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={null}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}
