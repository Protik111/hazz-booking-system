import { cn } from "@/lib/utils";

/**
 * Skeleton primitive — a pulsing neutral block used as a placeholder while
 * data is loading. Pair with `TableSkeleton` (below) for list/table views to
 * eliminate layout shift / "shake" between loading and loaded states.
 *
 * Uses the `.skeleton` shimmer animation defined in `app/globals.css`.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
