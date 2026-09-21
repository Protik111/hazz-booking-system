import { cn } from "@/lib/cn";

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = "Something went wrong",
  message,
  retry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-danger/30 bg-danger-bg p-8 text-center",
        className,
      )}
      role="alert"
    >
      <h3 className="text-card-title font-semibold text-danger">{title}</h3>
      <p className="max-w-md text-default text-text-muted">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="rounded-chip border border-danger/40 px-4 py-2 text-default font-medium text-danger hover:bg-danger hover:text-white transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}