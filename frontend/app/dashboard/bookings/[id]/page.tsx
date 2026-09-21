"use client";

import { use, useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  cancelPilgrim,
  getBooking,
  listBookingCancellations,
  requestCancellation,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { ApiError } from "@/lib/api/types";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

interface BookingDetailProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailProps) {
  const { id } = use(params);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelingPilgrimId, setCancelingPilgrimId] = useState<string | null>(
    null,
  );

  const { data: booking, loading, error, refetch } = useApi(
    () => getBooking(id),
    [id],
  );

  const { data: cancellations, refetch: refetchCancellations } = useApi(
    () => listBookingCancellations(id),
    [id],
  );

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} retry={refetch} />;
  }

  if (!booking) return null;

  async function handleRequestCancellation() {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await requestCancellation(booking!.id, cancelReason.trim());
      setShowCancelModal(false);
      setCancelReason("");
      refetch();
      refetchCancellations();
    } catch (err) {
      setCancelError(
        err instanceof ApiError ? err.message : "Could not request cancellation.",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleCancelPilgrim(pilgrimId: string) {
    if (!confirm("Cancel this pilgrim's spot?")) return;
    setCancelingPilgrimId(pilgrimId);
    try {
      await cancelPilgrim(booking!.id, pilgrimId);
      refetch();
    } catch (err) {
      alert(
        err instanceof ApiError ? err.message : "Could not cancel pilgrim.",
      );
    } finally {
      setCancelingPilgrimId(null);
    }
  }

  const totalPaid = booking.amountReceived;
  const totalDue = booking.amountOutstanding;
  const progressPct =
    booking.totalAmount > 0
      ? Math.round((totalPaid / booking.totalAmount) * 100)
      : 0;

  const canPay =
    booking.status !== "CANCELLED" &&
    booking.status !== "EXPIRED" &&
    totalDue > 0;

  const canCancel =
    booking.status === "CONFIRMED" || booking.status === "PARTIALLY_PAID";

  return (
    <>
      <PageHeader
        title={`Booking ${booking.bookingNumber}`}
        description={
          booking.package
            ? `${booking.package.name} · ${booking.tier?.name ?? "—"}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canPay && (
              <Button
                href={`/dashboard/payments/new?bookingId=${booking.id}`}
                size="sm"
              >
                Make payment
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
              >
                Request cancellation
              </Button>
            )}
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
                {formatBDT(totalPaid)} paid
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
                  {formatBDT(totalDue)}
                </span>
              </span>
            </div>
          </div>

          {booking.holdExpiresAt &&
            booking.status === "PENDING" &&
            new Date(booking.holdExpiresAt) > new Date() && (
              <p className="mt-4 rounded-chip border border-warning/30 bg-warning-bg px-3 py-2 text-meta text-warning">
                Seats are held until{" "}
                {formatDateTime(booking.holdExpiresAt)}. Pay before then to
                confirm.
              </p>
            )}
        </Card>

        <Card>
          <h2 className="text-card-title font-semibold text-text">
            Booking totals
          </h2>
          <dl className="mt-4 space-y-3 text-default">
            <Row label="Unit price" value={formatBDT(booking.unitPrice)} />
            <Row label="Pilgrims" value={`× ${booking.pilgrimCount}`} />
            <Row label="Total" value={formatBDT(booking.totalAmount)} bold />
            <Row label="Received" value={formatBDT(totalPaid)} />
            <Row
              label="Outstanding"
              value={formatBDT(totalDue)}
              tone={totalDue > 0 ? "warning" : "success"}
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
                  <th className="px-2 py-2 text-right">Action</th>
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
                    <td className="px-2 py-2 text-text-muted">
                      {p.nationality}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {p.status === "ACTIVE" && booking.status !== "CANCELLED" && (
                        <button
                          onClick={() => handleCancelPilgrim(p.id)}
                          disabled={cancelingPilgrimId === p.id}
                          className="text-meta font-medium text-danger hover:underline disabled:opacity-50"
                        >
                          {cancelingPilgrimId === p.id ? "Cancelling…" : "Cancel"}
                        </button>
                      )}
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
          <div className="space-y-3">
            {cancellations.map((c) => (
              <div
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
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Request cancellation"
      >
        <p className="mb-3 text-default text-text-muted">
          Tell us why you&apos;d like to cancel. An admin will review your request
          and contact you about any refund.
        </p>
        <Input
          id="reason"
          label="Reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Personal reasons…"
        />
        {cancelError && (
          <p className="mt-3 text-default text-danger">{cancelError}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCancelModal(false)}
            disabled={cancelling}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRequestCancellation}
            loading={cancelling}
            disabled={!cancelReason.trim()}
          >
            Submit request
          </Button>
        </div>
      </Modal>
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
  value: string;
  bold?: boolean;
  tone?: "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between">
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