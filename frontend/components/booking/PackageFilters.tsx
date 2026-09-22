"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import type { PackageAvailability, RawPackageType } from "@/lib/api/endpoints";
import {
  firstDayOfMonthIso,
  lastDayOfMonthIso,
  parseMonthFromIso,
} from "@/lib/format";
import { buildPackagesHref } from "@/lib/booking/packagesHref";

const TYPE_OPTIONS: Array<{ value: RawPackageType; label: string }> = [
  { value: "HAJJ", label: "Hajj" },
  { value: "RAMADAN_UMRAH", label: "Ramadan Umrah" },
  { value: "OFF_SEASON_UMRAH", label: "Off-Season Umrah" },
  { value: "ZIYARAH", label: "Ziyarah" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface PackageFiltersProps {
  /** Pre-fetched on the server by the page. Null when the call failed. */
  availability: PackageAvailability | null;
  /** Current values, lifted from the URL by the page. */
  currentType: string;
  currentFrom: string;
}

export default function PackageFilters({
  availability,
  currentType,
  currentFrom,
}: PackageFiltersProps) {
  const router = useRouter();

  const focused = useMemo(() => {
    const parsed = parseMonthFromIso(currentFrom);
    const now = new Date();
    return {
      year: parsed?.year ?? now.getUTCFullYear(),
      monthIdx: parsed?.monthIdx ?? null,
    };
  }, [currentFrom]);

  const monthOptions = useMemo(
    () =>
      MONTH_NAMES.map((name, idx) => {
        const bucket = availability?.months.find(
          (m) => parseInt(m.month.slice(5, 7), 10) - 1 === idx,
        );
        const count = bucket?.count ?? 0;
        return {
          value: String(idx),
          label: count > 0 ? `${name} (${count})` : `${name}`,
        };
      }),
    [availability],
  );

  function pushFilters(next: { type?: string; from?: string; to?: string }) {
    router.push(
      buildPackagesHref({
        type: next.type !== undefined ? next.type : currentType || undefined,
        from: next.from,
        to: next.to,
      }),
    );
  }

  function updateType(value: string) {
    pushFilters({ type: value, from: currentFrom });
  }

  function updateMonth(monthIdx: number | null) {
    if (monthIdx === null) {
      pushFilters({ from: undefined, to: undefined });
      return;
    }
    pushFilters({
      from: firstDayOfMonthIso(focused.year, monthIdx),
      to: lastDayOfMonthIso(focused.year, monthIdx),
    });
  }

  function shiftYear(delta: number) {
    // Preserve the focused month across year jumps; default to January if no
    // month filter is currently set.
    const monthIdx = focused.monthIdx ?? 0;
    pushFilters({
      from: firstDayOfMonthIso(focused.year + delta, monthIdx),
      to: lastDayOfMonthIso(focused.year + delta, monthIdx),
    });
  }

  function clearAll() {
    router.push(buildPackagesHref({}));
  }

  const hasFilters = Boolean(currentType || currentFrom);

  return (
    <div className="mt-6 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <Select
            id="type-filter"
            label="Package type"
            value={currentType}
            onChange={(e) => updateType(e.target.value)}
            options={TYPE_OPTIONS}
            placeholder="All types"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            id="month-filter"
            label="Departure month"
            value={focused.monthIdx !== null ? String(focused.monthIdx) : ""}
            onChange={(e) =>
              updateMonth(e.target.value === "" ? null : parseInt(e.target.value, 10))
            }
            options={monthOptions}
            placeholder="Any month"
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => shiftYear(-1)}
            aria-label="Previous year"
          >
            ← {focused.year - 1}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => shiftYear(1)}
            aria-label="Next year"
          >
            {focused.year + 1} →
          </Button>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
