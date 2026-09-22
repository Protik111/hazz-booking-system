import { cn } from "@/lib/cn";

type AnyStatus =
  | "PENDING"
  | "PENDING_PAYMENT"
  | "PARTIALLY_PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "DEFAULTED"
  | "COMPLETED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "PAID"
  | "OVERDUE"
  | "REQUESTED"
  | "MATCHED"
  | "MISMATCH"
  | "RESOLVED"
  | "DRAFT"
  | "PUBLISHED"
  | "CLOSED"
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "WINDOW_OPEN"
  | "WINDOW_UPCOMING"
  | "WINDOW_CLOSED"
  | string;

const STATUS_STYLES: Record<string, string> = {
  // Booking
  PENDING: "bg-warning-bg text-warning border-warning/30",
  PENDING_PAYMENT: "bg-warning-bg text-warning border-warning/30",
  PARTIALLY_PAID: "bg-info-bg text-info border-info/30",
  CONFIRMED: "bg-success-bg text-success border-success/30",
  EXPIRED: "bg-base text-text-subtle border-border-strong",
  CANCELLED: "bg-danger-bg text-danger border-danger/30",
  DEFAULTED: "bg-danger-bg text-danger border-danger/30",
  COMPLETED: "bg-success-bg text-success border-success/30",
  // Installment
  PAID: "bg-success-bg text-success border-success/30",
  OVERDUE: "bg-danger-bg text-danger border-danger/30",
  // Payment
  PROCESSING: "bg-info-bg text-info border-info/30",
  SUCCESS: "bg-success-bg text-success border-success/30",
  FAILED: "bg-danger-bg text-danger border-danger/30",
  // Cancellation / Refund
  REQUESTED: "bg-warning-bg text-warning border-warning/30",
  APPROVED: "bg-success-bg text-success border-success/30",
  REJECTED: "bg-danger-bg text-danger border-danger/30",
  // Manual Payment
  PENDING_APPROVAL: "bg-warning-bg text-warning border-warning/30",
  // Reconciliation
  MATCHED: "bg-success-bg text-success border-success/30",
  MISMATCH: "bg-danger-bg text-danger border-danger/30",
  RESOLVED: "bg-info-bg text-info border-info/30",
  // Package
  DRAFT: "bg-base text-text-subtle border-border-strong",
  PUBLISHED: "bg-success-bg text-success border-success/30",
  CLOSED: "bg-base text-text-subtle border-border-strong",
  // User status
  ACTIVE: "bg-success-bg text-success border-success/30",
  INACTIVE: "bg-base text-text-subtle border-border-strong",
  SUSPENDED: "bg-danger-bg text-danger border-danger/30",
  // Booking window (derived from package.booking_start / booking_end)
  WINDOW_OPEN: "bg-success-bg text-success border-success/30",
  WINDOW_UPCOMING: "bg-warning-bg text-warning border-warning/30",
  WINDOW_CLOSED: "bg-danger-bg text-danger border-danger/30",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PENDING_PAYMENT: "Pending Payment",
  PARTIALLY_PAID: "Partially Paid",
  CONFIRMED: "Confirmed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  DEFAULTED: "Defaulted",
  COMPLETED: "Completed",
  PAID: "Paid",
  OVERDUE: "Overdue",
  PROCESSING: "Processing",
  SUCCESS: "Success",
  FAILED: "Failed",
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PENDING_APPROVAL: "Pending Approval",
  MATCHED: "Matched",
  MISMATCH: "Mismatch",
  RESOLVED: "Resolved",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  CLOSED: "Closed",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
  WINDOW_OPEN: "Booking open",
  WINDOW_UPCOMING: "Opens soon",
  WINDOW_CLOSED: "Window closed",
};

interface StatusBadgeProps {
  status: AnyStatus;
  /** Optional override for the displayed text. Falls back to STATUS_LABELS lookup. */
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const style =
    STATUS_STYLES[status] ?? "bg-base text-text-subtle border-border-strong";
  const text = label ?? STATUS_LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-meta font-medium",
        style,
        className,
      )}
    >
      {text}
    </span>
  );
}
