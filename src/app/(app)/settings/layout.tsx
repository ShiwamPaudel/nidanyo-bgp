import { requireUser, hasPermission } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/ui/page";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canView = hasPermission(user, PERMISSIONS.SETTINGS_VIEW) || hasPermission(user, PERMISSIONS.USERS_MANAGE) || hasPermission(user, PERMISSIONS.ROLES_MANAGE);
  if (!canView) redirect("/no-access");

  const items = [
    hasPermission(user, PERMISSIONS.SETTINGS_VIEW) && { href: "/settings/lab-profile", label: "Lab Profile" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/report-assets", label: "Report Assets" },
    hasPermission(user, PERMISSIONS.USERS_MANAGE) && { href: "/settings/users", label: "Users" },
    hasPermission(user, PERMISSIONS.ROLES_MANAGE) && { href: "/settings/roles", label: "Roles" },
    hasPermission(user, PERMISSIONS.USERS_MANAGE) && { href: "/settings/signatures", label: "Signatures" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/departments", label: "Departments" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/sample-types", label: "Sample Types" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/doctors", label: "Referring Doctors" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/payment-modes", label: "Payment Modes" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/sms", label: "SMS" },
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE) && { href: "/settings/email", label: "Email" },
    hasPermission(user, PERMISSIONS.AUDIT_VIEW) && { href: "/settings/audit", label: "Audit Log" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <>
      <PageHeader title="Settings" description="Configure your laboratory, users, roles, and report appearance." />
      <SettingsNav items={items} />
      {children}
    </>
  );
}
