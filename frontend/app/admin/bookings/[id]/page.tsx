"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  adminGetBooking,
  listBookingCancellations,
  listBookingRefunds,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminBookingDetailPage({ params }: Props) {
  const { id } = use(params);

  const { data: booking, loading, error, refetch } = useApi(
    () => adminGetBooking(id),
    [id],
  );

  const { data: cancellations } = useApi(
    () => listBookingCancellations(id),
    [id],
  );
  const { data: refunds } = useApi(
    () => listBookingRefunds(id),
    [id],
  );

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !booking) {
    return <ErrorState message={error ?? "Booking not found."} retry={refetch} />;
  }

  const progressPct =
    booking.totalAmount > 0
      ? Math.round((booking.amountReceived / booking.totalAmount) * 100)
      : 0;

  return (
    <>
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to bookings
      </Link>
      <PageHeader
        title={`Booking ${booking.bookingNumber}`}
        description={
          booking.package
            ? `${booking.package.name} · ${booking.tier?.name ?? "—"}`
            : ""
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" href="/admin/cancellations">
              Review cancellations
            </Button>
            <Button size="sm" variant="outline" href="/admin/payments">
              View all payments
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-card-title font-semibold text-text">Summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Status" value={<StatusBadge status={booking.status} />} />
            <Stat
              label="Payment plan"
              value={
                booking.paymentPlan === "INSTALLMENT"
                  ? "Installments"
                  : "Full payment"
              }
            />
            <Stat label="Pilgrims" value={String(booking.pilgrimCount)} />
            <Stat
              label="Departure"
              value={
                booking.package?.departureDate
                  ? formatDate(booking.package.departureDate)
                  : "—"
              }
            />
          </dl>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-default">
              <span className="font-medium text-text">
                {formatBDT(booking.amountReceived)} paid
              </span>
              <span className="text-text-muted">
                of {formatBDT(booking.totalAmount)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-base">
              <div
                className="h-full bg-emerald transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-meta text-text-subtle">
              <span>{progressPct}% paid</span>
              <span>
                Outstanding:{" "}
                <span className="font-semibold text-text">
                  {formatBDT(booking.amountOutstanding)}
                </span>
              </span>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 text-default sm:grid-cols-2">
            <Row label="User ID" value={<span className="font-mono text-meta">{booking.userId}</span>} />
            <Row
              label="Created"
              value={formatDateTime(booking.createdAt)}
            />
            <Row
              label="Confirmed"
              value={
                booking.confirmedAt
                  ? formatDateTime(booking.confirmedAt)
                  : "—"
              }
            />
            <Row
              label="Hold expires"
              value={
                booking.holdExpiresAt
                  ? formatDateTime(booking.holdExpiresAt)
                  : "—"
              }
            />
          </dl>
        </Card>

        <Card>
          <h2 className="text-card-title font-semibold text-text">Totals</h2>
          <dl className="mt-4 space-y-3 text-default">
            <Row label="Unit price" value={formatBDT(booking.unitPrice)} />
            <Row label="Pilgrims" value={`× ${booking.pilgrimCount}`} />
            <Row label="Total" value={formatBDT(booking.totalAmount)} bold />
            <Row label="Received" value={formatBDT(booking.amountReceived)} />
            <Row
              label="Outstanding"
              value={formatBDT(booking.amountOutstanding)}
              tone={booking.amountOutstanding > 0 ? "warning" : "success"}
            />
          </dl>
        </Card>
      </div>

      {booking.pilgrims.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-card-title font-semibold text-text">
            Pilgrims
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-default">
              <thead className="text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Gender</th>
                  <th className="px-2 py-2 text-left">Passport</th>
                  <th className="px-2 py-2 text-left">Nationality</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {booking.pilgrims.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-2 font-medium text-text">
                      {p.fullName}
                    </td>
                    <td className="px-2 py-2 text-text-muted">{p.gender}</td>
                    <td className="px-2 py-2 font-mono text-meta text-text-muted">
                      {p.passportNumber}
                    </td>
                    <td className="px-2 py-2 text-text-muted">{p.nationality}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {booking.installments.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-card-title font-semibold text-text">
            Installments
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-default">
              <thead className="text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Due date</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-right">Paid</th>
                  <th className="px-2 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {booking.installments.map((inst) => (
                  <tr key={inst.id}>
                    <td className="px-2 py-2 text-text-muted">
                      #{inst.installmentNumber}
                    </td>
                    <td className="px-2 py-2 text-text-muted">
                      {formatDate(inst.dueDate)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold text-text">
                      {formatBDT(inst.amount)}
                    </td>
                    <td className="px-2 py-2 text-right text-text-muted">
                      {formatBDT(inst.paidAmount)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={inst.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {cancellations && cancellations.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-card-title font-semibold text-text">
            Cancellation requests
          </h2>
          <ul className="space-y-3">
            {cancellations.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-chip border border-border bg-base p-3"
              >
                <div>
                  <p className="text-default text-text">{c.reason}</p>
                  <p className="text-meta text-text-subtle">
                    Requested {formatDateTime(c.createdAt)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {refunds && refunds.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-card-title font-semibold text-text">
            Refunds
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-default">
              <thead className="text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-left">Method</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Requested</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2 text-right font-semibold text-text">
                      {formatBDT(r.amount)}
                    </td>
                    <td className="px-2 py-2 text-text-muted">{r.method}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2 text-text-muted">
                      {formatDateTime(r.requestedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-meta uppercase tracking-[0.04em] text-text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-default text-text">{value}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  tone?: "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-default text-text-muted">{label}</dt>
      <dd
        className={`text-default ${
          bold ? "font-bold text-text" : "text-text"
        } ${
          tone === "warning"
            ? "text-warning"
            : tone === "success"
              ? "text-success"
              : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
