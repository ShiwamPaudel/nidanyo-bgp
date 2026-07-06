import { requireUser } from "@/lib/auth/guard";
import { getLab } from "@/lib/queries/lab";
import { getNavBadges } from "@/lib/queries/badges";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ lab }, badges] = await Promise.all([getLab(user.labId), getNavBadges(user.labId)]);

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        roleName: user.roleName,
        permissions: user.permissions,
      }}
      labName={lab?.name ?? "Nidanyo"}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
