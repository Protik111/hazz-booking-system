import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "rounded-chip border bg-card px-3.5 py-2.5 text-default text-text placeholder:text-text-subtle focus:outline-none transition-colors",
          error
            ? "border-danger focus:border-danger"
            : "border-border focus:border-emerald",
          className,
        )}
        {...props}
      />
      {error && <p className="text-meta text-danger">{error}</p>}
      {hint && !error && <p className="text-meta text-text-subtle">{hint}</p>}
    </div>
  );
}
