import Link from "next/link";
import type { PublicPackage } from "@/lib/api/normalize";
import StatusBadge from "./StatusBadge";

const TYPE_LABELS: Record<string, string> = {
  HAJJ: "Hajj",
  RAMADAN_UMRAH: "Ramadan Umrah",
  OFF_SEASON_UMRAH: "Off-Season Umrah",
  ZIYARAH: "Ziyarah",
};

interface PackageCardProps {
  pkg: PublicPackage;
  className?: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

export default function PackageCard({ pkg, className }: PackageCardProps) {
  const minPrice = pkg.tiers.length
    ? Math.min(...pkg.tiers.map((t) => t.price))
    : 0;

  const totalAvailable = pkg.tiers.reduce(
    (sum, t) => sum + (t.availableSeats ?? 0),
    0,
  );

  return (
    <Link
      href={`/packages/${pkg.id}`}
      className={
        "group flex flex-col gap-5 rounded-card border border-border bg-card p-6 transition-all duration-200 hover:border-emerald-light hover:shadow-[0_0_24px_rgba(4,120,87,0.08)] " +
        (className ?? "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-pill border border-emerald/30 bg-emerald/10 px-2.5 py-0.5 text-meta font-semibold text-emerald">
          {TYPE_LABELS[pkg.type] ?? pkg.type}
        </span>
        <StatusBadge status={pkg.status} />
      </div>

      <h3 className="text-card-title font-semibold text-text group-hover:text-emerald transition-colors line-clamp-2">
        {pkg.name}
      </h3>

      {pkg.description && (
        <p className="text-default text-text-muted line-clamp-2 -mt-2">
          {pkg.description}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-meta text-text-subtle">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="0.5" y="1.5" width="11" height="10" rx="1.5" stroke="currentColor" />
            <path d="M0.5 4.5h11" stroke="currentColor" />
            <path d="M3 0.5v2M9 0.5v2" stroke="currentColor" strokeLinecap="round" />
          </svg>
          <span>Departs {formatDate(pkg.departureDate)}</span>
        </div>
        <div className="text-meta text-text-subtle">
          Returns {formatDate(pkg.returnDate)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {pkg.tiers.map((tier) => (
          <span
            key={tier.id}
            className="rounded-chip border border-border bg-base px-2 py-1 text-meta text-text-muted"
          >
            {tier.name} — {formatCurrency(tier.price)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
        <div>
          <div className="text-meta text-text-subtle">Starting from</div>
          <div className="text-card-title font-bold text-emerald">
            {formatCurrency(minPrice)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-meta text-text-subtle">Seats</div>
          <div
            className={`text-default font-semibold ${
              totalAvailable === 0
                ? "text-danger"
                : totalAvailable < 10
                  ? "text-warning"
                  : "text-text"
            }`}
          >
            {totalAvailable === 0 ? "Full" : `${totalAvailable} left`}
          </div>
        </div>
      </div>
    </Link>
  );
}
