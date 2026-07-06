/**
 * Central permission registry. Permissions are simple string keys grouped by
 * module. Roles hold an array of these keys. UI navigation and server actions
 * both consult this list so access stays consistent.
 */

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: "dashboard.view",

  // Patients
  PATIENT_VIEW: "patient.view",
  PATIENT_MANAGE: "patient.manage",

  // Visits & billing
  VISIT_VIEW: "visit.view",
  VISIT_CREATE: "visit.create",
  VISIT_CANCEL: "visit.cancel",
  BILL_VIEW: "bill.view",
  BILL_MANAGE: "bill.manage",
  PAYMENT_RECEIVE: "payment.receive",

  // Dues
  DUE_VIEW: "due.view",
  DUE_COLLECT: "due.collect",

  // Sample collection
  SAMPLE_VIEW: "sample.view",
  SAMPLE_MANAGE: "sample.manage",

  // Results
  RESULT_VIEW: "result.view",
  RESULT_ENTER: "result.enter",

  // Approval
  APPROVAL_VIEW: "approval.view",
  APPROVAL_ACT: "approval.act",

  // Reports & dispatch
  REPORT_VIEW: "report.view",
  DISPATCH_VIEW: "dispatch.view",
  DISPATCH_ACT: "dispatch.act",

  // Finance
  TRANSACTIONS_VIEW: "transactions.view",
  FINANCE_REPORTS_VIEW: "finance.reports.view",
  FINANCE_EXPORT: "finance.export",

  // Catalog (tests/groups)
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",

  // Settings & admin
  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  AUDIT_VIEW: "audit.view",

  // SMS
  SMS_SEND: "sms.send",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

/** Human-friendly grouping for the roles editor UI. */
export const PERMISSION_GROUPS: { label: string; items: { key: PermissionKey; label: string }[] }[] = [
  {
    label: "Dashboard",
    items: [{ key: PERMISSIONS.DASHBOARD_VIEW, label: "View dashboard" }],
  },
  {
    label: "Patients",
    items: [
      { key: PERMISSIONS.PATIENT_VIEW, label: "View patients" },
      { key: PERMISSIONS.PATIENT_MANAGE, label: "Create / edit patients" },
    ],
  },
  {
    label: "Visits & Billing",
    items: [
      { key: PERMISSIONS.VISIT_VIEW, label: "View visits" },
      { key: PERMISSIONS.VISIT_CREATE, label: "Create visits" },
      { key: PERMISSIONS.VISIT_CANCEL, label: "Cancel / void visits" },
      { key: PERMISSIONS.BILL_VIEW, label: "View bills" },
      { key: PERMISSIONS.BILL_MANAGE, label: "Create / edit bills" },
      { key: PERMISSIONS.PAYMENT_RECEIVE, label: "Receive payments" },
    ],
  },
  {
    label: "Dues",
    items: [
      { key: PERMISSIONS.DUE_VIEW, label: "View dues" },
      { key: PERMISSIONS.DUE_COLLECT, label: "Collect dues" },
    ],
  },
  {
    label: "Sample Collection",
    items: [
      { key: PERMISSIONS.SAMPLE_VIEW, label: "View sample queue" },
      { key: PERMISSIONS.SAMPLE_MANAGE, label: "Collect / reject samples" },
    ],
  },
  {
    label: "Results",
    items: [
      { key: PERMISSIONS.RESULT_VIEW, label: "View results" },
      { key: PERMISSIONS.RESULT_ENTER, label: "Enter / submit results" },
    ],
  },
  {
    label: "Approval",
    items: [
      { key: PERMISSIONS.APPROVAL_VIEW, label: "View approval queue" },
      { key: PERMISSIONS.APPROVAL_ACT, label: "Approve / send back" },
    ],
  },
  {
    label: "Reports & Dispatch",
    items: [
      { key: PERMISSIONS.REPORT_VIEW, label: "View reports" },
      { key: PERMISSIONS.DISPATCH_VIEW, label: "View dispatch queue" },
      { key: PERMISSIONS.DISPATCH_ACT, label: "Dispatch reports" },
      { key: PERMISSIONS.SMS_SEND, label: "Send / resend SMS" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: PERMISSIONS.TRANSACTIONS_VIEW, label: "View transactions" },
      { key: PERMISSIONS.FINANCE_REPORTS_VIEW, label: "View financial reports" },
      { key: PERMISSIONS.FINANCE_EXPORT, label: "Export finance data" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { key: PERMISSIONS.CATALOG_VIEW, label: "View tests & groups" },
      { key: PERMISSIONS.CATALOG_MANAGE, label: "Manage tests & groups" },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: PERMISSIONS.SETTINGS_VIEW, label: "View settings" },
      { key: PERMISSIONS.SETTINGS_MANAGE, label: "Manage settings" },
      { key: PERMISSIONS.USERS_MANAGE, label: "Manage users" },
      { key: PERMISSIONS.ROLES_MANAGE, label: "Manage roles" },
      { key: PERMISSIONS.AUDIT_VIEW, label: "View audit logs" },
    ],
  },
];
