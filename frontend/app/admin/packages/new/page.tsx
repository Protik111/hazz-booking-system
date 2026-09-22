"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { createPackage, createTier } from "@/lib/api/endpoints";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AppSelect from "@/components/ui/AppSelect";
import { ApiError } from "@/lib/api/types";

type TierName = "ECONOMY" | "STANDARD" | "VIP";

interface DraftTier {
  name: TierName;
  price: string;
  total_quota: string;
}

const packageSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters."),
  type: z.enum(["HAJJ", "RAMADAN_UMRAH", "OFF_SEASON_UMRAH", "ZIYARAH"]),
  description: z.string().optional(),
  departure_date: z.string().min(1, "Departure date is required."),
  return_date: z.string().min(1, "Return date is required."),
  booking_start: z.string().min(1, "Booking start is required."),
  booking_end: z.string().min(1, "Booking end is required."),
});

export default function NewPackagePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"HAJJ" | "RAMADAN_UMRAH" | "OFF_SEASON_UMRAH" | "ZIYARAH">("HAJJ");
  const [description, setDescription] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");

  const [tiers, setTiers] = useState<DraftTier[]>([
    { name: "ECONOMY", price: "", total_quota: "" },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function addTier() {
    const used = new Set(tiers.map((t) => t.name));
    const next: TierName | null =
      !used.has("ECONOMY")
        ? "ECONOMY"
        : !used.has("STANDARD")
          ? "STANDARD"
          : !used.has("VIP")
            ? "VIP"
            : null;
    if (!next) return; // All three already present
    setTiers([...tiers, { name: next, price: "", total_quota: "" }]);
  }

  function removeTier(idx: number) {
    setTiers(tiers.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, patch: Partial<DraftTier>) {
    setTiers(tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  async function handleSubmit() {
    const fields = {
      name,
      type,
      description: description || undefined,
      departure_date: departureDate,
      return_date: returnDate,
      booking_start: bookingStart,
      booking_end: bookingEnd,
    };
    const parsed = packageSchema.safeParse(fields);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fe.name?.[0] ?? "",
        type: fe.type?.[0] ?? "",
        departure_date: fe.departure_date?.[0] ?? "",
        return_date: fe.return_date?.[0] ?? "",
        booking_start: fe.booking_start?.[0] ?? "",
        booking_end: fe.booking_end?.[0] ?? "",
      });
      return;
    }
    setErrors({});
    setSubmitError(null);

    // Validate tiers.
    const validTiers = tiers.filter(
      (t) => parseFloat(t.price) > 0 && parseInt(t.total_quota, 10) > 0,
    );
    if (validTiers.length === 0) {
      setSubmitError("Add at least one tier with a price and quota.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPackage({
        name,
        type,
        description: description || undefined,
        departure_date: departureDate,
        return_date: returnDate,
        booking_start: toIso(bookingStart),
        booking_end: toIso(bookingEnd),
        tiers: validTiers.map((t) => ({
          name: t.name,
          price: parseFloat(t.price),
          total_quota: parseInt(t.total_quota, 10),
        })),
      });

      // First tier is created atomically with the package; the rest are
      // appended individually. If any of these fail, the package exists but
      // is missing tiers — surface that to the user instead of silently
      // routing to the detail page.
      const failedTiers: string[] = [];
      for (const tier of validTiers.slice(1)) {
        try {
          await createTier(created.id, {
            name: tier.name,
            price: parseFloat(tier.price),
            total_quota: parseInt(tier.total_quota, 10),
          });
        } catch (err) {
          failedTiers.push(
            `${tier.name}: ${
              err instanceof ApiError ? err.message : "unknown error"
            }`,
          );
        }
      }

      if (failedTiers.length > 0) {
        setSubmitError(
          `Package was created, but ${failedTiers.length} tier(s) failed: ` +
            failedTiers.join("; ") +
            " Open the package detail page to retry the missing tiers.",
        );
        setSubmitting(false);
        return;
      }

      router.push(`/admin/packages/${created.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Couldn't create the package. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Container size="md" className="py-10">
      <Link
        href="/admin/packages"
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to packages
      </Link>
      <PageHeader
        title="New package"
        description="Define a package and seed it with one or more tiers."
      />

      <Card className="mt-6 space-y-5">
        <Input
          id="name"
          label="Package name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="Hajj Premium 2027"
          required
        />
        <AppSelect
          label="Package type"
          value={type}
          onValueChange={(v) =>
            setType(
              v as "HAJJ" | "RAMADAN_UMRAH" | "OFF_SEASON_UMRAH" | "ZIYARAH",
            )
          }
          options={[
            { value: "HAJJ", label: "Hajj" },
            { value: "RAMADAN_UMRAH", label: "Ramadan Umrah" },
            { value: "OFF_SEASON_UMRAH", label: "Off-season Umrah" },
            { value: "ZIYARAH", label: "Ziyarah" },
          ]}
        />

        <div>
          <label
            htmlFor="description"
            className="mb-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's included, who it's for, etc."
            className="w-full rounded-chip border border-border bg-card px-3.5 py-2.5 text-default text-text placeholder:text-text-subtle focus:border-emerald focus:outline-none transition-colors"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="departure"
            type="date"
            label="Departure date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            error={errors.departure_date}
            required
          />
          <Input
            id="return"
            type="date"
            label="Return date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            error={errors.return_date}
            required
          />
          <Input
            id="booking-start"
            type="datetime-local"
            label="Booking opens"
            value={bookingStart}
            onChange={(e) => setBookingStart(e.target.value)}
            error={errors.booking_start}
            required
          />
          <Input
            id="booking-end"
            type="datetime-local"
            label="Booking closes"
            value={bookingEnd}
            onChange={(e) => setBookingEnd(e.target.value)}
            error={errors.booking_end}
            required
          />
        </div>
      </Card>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-card-title font-semibold text-text">Tiers</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={addTier}
            disabled={tiers.length >= 3}
          >
            + Add tier
          </Button>
        </div>
        <p className="mb-4 text-default text-text-muted">
          Each tier represents a different pricing option (Economy, Standard,
          VIP). The first tier is created with the package; additional tiers are
          created automatically.
        </p>
        <div className="space-y-3">
          {tiers.map((t, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-chip border border-border bg-base p-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
            >
              <AppSelect
                label="Name"
                value={t.name}
                onValueChange={(v) =>
                  updateTier(i, { name: v as TierName })
                }
                options={[
                  { value: "ECONOMY", label: "Economy" },
                  { value: "STANDARD", label: "Standard" },
                  { value: "VIP", label: "VIP" },
                ]}
              />
              <Input
                id={`tier-${i}-price`}
                type="number"
                label="Price (BDT)"
                value={t.price}
                min={0}
                step="0.01"
                onChange={(e) => updateTier(i, { price: e.target.value })}
                placeholder="550000"
              />
              <Input
                id={`tier-${i}-quota`}
                type="number"
                label="Total quota"
                value={t.total_quota}
                min={1}
                step="1"
                onChange={(e) => updateTier(i, { total_quota: e.target.value })}
                placeholder="100"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTier(i)}
                disabled={tiers.length === 1}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        {validTiersSummary(tiers) && (
          <p className="mt-3 text-meta text-text-subtle">
            {validTiersSummary(tiers)}
          </p>
        )}
      </Card>

      {submitError && (
        <p className="mt-4 text-default text-danger" role="alert">
          {submitError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/admin/packages")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          Create package
        </Button>
      </div>
    </Container>
  );
}

/** Convert a `datetime-local` value (no timezone) into ISO UTC. The browser's
 *  Date constructor treats it as local time, so we send `toISOString()`. */
function toIso(value: string): string {
  if (!value) return value;
  return new Date(value).toISOString();
}

function validTiersSummary(tiers: DraftTier[]): string | null {
  const total = tiers.reduce((s, t) => s + (parseInt(t.total_quota, 10) || 0), 0);
  if (total <= 0) return null;
  return `${tiers.length} tier${tiers.length === 1 ? "" : "s"}, ${total} total seats.`;
}