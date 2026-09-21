import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}

const TONE_STYLES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  neutral: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export default function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("space-y-1", className)}>
      <p className="text-meta uppercase tracking-[0.06em] text-text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "text-section font-bold",
          TONE_STYLES[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="text-meta text-text-subtle">{hint}</p>}
    </Card>
  );
}
