"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { listBookings } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Pagination from "@/components/ui/Pagination";
import AppSelect from "@/components/ui/AppSelect";
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

const TABLE_COLUMNS = 7;
const TABLE_WIDTHS = [
  "w-24", // Booking
  "w-44", // Package
  "w-10", // Travelers
  "w-24", // Departure
  "w-20", // Total
  "w-20", // Outstanding
  "w-20", // Status
];

export default function BookingsListPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () => listBookings({ status: status || undefined, page, limit: 10 }),
    [status, page],
  );

  const bookings = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="My bookings"
        description="All your package bookings."
        actions={
          <Button href="/packages" size="sm">
            Browse packages
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <AppSelect
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="mt-6">
          <TableSkeleton
            columns={TABLE_COLUMNS}
            columnWidths={TABLE_WIDTHS}
            rows={8}
          />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} className="mt-6" />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={
            status
              ? `No bookings with status "${status}".`
              : "You haven't booked anything yet."
          }
          action={<Button href="/packages">Browse packages</Button>}
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-left">Package</th>
                  <th className="px-4 py-3 text-left">Travelers</th>
                  <th className="px-4 py-3 text-left">Departure</th>
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
                        href={`/dashboard/bookings/${b.id}`}
                        className="hover:text-emerald"
                      >
                        {b.bookingNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">
                        {b.package?.name ?? "—"}
                      </div>
                      <div className="text-meta text-text-subtle">
                        {b.tier?.name ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {b.pilgrimCount}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {b.package?.departureDate
                        ? formatDate(b.package.departureDate)
                        : "—"}
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
