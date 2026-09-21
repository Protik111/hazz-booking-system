import Link from "next/link";
import { notFound } from "next/navigation";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import { getPackage } from "@/lib/api/endpoints";
import { formatBDT, formatDate, formatNumber } from "@/lib/format";

interface PackageDetailProps {
  params: Promise<{ id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  HAJJ: "Hajj",
  RAMADAN_UMRAH: "Ramadan Umrah",
  OFF_SEASON_UMRAH: "Off-Season Umrah",
  ZIYARAH: "Ziyarah",
};

export default async function PackageDetailPage({ params }: PackageDetailProps) {
  const { id } = await params;

  let pkg: Awaited<ReturnType<typeof getPackage>> | null = null;
  let error: string | null = null;

  try {
    pkg = await getPackage(id);
  } catch (err) {
    if (err instanceof Error && /not found/i.test(err.message)) {
      notFound();
    }
    error = err instanceof Error ? err.message : "Failed to load package";
  }

  if (!pkg) {
    return (
      <Container size="md" className="py-16">
        <Card>
          <h1 className="text-page-title font-bold text-text">
            {error ?? "Package not found"}
          </h1>
          <p className="mt-3 text-default text-text-muted">
            We couldn&apos;t find the package you&apos;re looking for.
          </p>
          <div className="mt-6">
            <Button href="/packages" variant="outline">
              Back to packages
            </Button>
          </div>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" className="py-10">
      <Link
        href="/packages"
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to packages
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-pill border border-emerald/30 bg-emerald/10 px-2.5 py-0.5 text-meta font-semibold text-emerald">
              {TYPE_LABELS[pkg.type] ?? pkg.type}
            </span>
            <StatusBadge status={pkg.status} />
          </div>
          <h1 className="text-page-title font-bold text-text">{pkg.name}</h1>
          {pkg.description && (
            <p className="mt-3 max-w-3xl text-default text-text-muted">
              {pkg.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-card-title font-semibold text-text">
            Trip details
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-default sm:grid-cols-4">
            <DetailItem label="Departure" value={formatDate(pkg.departureDate)} />
            <DetailItem label="Return" value={formatDate(pkg.returnDate)} />
            <DetailItem
              label="Booking opens"
              value={formatDate(pkg.bookingStart)}
            />
            <DetailItem
              label="Booking closes"
              value={formatDate(pkg.bookingEnd)}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="text-card-title font-semibold text-text">
            Ready to book?
          </h2>
          <p className="mt-2 text-default text-text-muted">
            Reserve seats instantly — your seats are held while you add
            travelers and pay.
          </p>
          <div className="mt-4">
            <Button href={`/dashboard/bookings/new?packageId=${pkg.id}`} fullWidth>
              Start booking
            </Button>
            {!pkg.tiers.some((t) => t.availableSeats > 0) && (
              <p className="mt-3 text-center text-meta text-danger">
                All tiers are currently full.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-section font-bold text-text">Available tiers</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pkg.tiers.map((tier) => {
            const available = tier.availableSeats;
            const soldOut = available === 0;
            const low = !soldOut && available < 10;
            return (
              <Card key={tier.id} className={soldOut ? "opacity-60" : ""}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-card-title font-semibold text-text">
                    {tier.name}
                  </h3>
                  <span className="text-meta text-text-subtle">
                    {tier.currency}
                  </span>
                </div>
                <div className="mt-2 text-section font-bold text-emerald">
                  {formatBDT(tier.price)}
                  <span className="ml-1 text-meta font-normal text-text-subtle">
                    / pilgrim
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span
                    className={`text-default font-medium ${
                      soldOut
                        ? "text-danger"
                        : low
                          ? "text-warning"
                          : "text-text"
                    }`}
                  >
                    {soldOut ? "Full" : `${formatNumber(available)} left`}
                  </span>
                  <span className="text-meta text-text-subtle">
                    of {formatNumber(tier.totalQuota)}
                  </span>
                </div>
                {!soldOut && (
                  <Link
                    href={`/dashboard/bookings/new?packageId=${pkg.id}&tierId=${tier.id}`}
                    className="mt-4 block rounded-chip bg-emerald px-4 py-2 text-center text-default font-semibold text-white hover:bg-emerald-light transition-colors"
                  >
                    Book this tier
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Container>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-meta uppercase tracking-[0.04em] text-text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-default font-semibold text-text">{value}</dd>
    </div>
  );
}