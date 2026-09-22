/**
 * Small display-time formatters. All accept potentially-bad input (missing
 * strings, NaN money) and return a placeholder rather than throwing.
 */

export function formatBDT(amount: number | string | null | undefined): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount ?? "0"));
  if (!Number.isFinite(n)) return "৳0";
  return `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatNumber(n: number | null | undefined, fallback = "—"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return fallback;
  return n.toLocaleString("en-BD");
}

// ─── Calendar / month helpers ──────────────────────────────────────────────
//
// Dates in this app are typed as `YYYY-MM-DD` (a single day) or `YYYY-MM`
// (a month). All helpers below do their math in UTC so SSR output matches the
// client exactly regardless of the viewer's timezone.

/** `YYYY-MM-DD` for a given UTC year / 0-based month / 1-based day. */
export function padIsoDate(year: number, monthIdx: number, day: number): string {
  return `${year}-${pad2(monthIdx + 1)}-${pad2(day)}`;
}

/** Last calendar day of the given (year, 0-based month) as `YYYY-MM-DD`. */
export function lastDayOfMonthIso(year: number, monthIdx: number): string {
  return padIsoDate(year, monthIdx, new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate());
}

/** First day of the month as `YYYY-MM-DD`. */
export function firstDayOfMonthIso(year: number, monthIdx: number): string {
  return padIsoDate(year, monthIdx, 1);
}

/** `YYYY-MM` for a given UTC year / 0-based month. */
export function monthKey(year: number, monthIdx: number): string {
  return `${year}-${pad2(monthIdx + 1)}`;
}

/** Parse `YYYY-MM-DD` (or `YYYY-MM`) into {year, monthIdx}. Returns null if invalid. */
export function parseMonthFromIso(iso: string | null | undefined): { year: number; monthIdx: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const monthIdx = parseInt(m[2], 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return null;
  }
  return { year, monthIdx };
}

/** Long month + year label, e.g. "September 2026" (locale-pinned for SSR safety). */
export function formatMonthLabel(year: number, monthIdx: number): string {
  return new Date(Date.UTC(year, monthIdx, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}