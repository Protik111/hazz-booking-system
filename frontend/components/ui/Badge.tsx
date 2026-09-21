import { cn } from "@/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}

const TONE_STYLES = {
  default: "bg-base text-text-muted border-border-strong",
  neutral: "bg-base text-text-muted border-border-strong",
  success: "bg-success-bg text-success border-success/30",
  warning: "bg-warning-bg text-warning border-warning/30",
  danger: "bg-danger-bg text-danger border-danger/30",
  info: "bg-info-bg text-info border-info/30",
} as const;

export default function Badge({
  children,
  tone = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-meta font-semibold uppercase tracking-[0.04em]",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}