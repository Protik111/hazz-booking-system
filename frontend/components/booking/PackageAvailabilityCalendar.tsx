"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { PackageAvailability } from "@/lib/api/endpoints";
import {
  formatMonthLabel,
  padIsoDate,
} from "@/lib/format";
import { buildPackagesHref } from "@/lib/booking/packagesHref";
import Spinner from "@/components/ui/Spinner";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface PackageAvailabilityCalendarProps {
  /** ISO YYYY-MM (e.g. '2026-09'). */
  month: string;
  /**
   * Calendar data for the year of `month`. Pass the data fetched on the
   * server by the page; pass `null` if the fetch failed (renders blank).
   */
  availability: PackageAvailability | null;
  /** Optional filter — drives the availability query on the server. */
  type?: string;
  /** ISO YYYY-MM-DD, optional. The date that the results list is filtered to. */
  selectedDate?: string | null;
}

interface DayCell {
  day: number;
  hasPackages: boolean;
}

export default function PackageAvailabilityCalendar({
  month,
  availability,
  type,
  selectedDate,
}: PackageAvailabilityCalendarProps) {
  const cells = useMemo<Array<DayCell | null>>(
    () => buildMonthCells(month, availability?.days ?? {}),
    [month, availability?.days],
  );

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map((s) => parseInt(s, 10));
    return formatMonthLabel(y, m - 1);
  }, [month]);

  const totalInMonth = availability?.months.find((b) => b.month === month)?.count ?? 0;

  return (
    <div className="rounded-card border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text">{monthLabel}</h3>
        <span className="text-meta text-text-muted">
          {availability == null ? (
            <Spinner size="sm" />
          ) : (
            `${totalInMonth} packages`
          )}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-meta text-text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`pad-${idx}`} aria-hidden className="h-10" />;
          const { day, hasPackages } = cell;
          const iso = padIsoDate(
            parseInt(month.slice(0, 4), 10),
            parseInt(month.slice(5, 7), 10) - 1,
            day,
          );
          const isSelected = iso === selectedDate;

          const baseClasses =
            "relative flex h-10 flex-col items-center justify-center rounded-chip text-sm transition";
          const stateClasses = isSelected
            ? "bg-emerald text-white"
            : hasPackages
              ? "text-text hover:bg-emerald/10"
              : "text-text-muted";

          if (!hasPackages && !isSelected) {
            return (
              <div key={iso} className={`${baseClasses} ${stateClasses}`}>
                <span>{day}</span>
              </div>
            );
          }

          return (
            <Link
              key={iso}
              href={buildPackagesHref({ type, day: iso })}
              className={`${baseClasses} ${stateClasses}`}
              aria-label={`Show packages departing on ${iso}`}
            >
              <span>{day}</span>
              {hasPackages && !isSelected && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-emerald"
                />
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-meta text-text-muted">
        Dots mark days with published packages. Click a dot to filter.
      </p>
    </div>
  );
}

/**
 * Returns a 6-row × 7-col grid (42 cells) of {day, hasPackages} entries,
 * padded with nulls so the calendar layout stays stable across months.
 */
function buildMonthCells(
  month: string, // 'YYYY-MM'
  daysWithPackages: Record<string, boolean>,
): Array<DayCell | null> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;

  const firstOfMonth = new Date(Date.UTC(year, monthIdx, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay(); // 0=Sun..6=Sat

  const cells: Array<DayCell | null> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = padIsoDate(year, monthIdx, d);
    cells.push({ day: d, hasPackages: Boolean(daysWithPackages[iso]) });
  }

  while (cells.length < 42) cells.push(null);
  return cells;
}
