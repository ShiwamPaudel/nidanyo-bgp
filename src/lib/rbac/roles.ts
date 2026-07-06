import { PERMISSIONS as P, ALL_PERMISSIONS, type PermissionKey } from "./permissions";

export type RoleKey =
  | "super_admin"
  | "lab_admin"
  | "reception"
  | "sample_collection"
  | "lab_technician"
  | "pathologist"
  | "accounts"
  | "dispatch";

export interface RoleSeed {
  key: RoleKey;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[];
}

/**
 * Standard roles seeded for every lab. Permissions follow the spec's
 * role-to-module mapping. Super Admin / Lab Admin get everything.
 */
export const DEFAULT_ROLES: RoleSeed[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Product administrator — full access across the system.",
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "lab_admin",
    name: "Lab Admin",
    description: "Full access within the laboratory.",
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "reception",
    name: "Reception / Billing",
    description: "Registration, visits, billing, payments and dues.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.PATIENT_MANAGE,
      P.VISIT_VIEW,
      P.VISIT_CREATE,
      P.VISIT_CANCEL,
      P.BILL_VIEW,
      P.BILL_MANAGE,
      P.PAYMENT_RECEIVE,
      P.DUE_VIEW,
      P.DUE_COLLECT,
      P.CATALOG_VIEW,
      P.REPORT_VIEW,
    ],
  },
  {
    key: "sample_collection",
    name: "Sample Collection",
    description: "Sample queue, accessioning and specimen handling.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.VISIT_VIEW,
      P.SAMPLE_VIEW,
      P.SAMPLE_MANAGE,
    ],
  },
  {
    key: "lab_technician",
    name: "Lab Technician",
    description: "Result entry and submission for approval.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.VISIT_VIEW,
      P.SAMPLE_VIEW,
      P.RESULT_VIEW,
      P.RESULT_ENTER,
    ],
  },
  {
    key: "pathologist",
    name: "Doctor / Pathologist",
    description: "Review, approve and sign results.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.VISIT_VIEW,
      P.RESULT_VIEW,
      P.APPROVAL_VIEW,
      P.APPROVAL_ACT,
      P.REPORT_VIEW,
    ],
  },
  {
    key: "accounts",
    name: "Accounts",
    description: "Payments, dues, EOD and financial reports.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.VISIT_VIEW,
      P.BILL_VIEW,
      P.PAYMENT_RECEIVE,
      P.DUE_VIEW,
      P.DUE_COLLECT,
      P.TRANSACTIONS_VIEW,
      P.FINANCE_REPORTS_VIEW,
      P.FINANCE_EXPORT,
    ],
  },
  {
    key: "dispatch",
    name: "Dispatch",
    description: "Dispatch approved and cleared reports.",
    isSystem: true,
    permissions: [
      P.DASHBOARD_VIEW,
      P.PATIENT_VIEW,
      P.VISIT_VIEW,
      P.REPORT_VIEW,
      P.DISPATCH_VIEW,
      P.DISPATCH_ACT,
      P.SMS_SEND,
    ],
  },
];

export const ROLE_LABELS: Record<RoleKey, string> = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r.key, r.name]),
) as Record<RoleKey, string>;
