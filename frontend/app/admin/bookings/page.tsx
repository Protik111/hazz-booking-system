"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { adminListBookings } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { formatBDT, formatDate } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

export default function AdminBookingsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () => adminListBookings({ status: status || undefined, page, limit: 15 }),
    [status, page],
  );

  const bookings = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="All bookings"
        description="Every booking across the platform."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} className="mt-6" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={
            status ? `No bookings with status "${status}".` : "Nothing yet."
          }
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-right">Travelers</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-base">
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="hover:text-emerald"
                      >
                        {b.bookingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text-subtle">
                      {b.userId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">
                        {b.package?.name ?? "—"}
                      </div>
                      <div className="text-meta text-text-subtle">
                        {b.package?.departureDate
                          ? `Departs ${formatDate(b.package.departureDate)}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {b.pilgrimCount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatBDT(b.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {formatBDT(b.amountOutstanding)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
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
