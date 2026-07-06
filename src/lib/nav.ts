import {
  LayoutDashboard,
  Users,
  ReceiptText,
  Wallet,
  TestTube,
  FlaskConical,
  CheckCircle2,
  FileText,
  Send,
  Banknote,
  BarChart3,
  Beaker,
  Layers,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any of these permissions grants visibility. */
  permissions: PermissionKey[];
  /** Optional badge counter key resolved server-side. */
  badgeKey?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permissions: [PERMISSIONS.DASHBOARD_VIEW],
      },
    ],
  },
  {
    title: "Front Desk",
    items: [
      { label: "Patients", href: "/patients", icon: Users, permissions: [PERMISSIONS.PATIENT_VIEW] },
      { label: "Visits & Billing", href: "/billing", icon: ReceiptText, permissions: [PERMISSIONS.BILL_VIEW, PERMISSIONS.VISIT_VIEW] },
      { label: "Due Collection", href: "/dues", icon: Wallet, permissions: [PERMISSIONS.DUE_VIEW], badgeKey: "dues" },
    ],
  },
  {
    title: "Laboratory",
    items: [
      { label: "Sample Collection", href: "/sample-collection", icon: TestTube, permissions: [PERMISSIONS.SAMPLE_VIEW], badgeKey: "samples" },
      { label: "Result Entry", href: "/results", icon: FlaskConical, permissions: [PERMISSIONS.RESULT_VIEW], badgeKey: "results" },
      { label: "Approval", href: "/approval", icon: CheckCircle2, permissions: [PERMISSIONS.APPROVAL_VIEW], badgeKey: "approval" },
      { label: "Reports", href: "/reports", icon: FileText, permissions: [PERMISSIONS.REPORT_VIEW] },
      { label: "Dispatch", href: "/dispatch", icon: Send, permissions: [PERMISSIONS.DISPATCH_VIEW], badgeKey: "dispatch" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Transactions", href: "/transactions", icon: Banknote, permissions: [PERMISSIONS.TRANSACTIONS_VIEW] },
      { label: "Financial Reports", href: "/financial-reports", icon: BarChart3, permissions: [PERMISSIONS.FINANCE_REPORTS_VIEW] },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Tests", href: "/tests", icon: Beaker, permissions: [PERMISSIONS.CATALOG_VIEW] },
      { label: "Test Groups", href: "/test-groups", icon: Layers, permissions: [PERMISSIONS.CATALOG_VIEW] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Settings", href: "/settings/lab-profile", icon: Settings, permissions: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.USERS_MANAGE] },
    ],
  },
];

/** Flattened items visible to a user given their permission set. */
export function visibleNav(permissions: PermissionKey[]): NavSection[] {
  const has = (perms: PermissionKey[]) => perms.some((p) => permissions.includes(p));
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter((i) => has(i.permissions)),
  })).filter((section) => section.items.length > 0);
}
