import { Skeleton } from "./Skeleton";

interface CardSkeletonProps {
  /** Number of stacked rows of skeleton lines inside the card. */
  rows?: number;
  /** Show a header strip at the top of the card. */
  withHeader?: boolean;
  className?: string;
}

/**
 * Generic content-card placeholder — same border/padding as the real card,
 * with neutral skeleton bars where the title and body would be.
 */
export default function CardSkeleton({
  rows = 3,
  withHeader = true,
  className,
}: CardSkeletonProps) {
  return (
    <div
      className={`rounded-card border border-border bg-card p-6 ${className ?? ""}`}
    >
      {withHeader && <Skeleton className="mb-4 h-4 w-32" />}
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton
            key={i}
            className={i === rows - 1 ? "h-3 w-2/3" : "h-3 w-full"}
          />
        ))}
      </div>
    </div>
  );
}
