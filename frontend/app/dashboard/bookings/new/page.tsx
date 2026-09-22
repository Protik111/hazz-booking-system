"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { useApi } from "@/hooks/useApi";
import { createBooking, getPackage } from "@/lib/api/endpoints";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import PilgrimForm, {
  emptyPilgrim,
  type PilgrimFormData,
} from "@/components/booking/PilgrimForm";
import { ApiError } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";
import { formatBDT, formatDate } from "@/lib/format";

const pilgrimSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required."),
  date_of_birth: z.string().min(1, "Date of birth is required."),
  gender: z.enum(["MALE", "FEMALE"]),
  nationality: z.string().trim().min(2, "Nationality is required."),
  passport_number: z.string().trim().min(3, "Passport number is required."),
  passport_issue_date: z.string().optional(),
  passport_expiry_date: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

type Step = "tier" | "plan" | "pilgrims" | "review";

export default function NewBookingPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <NewBookingFlow />
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

function NewBookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const packageIdParam = searchParams.get("packageId") ?? "";
  const tierIdParam = searchParams.get("tierId") ?? "";

  const [step, setStep] = useState<Step>(packageIdParam ? "tier" : "tier");
  const [selectedTierId, setSelectedTierId] = useState(tierIdParam);
  const [paymentPlan, setPaymentPlan] = useState<"FULL_PAYMENT" | "INSTALLMENT">(
    "INSTALLMENT",
  );
  const [pilgrims, setPilgrims] = useState<PilgrimFormData[]>([emptyPilgrim()]);
  const [pilgrimErrors, setPilgrimErrors] = useState<
    Array<Partial<Record<keyof PilgrimFormData, string>>>
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: pkg, loading, error } = useApi(
    () => (packageIdParam ? getPackage(packageIdParam) : Promise.resolve(null)),
    [packageIdParam],
  );

  // Auto-advance when tierId is preselected via query string.
  useEffect(() => {
    if (tierIdParam && step === "tier") setStep("plan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierIdParam]);

  const selectedTier = useMemo(() => {
    if (!pkg || !selectedTierId) return null;
    return pkg.tiers.find((t) => t.id === selectedTierId) ?? null;
  }, [pkg, selectedTierId]);

  const seatLimit = selectedTier?.availableSeats ?? 1;

  function addPilgrim() {
    if (pilgrims.length >= seatLimit) return;
    setPilgrims([...pilgrims, emptyPilgrim()]);
  }

  function removePilgrim(index: number) {
    if (pilgrims.length === 1) return;
    setPilgrims(pilgrims.filter((_, i) => i !== index));
  }

  function updatePilgrim(index: number, next: PilgrimFormData) {
    setPilgrims(pilgrims.map((p, i) => (i === index ? next : p)));
  }

  function validatePilgrims(): boolean {
    const errors = pilgrims.map((p) => {
      const r = pilgrimSchema.safeParse(p);
      if (r.success) return {};
      return r.error.flatten().fieldErrors as Partial<
        Record<keyof PilgrimFormData, string>
      >;
    });
    setPilgrimErrors(errors);
    return errors.every((e) => Object.keys(e).length === 0);
  }

  async function handleSubmit() {
    if (!pkg || !selectedTierId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const idempotencyKey = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      const created = await createBooking(
        {
          package_tier_id: selectedTierId,
          payment_plan: paymentPlan,
          pilgrim_count: pilgrims.length,
          pilgrims: pilgrims.map((p) => ({
            full_name: p.full_name.trim(),
            date_of_birth: p.date_of_birth,
            gender: p.gender,
            nationality: p.nationality.trim(),
            passport_number: p.passport_number.trim(),
            passport_issue_date: p.passport_issue_date || undefined,
            passport_expiry_date: p.passport_expiry_date || undefined,
            phone: p.phone.trim() || undefined,
            email: p.email.trim() || undefined,
          })),
        },
        idempotencyKey,
      );
      toast.success({
        title: "Booking created",
        description: `Reservation ${created.bookingNumber} is held for 30 minutes.`,
      });
      router.push(`/dashboard/bookings/${created.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't create the booking. Please try again.";
      setSubmitError(message);
      toast.error({ title: "Booking failed", description: message });
      setSubmitting(false);
    }
  }

  if (!packageIdParam) {
    return (
      <Container size="md" className="py-10">
        <ErrorState
          message="Pick a package first — packageId is missing from the URL."
          retry={() => router.push("/packages")}
        />
      </Container>
    );
  }

  if (loading) {
    return <LoadingShell />;
  }

  if (error || !pkg) {
    return (
      <ErrorState
        message={error ?? "Package not found."}
        retry={() => router.push("/packages")}
      />
    );
  }

  return (
    <Container size="md" className="py-10">
      <Link
        href={`/packages/${pkg.id}`}
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to package
      </Link>
      <PageHeader
        title={`Book ${pkg.name}`}
        description="A few quick steps and your seats are reserved."
      />

      <Stepper current={step} />

      <div className="mt-6 space-y-6">
        {step === "tier" && (
          <Card>
            <h2 className="text-card-title font-semibold text-text">
              Choose a tier
            </h2>
            <div className="mt-4 space-y-3">
              {pkg.tiers.map((t) => {
                const soldOut = t.availableSeats === 0;
                const active = selectedTierId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => setSelectedTierId(t.id)}
                    className={`flex w-full items-center justify-between rounded-card border p-4 text-left transition-colors ${
                      active
                        ? "border-emerald bg-emerald/5"
                        : "border-border bg-card hover:border-emerald/40"
                    } ${soldOut ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div>
                      <div className="text-default font-semibold text-text">
                        {t.name}
                      </div>
                      <div className="text-meta text-text-subtle">
                        {soldOut
                          ? "Full"
                          : `${t.availableSeats} seat${
                              t.availableSeats !== 1 ? "s" : ""
                            } left`}
                      </div>
                    </div>
                    <div className="text-section font-bold text-emerald">
                      {formatBDT(t.price)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setStep("plan")}
                disabled={!selectedTierId}
              >
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === "plan" && selectedTier && (
          <Card>
            <h2 className="text-card-title font-semibold text-text">
              Payment plan
            </h2>
            <p className="mt-1 text-default text-text-muted">
              Choose how you&apos;d like to pay for{" "}
              <strong>{formatBDT(selectedTier.price)}</strong> per pilgrim.
            </p>
            <div className="mt-4 space-y-3">
              <PlanOption
                active={paymentPlan === "INSTALLMENT"}
                onClick={() => setPaymentPlan("INSTALLMENT")}
                title="Installments"
                description={`Split into 2 or 3 installments. Final installment is due before departure.`}
              />
              <PlanOption
                active={paymentPlan === "FULL_PAYMENT"}
                onClick={() => setPaymentPlan("FULL_PAYMENT")}
                title="Full payment"
                description="Pay the entire amount at booking confirmation."
              />
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep("tier")}>
                Back
              </Button>
              <Button onClick={() => setStep("pilgrims")}>Continue</Button>
            </div>
          </Card>
        )}

        {step === "pilgrims" && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-card-title font-semibold text-text">
                Traveler details
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addPilgrim}
                disabled={pilgrims.length >= seatLimit}
              >
                + Add pilgrim
              </Button>
            </div>
            <p className="mb-4 text-default text-text-muted">
              You&apos;re reserving{" "}
              <strong>{pilgrims.length}</strong>{" "}
              {pilgrims.length === 1 ? "seat" : "seats"} out of {seatLimit}{" "}
              available. Add passport info for each traveler.
            </p>
            <div className="space-y-4">
              {pilgrims.map((p, i) => (
                <PilgrimForm
                  key={i}
                  index={i}
                  data={p}
                  errors={pilgrimErrors[i]}
                  onChange={(next) => updatePilgrim(i, next)}
                  onRemove={() => removePilgrim(i)}
                  removable={pilgrims.length > 1}
                />
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep("plan")}>
                Back
              </Button>
              <Button
                onClick={() => {
                  if (validatePilgrims()) setStep("review");
                }}
              >
                Review booking
              </Button>
            </div>
          </Card>
        )}

        {step === "review" && selectedTier && (
          <Card>
            <h2 className="text-card-title font-semibold text-text">
              Review your booking
            </h2>
            <dl className="mt-4 divide-y divide-border">
              <ReviewRow label="Package" value={pkg.name} />
              <ReviewRow label="Tier" value={selectedTier.name} />
              <ReviewRow
                label="Departure"
                value={formatDate(pkg.departureDate)}
              />
              <ReviewRow
                label="Payment plan"
                value={
                  paymentPlan === "INSTALLMENT" ? "Installments" : "Full payment"
                }
              />
              <ReviewRow label="Travelers" value={`${pilgrims.length}`} />
              <ReviewRow
                label="Unit price"
                value={`${formatBDT(selectedTier.price)} / pilgrim`}
              />
              <ReviewRow
                label="Estimated total"
                value={formatBDT(selectedTier.price * pilgrims.length)}
                bold
              />
            </dl>
            <p className="mt-4 text-meta text-text-subtle">
              Your seats are reserved at booking creation. You&apos;ll be redirected
              to the booking page where you can pay.
            </p>
            {submitError && (
              <p className="mt-3 text-default text-danger">{submitError}</p>
            )}
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep("pilgrims")}>
                Back
              </Button>
              <Button onClick={handleSubmit} loading={submitting}>
                Confirm booking
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Container>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "tier", label: "Tier" },
    { key: "plan", label: "Payment" },
    { key: "pilgrims", label: "Travelers" },
    { key: "review", label: "Review" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="mt-6 flex items-center gap-2">
      {steps.map((s, idx) => (
        <li
          key={s.key}
          className={`flex items-center gap-2 ${
            idx <= currentIdx ? "text-emerald" : "text-text-subtle"
          }`}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-pill border text-meta font-semibold ${
              idx <= currentIdx
                ? "border-emerald bg-emerald text-white"
                : "border-border bg-card"
            }`}
          >
            {idx + 1}
          </span>
          <span className="text-default font-medium">{s.label}</span>
          {idx < steps.length - 1 && (
            <span className="mx-2 h-px w-6 bg-border" />
          )}
        </li>
      ))}
    </ol>
  );
}

function PlanOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors ${
        active
          ? "border-emerald bg-emerald/5"
          : "border-border bg-card hover:border-emerald/40"
      }`}
    >
      <div
        className={`mt-0.5 h-4 w-4 rounded-full border-2 ${
          active ? "border-emerald bg-emerald" : "border-border-strong"
        }`}
      />
      <div>
        <div className="text-default font-semibold text-text">{title}</div>
        <div className="text-default text-text-muted">{description}</div>
      </div>
    </button>
  );
}

function ReviewRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-default text-text-muted">{label}</dt>
      <dd
        className={`text-default ${
          bold ? "font-bold text-text" : "text-text"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}