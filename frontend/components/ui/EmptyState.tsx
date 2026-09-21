import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-border bg-card p-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="text-text-subtle" aria-hidden>
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-card-title font-semibold text-text">{title}</h3>
        {description && (
          <p className="max-w-md text-default text-text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}