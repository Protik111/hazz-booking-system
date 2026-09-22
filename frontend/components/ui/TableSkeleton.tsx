import { Skeleton } from "./Skeleton";
import Card from "./Card";

interface TableSkeletonProps {
  /**
   * How many columns the actual table renders. Each skeleton cell stretches
   * to fill its grid track, so the columns stay the same width whether the
   * placeholder or the real data is on screen — that is what stops the
   * "table shake" between loading and loaded states.
   */
  columns: number;
  /**
   * How many skeleton rows to render. Defaults to 10.
   */
  rows?: number;
  /**
   * Pixel widths (Tailwind classes or arbitrary values) for each column's
   * skeleton bar. Lets us mimic a varied real layout (e.g. a wide name,
   * a small amount column). Defaults to all `w-full`.
   */
  columnWidths?: string[];
  /**
   * Optional extra class names on the wrapping Card.
   */
  className?: string;
}

/**
 * A skeleton loader shaped exactly like a real table — same column count,
 * same row count, same overall height. Renders inside the same Card wrapper
 * the real table uses, so swapping `loading` for `data` causes zero layout
 * shift and zero perceived "shake".
 *
 * Use:
 *   <TableSkeleton columns={7} columnWidths={["w-24", "w-32", "w-48", "w-12", "w-20", "w-20", "w-24"]} />
 */
export default function TableSkeleton({
  columns,
  rows = 10,
  columnWidths,
  className,
}: TableSkeletonProps) {
  const widths =
    columnWidths ?? Array.from({ length: columns }, () => "w-full");

  return (
    <Card className={`overflow-hidden p-0 ${className ?? ""}`}>
      <div className="w-full">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-border bg-base px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={`h-${i}`} className="flex-1">
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            {Array.from({ length: columns }).map((__, c) => (
              <div key={`c-${r}-${c}`} className="flex-1">
                <Skeleton className={widths[c] ?? "w-full"} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
