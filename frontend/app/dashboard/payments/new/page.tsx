"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useApi } from "@/hooks/useApi";
import {
  getBooking,
  initiatePayment,
  listBookings,
} from "@/lib/api/endpoints";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { ApiError } from "@/lib/api/types";
import { formatBDT } from "@/lib/format";

type Method = "BKASH" | "NAGAD" | "VISA" | "MANUAL_BRANCH";

const METHOD_INFO: Record<Method, { label: string; tagline: string; tone: string }> = {
  BKASH: {
    label: "bKash",
    tagline: "Pay from your bKash mobile wallet.",
    tone: "bg-pink-50 text-pink-700 border-pink-200",
  },
  NAGAD: {
    label: "Nagad",
    tagline: "Pay from your Nagad mobile wallet.",
    tone: "bg-orange-50 text-orange-700 border-orange-200",
  },
  VISA: {
    label: "Visa / Card",
    tagline: "Pay with a Visa, Mastercard, or Amex card.",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  MANUAL_BRANCH: {
    label: "Manual branch deposit",
    tagline: "Deposit at our office — an admin will confirm your payment.",
    tone: "bg-base text-text-muted border-border-strong",
  },
};

const formSchema = z.object({
  booking_id: z.string().min(1, "Pick a booking."),
  amount: z
    .number({ message: "Enter a valid amount." })
    .positive("Amount must be greater than 0.")
    .finite("Amount must be a valid number."),
  method: z.enum(["BKASH", "NAGAD", "VISA", "MANUAL_BRANCH"]),
});

export default function NewPaymentPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <NewPaymentFlow />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <div className="flex h-60 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function NewPaymentFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetBookingId = searchParams.get("bookingId") ?? "";

  const [bookingId, setBookingId] = useState(presetBookingId);
  const [amountStr, setAmountStr] = useState("");
  // Track whether the user has manually edited the amount — once true we
  // never auto-overwrite it (otherwise refetches of `bookingsData` would
  // wipe their edits).
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<Method>("BKASH");
  const [errors, setErrors] = useState<{
    booking_id?: string;
    amount?: string;
    method?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // List bookings so user can pick one. We only surface bookings with
  // outstanding > 0 — paying a fully-settled booking makes no sense.
  const { data: bookingsData, loading: loadingBookings } = useApi(
    () => listBookings({ limit: 50 }),
    [],
  );
  const unpaidBookings = useMemo(() => {
    return (bookingsData?.data ?? []).filter(
      (b) =>
        b.amountOutstanding > 0 &&
        b.status !== "CANCELLED" &&
        b.status !== "EXPIRED" &&
        b.status !== "COMPLETED",
    );
  }, [bookingsData]);

  // If a bookingId is preselected (e.g. from booking detail page), load it
  // so we can default the amount to its outstanding balance.
  const { data: presetBooking } = useApi(
    () => (presetBookingId ? getBooking(presetBookingId) : Promise.resolve(null)),
    [presetBookingId],
  );

  useEffect(() => {
    if (!presetBooking) return;
    setBookingId(presetBooking.id);
    if (!amountTouched && presetBooking.amountOutstanding > 0) {
      setAmountStr(presetBooking.amountOutstanding.toString());
    }
  }, [presetBooking, amountTouched]);

  // If user changes booking in the dropdown, refresh the amount default to its outstanding.
  useEffect(() => {
    if (!bookingId || !bookingsData?.data) return;
    const b = bookingsData.data.find((x) => x.id === bookingId);
    if (!b) return;
    if (!amountTouched && b.amountOutstanding > 0) {
      setAmountStr(b.amountOutstanding.toString());
    }
    // If the booking changes, the previous amount no longer applies — reset
    // the touched flag so the new booking's outstanding becomes the default.
    setAmountTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const selectedBooking = useMemo(() => {
    if (!bookingId) return null;
    return unpaidBookings.find((b) => b.id === bookingId) ?? null;
  }, [bookingId, unpaidBookings]);

  const amount = useMemo(() => {
    const n = parseFloat(amountStr);
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const amountValid =
    amount > 0 &&
    (!selectedBooking || amount <= selectedBooking.amountOutstanding + 0.01);

  async function handleSubmit() {
    const parsed = formSchema.safeParse({
      booking_id: bookingId,
      amount,
      method,
    });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({
        booking_id: fe.booking_id?.[0],
        amount: fe.amount?.[0],
        method: fe.method?.[0],
      });
      return;
    }
    setErrors({});
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payment = await initiatePayment({
        booking_id: bookingId,
        amount,
        method,
      });
      if (method === "MANUAL_BRANCH") {
        // Manual branch deposit has no gateway — straight back to the booking.
        router.push(
          `/dashboard/bookings/${payment.bookingId}?payment=requested`,
        );
      } else {
        // Gateway-redirect flow — assessment mock has its own page.
        router.push(`/dashboard/mock-payment/${payment.id}`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Couldn't start the payment. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Container size="md" className="py-10">
      <Link
        href="/dashboard/payments"
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to payments
      </Link>
      <PageHeader
        title="Make a payment"
        description="Choose a booking, an amount, and how you want to pay."
      />

      <Card className="mt-6">
        <div className="space-y-5">
          <div>
            <Select
              id="booking"
              label="Booking"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              error={errors.booking_id}
              options={[
                ...(presetBookingId ? [] : [{ value: "", label: "Select a booking…" }]),
                ...unpaidBookings.map((b) => ({
                  value: b.id,
                  label: `${b.bookingNumber} — owes ${formatBDT(b.amountOutstanding)}`,
                })),
              ]}
              disabled={loadingBookings || !!presetBookingId}
            />
            {selectedBooking && (
              <p className="mt-1 text-meta text-text-subtle">
                Outstanding balance:{" "}
                <span className="font-semibold text-text">
                  {formatBDT(selectedBooking.amountOutstanding)}
                </span>
              </p>
            )}
          </div>

          <Input
            id="amount"
            type="number"
            label="Amount"
            value={amountStr}
            min={1}
            step="0.01"
            inputMode="decimal"
            onChange={(e) => {
              setAmountStr(e.target.value);
              setAmountTouched(true);
            }}
            error={errors.amount}
            hint={
              selectedBooking
                ? `Maximum ${formatBDT(selectedBooking.amountOutstanding)}`
                : "How much would you like to pay?"
            }
            required
          />

          <fieldset>
            <legend className="mb-2 text-meta font-semibold uppercase tracking-[0.06em] text-text-muted">
              Payment method
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(METHOD_INFO) as Method[]).map((m) => {
                const info = METHOD_INFO[m];
                const active = method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex w-full flex-col items-start gap-1 rounded-card border p-4 text-left transition-colors ${
                      active
                        ? "border-emerald bg-emerald/5"
                        : "border-border bg-card hover:border-emerald/40"
                    }`}
                    aria-pressed={active}
                  >
                    <span
                      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-meta font-semibold ${info.tone}`}
                    >
                      {info.label}
                    </span>
                    <p className="text-meta text-text-muted">{info.tagline}</p>
                  </button>
                );
              })}
            </div>
            {errors.method && (
              <p className="mt-2 text-meta text-danger">{errors.method}</p>
            )}
          </fieldset>

          {submitError && (
            <p className="text-default text-danger" role="alert">
              {submitError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/payments")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!bookingId || amount <= 0 || !amountValid}
            >
              {method === "MANUAL_BRANCH"
                ? "Submit request"
                : `Continue to ${METHOD_INFO[method].label}`}
            </Button>
          </div>
        </div>
      </Card>
    </Container>
  );
}
