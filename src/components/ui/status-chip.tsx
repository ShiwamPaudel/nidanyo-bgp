import { Badge, type BadgeProps } from "./badge";

type Tone = NonNullable<BadgeProps["tone"]>;

/** Centralized, human-friendly mapping of workflow statuses to label + tone. */
const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Visit
  registered: { label: "Registered", tone: "info" },
  sample_pending: { label: "Sample pending", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  result_pending: { label: "Result pending", tone: "warning" },
  awaiting_approval: { label: "Awaiting approval", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  dispatched: { label: "Dispatched", tone: "brand" },
  cancelled: { label: "Cancelled", tone: "danger" },

  // Payment
  unpaid: { label: "Unpaid", tone: "danger" },
  partial: { label: "Partially paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "neutral" },

  // Sample
  waiting: { label: "Waiting for collection", tone: "warning" },
  collected: { label: "Collected", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  recollection: { label: "Recollection required", tone: "danger" },
  sent_to_lab: { label: "Sent to lab", tone: "info" },
  processing: { label: "Processing", tone: "info" },
  completed: { label: "Completed", tone: "success" },

  // Result
  pending: { label: "Pending result", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Awaiting approval", tone: "warning" },
  correction_required: { label: "Correction required", tone: "danger" },

  // Per-test
  ordered: { label: "Ordered", tone: "neutral" },
  sample_collected: { label: "Collected", tone: "info" },
  result_draft: { label: "Draft", tone: "neutral" },
  result_submitted: { label: "Submitted", tone: "warning" },

  // Flags
  normal: { label: "Normal", tone: "success" },
  low: { label: "Low", tone: "warning" },
  high: { label: "High", tone: "warning" },
  critical_low: { label: "Critical low", tone: "danger" },
  critical_high: { label: "Critical high", tone: "danger" },
  abnormal: { label: "Abnormal", tone: "warning" },

  // SMS
  queued: { label: "Queued", tone: "neutral" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  active: { label: "Active", tone: "success" },
};

export function StatusChip({
  status,
  fallbackLabel,
  className,
}: {
  status: string;
  fallbackLabel?: string;
  className?: string;
}) {
  const entry = STATUS_MAP[status] ?? {
    label: fallbackLabel ?? status.replace(/_/g, " "),
    tone: "neutral" as Tone,
  };
  return (
    <Badge tone={entry.tone} dot className={className}>
      {entry.label}
    </Badge>
  );
}
