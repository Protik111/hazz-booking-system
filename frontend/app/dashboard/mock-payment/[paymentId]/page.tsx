"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import {
  getPayment,
  mockPaymentFail,
  mockPaymentSuccess,
} from "@/lib/api/endpoints";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ErrorState from "@/components/ui/ErrorState";
import StatusBadge from "@/components/booking/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";
import { formatBDT, formatDateTime } from "@/lib/format";

interface MockPaymentProps {
  params: Promise<{ paymentId: string }>;
}

const GATEWAY_BADGE: Record<string, { label: string; tone: string }> = {
  BKASH: { label: "bKash", tone: "bg-pink-50 text-pink-700 border-pink-200" },
  NAGAD: { label: "Nagad", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  VISA: { label: "Visa", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
};

export default function MockPaymentPage({ params }: MockPaymentProps) {
  const { paymentId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [acting, setActing] = useState<"success" | "fail" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: payment, loading, error: loadError, refetch } = useApi(
    () => getPayment(paymentId),
    [paymentId],
  );

  async function handleOutcome(outcome: "success" | "fail") {
    setActing(outcome);
    setError(null);
    try {
      const updated =
        outcome === "success"
          ? await mockPaymentSuccess(paymentId)
          : await mockPaymentFail(paymentId);

      toast.success({
        title: outcome === "success" ? "Payment succeeded" : "Payment failed",
        description:
          outcome === "success"
            ? "Your booking has been confirmed."
            : "The sandbox gateway declined this payment.",
      });
      // Refresh booking in background then bounce to its detail page.
      const dest = `/dashboard/bookings/${updated.bookingId}?payment=${outcome}`;
      router.push(dest);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Couldn't ${outcome === "success" ? "succeed" : "fail"} the mock payment.`;
      setError(message);
      toast.error({
        title: "Couldn't record the gateway response",
        description: message,
      });
      setActing(null);
    }
  }

  if (loading) {
    return <LoadingShell />;
  }

  if (loadError) {
    return (
      <Container size="sm" className="py-10">
        <ErrorState message={loadError} retry={refetch} />
      </Container>
    );
  }

  if (!payment) {
    return (
      <Container size="sm" className="py-10">
        <ErrorState message="Payment not found." />
      </Container>
    );
  }

  const gateway = GATEWAY_BADGE[payment.method] ?? {
    label: payment.method,
    tone: "bg-base text-text-muted border-border-strong",
  };

  // If payment is already in a terminal state, show the result rather than buttons.
  const resolved = payment.status === "SUCCESS" || payment.status === "FAILED";

  return (
    <Container size="sm" className="py-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-pill border border-warning/30 bg-warning-bg px-3 py-1 text-meta text-warning">
        <span aria-hidden>⚠</span>
        Mock gateway — for assessment only
      </div>

      <PageHeader
        title={`Pay with ${gateway.label}`}
        description="You&apos;re being charged through our sandbox gateway. No real money moves."
      />

      <Card className="mt-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-meta uppercase tracking-[0.06em] text-text-subtle">
              Amount
            </p>
            <p className="text-section font-bold text-text">
              {formatBDT(payment.amount)}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-meta font-medium ${gateway.tone}`}
          >
            {gateway.label}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-default">
          <div>
            <dt className="text-meta uppercase tracking-[0.06em] text-text-subtle">
              Payment ID
            </dt>
            <dd className="mt-0.5 font-mono text-meta text-text-muted">
              {payment.id}
            </dd>
          </div>
          <div>
            <dt className="text-meta uppercase tracking-[0.06em] text-text-subtle">
              Created
            </dt>
            <dd className="mt-0.5 text-text-muted">
              {formatDateTime(payment.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-meta uppercase tracking-[0.06em] text-text-subtle">
              Current status
            </dt>
            <dd className="mt-0.5">
              <StatusBadge status={payment.status} />
            </dd>
          </div>
          <div>
            <dt className="text-meta uppercase tracking-[0.06em] text-text-subtle">
              Reference
            </dt>
            <dd className="mt-0.5 font-mono text-meta text-text-muted">
              {payment.gatewayReference ?? "—"}
            </dd>
          </div>
        </dl>

        {!resolved ? (
          <>
            <div className="rounded-chip border border-border bg-base p-3 text-meta text-text-muted">
              In a real integration, you&apos;d now see the gateway&apos;s checkout UI.
              For this assessment, click one of the buttons below to simulate a
              response — <code className="font-mono">POST /mock-payments/{paymentId}/success</code>{" "}
              or <code className="font-mono">…/fail</code>.
            </div>

            {error && (
              <p className="text-default text-danger" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href={`/dashboard/bookings/${payment.bookingId}`}
                className="inline-flex items-center justify-center rounded-chip border border-border bg-card px-4 py-2.5 text-default font-medium text-text hover:border-emerald hover:text-emerald transition-colors"
              >
                Cancel & return
              </Link>
              <Button
                variant="danger"
                onClick={() => handleOutcome("fail")}
                loading={acting === "fail"}
                disabled={acting !== null}
              >
                Simulate failure
              </Button>
              <Button
                onClick={() => handleOutcome("success")}
                loading={acting === "success"}
                disabled={acting !== null}
              >
                Simulate success
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`rounded-chip border p-3 text-default ${
                payment.status === "SUCCESS"
                  ? "border-success/30 bg-success-bg text-success"
                  : "border-danger/30 bg-danger-bg text-danger"
              }`}
            >
              {payment.status === "SUCCESS" ? (
                <p>
                  ✓ Payment succeeded.{" "}
                  <span className="font-mono text-meta">
                    {payment.gatewayTransactionId}
                  </span>
                </p>
              ) : (
                <p>This payment failed in the sandbox.</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() =>
                  router.push(`/dashboard/bookings/${payment.bookingId}`)
                }
              >
                Back to booking
              </Button>
            </div>
          </>
        )}
      </Card>
    </Container>
  );
}

function LoadingShell() {
  return (
    <div className="space-y-6 py-10" aria-hidden="true">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-3.5 w-72" />
      </div>
      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 w-32 rounded-chip" />
          <Skeleton className="h-10 w-32 rounded-chip" />
        </div>
      </div>
    </div>
  );
}
