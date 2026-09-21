import Link from "next/link";
import { cn } from "@/lib/cn";

interface BaseButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

type ButtonAsLink = BaseButtonProps & {
  href: string;
  type?: never;
  onClick?: never;
};

type ButtonAsButton = BaseButtonProps & {
  href?: undefined;
};

type ButtonProps = ButtonAsLink | ButtonAsButton;

const VARIANT_STYLES = {
  primary:
    "bg-emerald text-white hover:bg-emerald-light border border-emerald",
  secondary:
    "bg-teal text-white hover:bg-teal-light border border-teal",
  outline:
    "bg-card text-text border border-border-strong hover:border-emerald hover:text-emerald",
  ghost:
    "bg-transparent text-text-muted hover:bg-base hover:text-text border border-transparent",
  danger:
    "bg-danger text-white hover:bg-danger/90 border border-danger",
} as const;

const SIZE_STYLES = {
  sm: "px-3 py-1.5 text-meta gap-2",
  md: "px-4 py-2.5 text-default gap-2",
  lg: "px-6 py-3 text-default gap-3",
} as const;

const baseClasses =
  "inline-flex items-center justify-center rounded-chip font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none";

export default function Button(props: ButtonProps) {
  const {
    children,
    variant = "primary",
    size = "md",
    fullWidth,
    className,
    disabled,
    loading,
    type = "button",
  } = props;

  const classes = cn(
    baseClasses,
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    fullWidth && "w-full",
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        aria-disabled={disabled}
        className={cn(classes, disabled && "pointer-events-none")}
      >
        {loading ? <Spinner /> : null}
        {children}
      </Link>
    );
  }

  const onClick = "onClick" in props ? props.onClick : undefined;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-label="Loading"
    />
  );
}