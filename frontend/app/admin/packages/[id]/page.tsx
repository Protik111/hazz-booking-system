"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import {
  adjustQuota,
  adminGetPackage,
  createTier,
  deletePackage,
  updatePackage,
  updateTier,
} from "@/lib/api/endpoints";
import type { RawPackageStatus } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AppSelect from "@/components/ui/AppSelect";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/booking/StatusBadge";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/types";
import { formatBDT, formatDate } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminPackageDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const {
    data: pkg,
    loading,
    error,
    refetch,
  } = useApi(() => adminGetPackage(id), [id]);

  // Editable copies of the package fields.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<RawPackageStatus>("DRAFT");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Tier-edit state.
  const [editingTier, setEditingTier] = useState<{
    id: string;
    price: string;
    status: "ACTIVE" | "INACTIVE";
  } | null>(null);

  const [quotaDraft, setQuotaDraft] = useState<Record<string, string>>({});
  const [newTier, setNewTier] = useState<{
    name: "ECONOMY" | "STANDARD" | "VIP";
    price: string;
    total_quota: string;
  }>({ name: "STANDARD", price: "", total_quota: "" });

  useEffect(() => {
    if (!pkg) return;
    setName(pkg.name);
    setDescription(pkg.description ?? "");
    setStatus(pkg.status);
    setDepartureDate(pkg.departureDate.slice(0, 10));
    setReturnDate(pkg.returnDate.slice(0, 10));
  }, [pkg]);

  if (loading) {
    return <PackageDetailSkeleton />;
  }
  if (error || !pkg) {
    return (
      <ErrorState message={error ?? "Package not found."} retry={refetch} />
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      await updatePackage(id, {
        name: name.trim(),
        description: description.trim() || null,
        status,
        departure_date: departureDate,
        return_date: returnDate,
      });
      setSaveOk(true);
      refetch();
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Couldn't save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePackage(id);
      router.push("/admin/packages");
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't delete package.");
      setDeleting(false);
    }
  }

  async function handleSaveTier() {
    if (!editingTier) return;
    const price = parseFloat(editingTier.price);
    if (!Number.isFinite(price) || price <= 0) return;
    try {
      await updateTier(editingTier.id, {
        price,
        status: editingTier.status,
      });
      setEditingTier(null);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't update tier.");
    }
  }

  async function handleAdjustQuota(tierId: string) {
    const raw = quotaDraft[tierId];
    const n = parseInt(raw ?? "", 10);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await adjustQuota(tierId, n);
      setQuotaDraft((q) => {
        const next = { ...q };
        delete next[tierId];
        return next;
      });
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't adjust quota.");
    }
  }

  async function handleAddTier() {
    const price = parseFloat(newTier.price);
    const total = parseInt(newTier.total_quota, 10);
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(total) ||
      total <= 0
    ) {
      alert("Enter a valid price and quota.");
      return;
    }
    try {
      await createTier(id, {
        name: newTier.name,
        price,
        total_quota: total,
      });
      setNewTier({ name: "STANDARD", price: "", total_quota: "" });
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't add tier.");
    }
  }

  return (
    <>
      <Link
        href="/admin/packages"
        className="inline-flex items-center gap-2 text-default font-medium text-text-muted hover:text-text"
      >
        <span aria-hidden>←</span> Back to packages
      </Link>
      <PageHeader
        title={pkg.name}
        description={`${pkg.slug} · ${pkg.type.replaceAll("_", " ")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {/* <Button variant="outline" size="sm" href={`/packages/${pkg.id}`}>
              View public page
            </Button> */}
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-card-title font-semibold text-text">
            Package details
          </h2>
          <div className="mt-4 space-y-4">
            <Input
              id="name"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <AppSelect
              label="Status"
              value={status}
              onValueChange={(v) => setStatus(v as RawPackageStatus)}
              options={STATUS_OPTIONS}
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
              />
              <Input
                id="return"
                type="date"
                label="Return date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </div>
          </div>

          {saveError && (
            <p className="mt-4 text-default text-danger" role="alert">
              {saveError}
            </p>
          )}
          {saveOk && (
            <p className="mt-4 text-default text-success" role="status">
              Saved.
            </p>
          )}
          <div className="mt-5 flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Save changes
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-card-title font-semibold text-text">Snapshot</h2>
          <dl className="mt-4 space-y-3 text-default">
            <Row label="Type" value={pkg.type.replaceAll("_", " ")} />
            <Row label="Departure" value={formatDate(pkg.departureDate)} />
            <Row label="Return" value={formatDate(pkg.returnDate)} />
            <Row
              label="Booking window"
              value={`${formatDate(pkg.bookingStart)} → ${formatDate(pkg.bookingEnd)}`}
            />
            <Row label="Status" value={<StatusBadge status={pkg.status} />} />
          </dl>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-card-title font-semibold text-text">Tiers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-default">
            <thead className="text-meta uppercase tracking-[0.04em] text-text-subtle">
              <tr>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Quota</th>
                <th className="px-2 py-2 text-right">Held</th>
                <th className="px-2 py-2 text-right">Confirmed</th>
                <th className="px-2 py-2 text-right">Available</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pkg.tiers.map((t) => (
                <tr key={t.id}>
                  <td className="px-2 py-2 font-medium text-text">{t.name}</td>
                  <td className="px-2 py-2 text-right text-text">
                    {formatBDT(t.price)} {t.currency}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={1}
                        value={quotaDraft[t.id] ?? t.totalQuota}
                        onChange={(e) =>
                          setQuotaDraft((q) => ({
                            ...q,
                            [t.id]: e.target.value,
                          }))
                        }
                        className="w-20 rounded-chip border border-border bg-card px-2 py-1 text-meta text-text focus:border-emerald focus:outline-none"
                      />
                      <button
                        onClick={() => handleAdjustQuota(t.id)}
                        disabled={
                          !quotaDraft[t.id] ||
                          parseInt(quotaDraft[t.id], 10) === t.totalQuota
                        }
                        className="rounded-chip border border-border bg-card px-2 py-1 text-meta font-medium text-text hover:border-emerald hover:text-emerald disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-text-muted">
                    {t.heldSeats}
                  </td>
                  <td className="px-2 py-2 text-right text-text-muted">
                    {t.confirmedSeats}
                  </td>
                  <td className="px-2 py-2 text-right text-text">
                    {t.availableSeats}
                  </td>
                  <td className="px-2 py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-3 text-meta font-medium">
                      <button
                        onClick={() =>
                          setEditingTier({
                            id: t.id,
                            price: t.price.toString(),
                            status: t.status,
                          })
                        }
                        className="text-emerald hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-chip border border-dashed border-border p-4">
          <h3 className="text-default font-semibold text-text">Add a tier</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
            <AppSelect
              label="Name"
              value={newTier.name}
              onValueChange={(v) =>
                setNewTier((s) => ({
                  ...s,
                  name: v as "ECONOMY" | "STANDARD" | "VIP",
                }))
              }
              options={[
                { value: "ECONOMY", label: "Economy" },
                { value: "STANDARD", label: "Standard" },
                { value: "VIP", label: "VIP" },
              ]}
            />
            <Input
              id="new-tier-price"
              type="number"
              label="Price (BDT)"
              value={newTier.price}
              min={0}
              step="0.01"
              onChange={(e) =>
                setNewTier((s) => ({ ...s, price: e.target.value }))
              }
            />
            <Input
              id="new-tier-quota"
              type="number"
              label="Total quota"
              value={newTier.total_quota}
              min={1}
              step="1"
              onChange={(e) =>
                setNewTier((s) => ({ ...s, total_quota: e.target.value }))
              }
            />
            <Button onClick={handleAddTier}>Add</Button>
          </div>
        </div>
      </Card>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete package?"
      >
        <p className="text-default text-text-muted">
          Soft-deleting hides the package from the public listing. Existing
          bookings are unaffected. This action can be reversed by an admin with
          direct database access.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteModal(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete package
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!editingTier}
        onClose={() => setEditingTier(null)}
        title="Edit tier"
      >
        {editingTier && (
          <div className="space-y-4">
            <Input
              id="tier-price"
              type="number"
              label="Price (BDT)"
              value={editingTier.price}
              min={0}
              step="0.01"
              onChange={(e) =>
                setEditingTier({ ...editingTier, price: e.target.value })
              }
            />
            <AppSelect
              label="Status"
              value={editingTier.status}
              onValueChange={(v) =>
                setEditingTier({
                  ...editingTier,
                  status: v as "ACTIVE" | "INACTIVE",
                })
              }
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTier(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTier}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-default text-text-muted">{label}</dt>
      <dd className="text-default text-text">{value}</dd>
    </div>
  );
}

/**
 * Detail-page skeleton for the package editor. Mirrors the real layout
 * (header with action buttons, edit card with input fields, then a tiers
 * table) so the loaded data swaps in without the page reflowing underneath.
 */
function PackageDetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-3.5 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-chip" />
          <Skeleton className="h-9 w-24 rounded-chip" />
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="mb-1.5 h-2.5 w-12" />
            <Skeleton className="h-9 w-full rounded-chip" />
          </div>
          <div>
            <Skeleton className="mb-1.5 h-2.5 w-16" />
            <Skeleton className="h-9 w-full rounded-chip" />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-9 w-full rounded-chip" />
          <Skeleton className="h-9 w-full rounded-chip" />
          <Skeleton className="h-9 w-full rounded-chip" />
        </div>
      </div>

      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="ml-auto h-7 w-20 rounded-chip" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
