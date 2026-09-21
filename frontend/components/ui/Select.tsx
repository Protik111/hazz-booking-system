import { cn } from "@/lib/cn";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export default function Select({
  label,
  error,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
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
      <select
        id={id}
        className={cn(
          "rounded-chip border bg-card px-3.5 py-2.5 text-default text-text focus:outline-none transition-colors appearance-none cursor-pointer",
          error
            ? "border-danger focus:border-danger"
            : "border-border focus:border-emerald",
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-meta text-danger">{error}</p>}
    </div>
  );
}
