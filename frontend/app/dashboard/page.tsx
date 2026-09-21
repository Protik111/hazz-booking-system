"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { listBookings } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import { formatBDT } from "@/lib/format";

export default function DashboardOverviewPage() {
  const { data, loading, error, refetch } = useApi(
    () => listBookings({ limit: 5 }),
    [],
  );

  const bookings = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Your bookings at a glance."
        actions={
          <Button href="/packages" size="sm">
            Browse packages
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Start by browsing available Hajj & Umrah packages."
          action={
            <Button href="/packages" size="md">
              Browse packages
            </Button>
          }
        />
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryStat
              label="Active bookings"
              value={String(
                bookings.filter(
                  (b) =>
                    b.status === "PENDING" ||
                    b.status === "PARTIALLY_PAID" ||
                    b.status === "CONFIRMED",
                ).length,
              )}
            />
            <SummaryStat
              label="Total spent"
              value={formatBDT(
                bookings.reduce((s, b) => s + b.amountReceived, 0),
              )}
            />
            <SummaryStat
              label="Outstanding"
              value={formatBDT(
                bookings.reduce((s, b) => s + b.amountOutstanding, 0),
              )}
            />
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-card-title font-semibold text-text">
                Recent bookings
              </h2>
              <Link
                href="/dashboard/bookings"
                className="text-default font-medium text-emerald hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/dashboard/bookings/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-base px-2 -mx-2 rounded transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-default font-semibold text-text">
                      {b.package?.name ?? "Booking"}
                    </span>
                    <span className="text-meta text-text-subtle">
                      {b.bookingNumber} ·{" "}
                      {b.pilgrimCount} pilgrim
                      {b.pilgrimCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-default font-semibold text-text">
                      {formatBDT(b.totalAmount)}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-meta uppercase tracking-[0.04em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 text-section font-bold text-text">{value}</div>
    </Card>
  );
}