import { Skeleton } from "./Skeleton";

interface KpiGridSkeletonProps {
  /** Number of KPI tiles to render. */
  count?: number;
  className?: string;
}

/**
 * Placeholder grid for KPI/tile-based dashboards. Renders `count` neutral
 * cards in a responsive grid that matches the real layout, so swapping to
 * the loaded view causes no layout shift.
 */
export default function KpiGridSkeleton({
  count = 4,
  className,
}: KpiGridSkeletonProps) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className ?? ""}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`k-${i}`}
          className="rounded-card border border-border bg-card p-6"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
