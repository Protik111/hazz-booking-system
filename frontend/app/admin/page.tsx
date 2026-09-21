"use client";

import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  adminListBookings,
  adminListPayments,
  reportOverview,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import KpiCard from "@/components/admin/KpiCard";
import { formatBDT, formatDate } from "@/lib/format";

export default function AdminOverviewPage() {
  const { data: report, loading, error, refetch } = useApi(
    () => reportOverview(),
    [],
  );
  const { data: bookingsData } = useApi(
    () => adminListBookings({ limit: 8 }),
    [],
  );
  const { data: paymentsData } = useApi(
    () => adminListPayments({ limit: 5 }),
    [],
  );

  const recentBookings = bookingsData?.data ?? [];
  const recentPayments = paymentsData?.data ?? [];

  return (
    <>
      <PageHeader
        title="Operations overview"
        description="A live snapshot of bookings, payments, and seat inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href="/admin/packages/new" size="sm">
              New package
            </Button>
            <Button href="/admin/bookings" variant="outline" size="sm">
              All bookings
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} />
      ) : !report ? null : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total bookings"
              value={report.totalBookings}
              hint={`${report.confirmedBookings} confirmed`}
            />
            <KpiCard
              label="Collected"
              value={formatBDT(report.totalCollected)}
              tone="success"
            />
            <KpiCard
              label="Outstanding"
              value={formatBDT(report.totalOutstanding)}
              tone={
                report.totalOutstanding > 0 ? "warning" : "neutral"
              }
            />
            <KpiCard
              label="Refunded"
              value={formatBDT(report.totalRefunded)}
              hint={`${report.overdueInstallments} overdue installments`}
            />
            <KpiCard
              label="Available seats"
              value={report.availableSeats}
              tone="success"
            />
            <KpiCard
              label="Held seats"
              value={report.heldSeats}
              hint="Awaiting payment confirmation"
              tone="warning"
            />
            <KpiCard
              label="Confirmed seats"
              value={report.confirmedSeats}
              tone="success"
            />
            <KpiCard
              label="Overdue installments"
              value={report.overdueInstallments}
              tone={report.overdueInstallments > 0 ? "danger" : "neutral"}
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-card-title font-semibold text-text">
                  Recent bookings
                </h2>
                <Link
                  href="/admin/bookings"
                  className="text-meta font-medium text-emerald hover:underline"
                >
                  View all →
                </Link>
              </div>
              {recentBookings.length === 0 ? (
                <EmptyState
                  title="No bookings yet"
                  description="Pilgrims haven't started booking yet."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recentBookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-default font-semibold text-text hover:text-emerald"
                        >
                          {b.package?.name ?? "Booking"}
                        </Link>
                        <p className="text-meta text-text-subtle">
                          {b.bookingNumber} · {b.pilgrimCount} pilgrim
                          {b.pilgrimCount !== 1 ? "s" : ""}
                          {b.package?.departureDate
                            ? ` · departs ${formatDate(b.package.departureDate)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-default font-semibold text-text">
                          {formatBDT(b.totalAmount)}
                        </span>
                        <StatusBadge status={b.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-card-title font-semibold text-text">
                  Recent payments
                </h2>
                <Link
                  href="/admin/payments"
                  className="text-meta font-medium text-emerald hover:underline"
                >
                  View all →
                </Link>
              </div>
              {recentPayments.length === 0 ? (
                <EmptyState title="No payments yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {recentPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="text-default font-semibold text-text">
                          {formatBDT(p.amount)}
                        </p>
                        <p className="text-meta text-text-subtle">
                          {p.method} ·{" "}
                          {p.paymentDate
                            ? formatDate(p.paymentDate)
                            : formatDate(p.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
