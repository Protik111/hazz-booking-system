"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { listBookings, listPayments } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { formatBDT, formatDateTime } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  VISA: "Visa",
  MANUAL_BRANCH: "Manual (branch)",
};

const METHOD_COLOR: Record<string, string> = {
  BKASH: "bg-pink-50 text-pink-700 border-pink-200",
  NAGAD: "bg-orange-50 text-orange-700 border-orange-200",
  VISA: "bg-indigo-50 text-indigo-700 border-indigo-200",
  MANUAL_BRANCH: "bg-base text-text-muted border-border-strong",
};

export default function PaymentsListPage() {
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () => listPayments({ page, limit: 10 }),
    [page],
  );

  // Bookings are only needed to enrich the table rows with booking numbers.
  // Skip the fetch entirely when there are no payments yet — most users hit
  // this page in their first session before making any payment.
  const payments = data?.data ?? [];
  const meta = data?.meta;
  const needsBookingLookup = payments.length > 0;
  const { data: bookings } = useApi(
    () =>
      needsBookingLookup
        ? listBookings({ limit: 50 })
        : Promise.resolve(null),
    // Re-fetch only when we transition from "no payments" → "has payments".
    [needsBookingLookup],
  );
  const bookingsById = new Map(
    (bookings?.data ?? []).map((b) => [b.id, b]),
  );

  // Count which bookings still owe money so the CTA can prompt users to pay.
  const unpaidBookingCount = (bookings?.data ?? []).filter(
    (b) => b.amountOutstanding > 0 && b.status !== "CANCELLED" && b.status !== "EXPIRED",
  ).length;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every payment you've made — gateways, statuses, and references."
        actions={
          <Button href="/dashboard/payments/new" size="sm">
            New payment
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3" />

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} className="mt-6" />
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description={
            unpaidBookingCount > 0
              ? `You have ${unpaidBookingCount} booking${unpaidBookingCount === 1 ? "" : "s"} with an outstanding balance.`
              : "Once you pay for a booking, the receipt will show up here."
          }
          action={
            unpaidBookingCount > 0 ? (
              <Button href="/dashboard/bookings">View bookings</Button>
            ) : (
              <Button href="/packages">Browse packages</Button>
            )
          }
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => {
                  const booking = bookingsById.get(p.bookingId);
                  return (
                    <tr key={p.id} className="hover:bg-base">
                      <td className="px-4 py-3 text-text-muted">
                        {p.paymentDate
                          ? formatDateTime(p.paymentDate)
                          : formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {booking ? (
                          <Link
                            href={`/dashboard/bookings/${booking.id}`}
                            className="font-mono text-meta font-medium text-text hover:text-emerald"
                          >
                            {booking.bookingNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-meta text-text-subtle">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-meta font-medium ${
                            METHOD_COLOR[p.method] ??
                            "bg-base text-text-muted border-border-strong"
                          }`}
                        >
                          {METHOD_LABEL[p.method] ?? p.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text">
                        {formatBDT(p.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono text-meta text-text-muted">
                        {p.gatewayTransactionId ?? p.gatewayReference ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {meta && (
            <div className="mt-6">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}
