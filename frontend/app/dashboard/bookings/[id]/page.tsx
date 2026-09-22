"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { errorMessage } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";
import { formatBDT, formatDate, formatDateTime } from "@/lib/format";

/**
 * How long to keep polling the booking after a payment-redirect until either
 * the status moves to CONFIRMED or we give up. Server-side webhook handling
 * is the source of truth (see PROJECT_CONTEXT.md §"Payment verification"),
 * so the UI never declares success — it only reflects what the server says.
 */
const VERIFY_POLL_MS = 2000;
const VERIFY_TIMEOUT_MS = 30_000;

interface BookingDetailProps {
  params: Promise<{ id: string }>;
}

export default function BookingDetailPage({ params }: BookingDetailProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?payment=success|fail|requested` is set by the payment-init flow when
  // it redirects back here. We use it to render a verifying banner and to
  // re-poll the booking until the server reflects the webhook outcome.
  const paymentHint = searchParams.get("payment");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmingPilgrim, setConfirmingPilgrim] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [cancellingPilgrim, setCancellingPilgrim] = useState(false);
  const toast = useToast();

  const { data: booking, loading, error, refetch } = useApi(
    () => getBooking(id),
    [id],
  );

  const { data: cancellations, refetch: refetchCancellations } = useApi(
    () => listBookingCancellations(id),
    [id],
  );

  // Poll the booking while we're still in the verifying window. Stops when
  // either the booking moves to a paid/confirmed state OR the timeout fires,
  // whichever comes first.
  //
  // `startedRef` is a one-shot guard so re-renders (e.g. status flipping to
  // CONFIRMED → clearing the query param → another render) don't restart the
  // 30-second deadline mid-flight.
  const startedRef = useRef(false);
  useEffect(() => {
    if (paymentHint !== "success" || !booking) return;
    if (
      booking.status === "CONFIRMED" ||
      booking.status === "PARTIALLY_PAID" ||
      booking.status === "COMPLETED"
    ) {
      router.replace(`/dashboard/bookings/${id}`, { scroll: false });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    const interval = setInterval(async () => {
      if (Date.now() >= deadline) {
        clearInterval(interval);
        return;
      }
      await refetch();
    }, VERIFY_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentHint, booking?.status, id]);

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
      // Both lists depend on this booking — fetch them in parallel rather
      // than one after the other.
      await Promise.all([refetch(), refetchCancellations()]);
    } catch (err) {
      setCancelError(errorMessage(err) ?? "Could not request cancellation.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleCancelPilgrim() {
    if (!confirmingPilgrim) return;
    const target = confirmingPilgrim;
    setCancellingPilgrim(true);
    try {
      await cancelPilgrim(booking!.id, target.id);
      toast.success({ title: `Cancelled ${target.name}'s spot` });
      setConfirmingPilgrim(null);
      refetch();
    } catch (err) {
      toast.error({
        title: "Couldn't cancel pilgrim",
        description: errorMessage(err) ?? "Please try again.",
      });
    } finally {
      setCancellingPilgrim(false);
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
      {paymentHint === "success" &&
        booking.status !== "CONFIRMED" &&
        booking.status !== "PARTIALLY_PAID" &&
        booking.status !== "COMPLETED" && (
          <Card className="mb-6 border-info/30 bg-info-bg">
            <div className="flex items-start gap-3">
              <Spinner size="sm" />
              <div>
                <p className="text-default font-semibold text-text">
                  Verifying your payment…
                </p>
                <p className="mt-1 text-meta text-text-muted">
                  We&apos;re waiting for the gateway to confirm. This usually
                  takes a few seconds. Don&apos;t close this page.
                </p>
              </div>
            </div>
          </Card>
        )}

      {paymentHint === "requested" && (
        <Card className="mb-6 border-info/30 bg-info-bg">
          <p className="text-default text-text">
            Manual payment submitted. An admin will review and approve it
            shortly.
          </p>
        </Card>
      )}

      {paymentHint === "fail" && (
        <Card className="mb-6 border-danger/30 bg-danger-bg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-default text-text">
              The payment did not go through. Please try again.
            </p>
            <Button
              size="sm"
              href={`/dashboard/payments/new?bookingId=${booking.id}`}
            >
              Try again
            </Button>
          </div>
        </Card>
      )}

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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setConfirmingPilgrim({ id: p.id, name: p.fullName })
                          }
                        >
                          Cancel
                        </Button>
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

      <ConfirmDialog
        open={!!confirmingPilgrim}
        onClose={() => {
          if (!cancellingPilgrim) setConfirmingPilgrim(null);
        }}
        onConfirm={handleCancelPilgrim}
        title={`Cancel ${confirmingPilgrim?.name ?? "this pilgrim"}'s spot?`}
        description="This frees up their seat but cannot be undone. The pilgrim won't be charged again."
        confirmText="Cancel pilgrim"
        variant="danger"
        loading={cancellingPilgrim}
      />
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