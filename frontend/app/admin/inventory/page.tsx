"use client";

import { useCallback, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  createInventoryItem,
  createInventoryTransaction,
  deleteInventoryItem,
  listInventoryItems,
} from "@/lib/api/endpoints";
import type { RawInventoryTransactionType } from "@/lib/api/endpoints";
import type { InventoryItem } from "@/lib/api/normalize";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import AppSelect from "@/components/ui/AppSelect";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { errorMessage } from "@/lib/api/types";

const TABLE_COLUMNS = 7;
const TABLE_WIDTHS = [
  "w-44", // Name
  "w-20", // SKU
  "w-16", // Unit
  "w-16", // On hand
  "w-16", // Min.
  "w-20", // Status
  "w-24", // Actions
];

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [adjustFor, setAdjustFor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data, loading, error, refetch } = useApi(
    () => listInventoryItems({ page, limit: 15 }),
    [page],
  );

  const meta = data?.meta;

  const filteredItems = useMemo(() => {
    const list = data?.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(s) ||
        i.sku.toLowerCase().includes(s),
    );
  }, [data, search]);

  // Stable handler identities — without useCallback, the inline arrows would
  // change every parent render and force every <Row> to re-render (each Row
  // owns its own modal/toast state, so this would unmount and recreate them).
  const handleAdjust = useCallback(
    (item: InventoryItem) => setAdjustFor({ id: item.id, name: item.name }),
    [],
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Track items distributed to pilgrims (clothing, kits, documents, …)."
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            New item
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          id="search"
          label=""
          placeholder="Search by name or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px]"
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
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No inventory items"
          description="Add an item and a stock quantity to start tracking."
          action={<Button onClick={() => setShowNew(true)}>Add item</Button>}
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-right">On hand</th>
                  <th className="px-4 py-3 text-right">Min.</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((i) => (
                  <Row
                    key={i.id}
                    item={i}
                    onAdjust={handleAdjust}
                    onRefetch={refetch}
                  />
                ))}
              </tbody>
            </table>
          </Card>
          {meta && !search && (
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

      <NewItemModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          refetch();
          setShowNew(false);
        }}
      />
      <AdjustModal
        target={adjustFor}
        onClose={() => setAdjustFor(null)}
        onCreated={() => {
          refetch();
          setAdjustFor(null);
        }}
      />
    </>
  );
}

function Row({
  item,
  onAdjust,
  onRefetch,
}: {
  item: InventoryItem;
  onAdjust: (item: InventoryItem) => void;
  onRefetch: () => void;
}) {
  const lowStock = item.quantity <= item.minimumStock;

  const del = useConfirmAction<InventoryItem>({
    title: `Delete "${item.name}"?`,
    description: "Stock history will be lost. This can't be undone.",
    confirmText: "Delete",
    variant: "danger",
    successTitle: (i) => `Deleted ${i.name}`,
    errorTitle: "Couldn't delete item",
    action: (i) => deleteInventoryItem(i.id),
    onSuccess: onRefetch,
  });

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text">{item.name}</td>
      <td className="px-4 py-3 font-mono text-meta text-text-muted">
        {item.sku}
      </td>
      <td className="px-4 py-3 text-text-muted">{item.unit}</td>
      <td className={`px-4 py-3 text-right font-semibold ${lowStock ? "text-warning" : "text-text"}`}>
        {item.quantity}
      </td>
      <td className="px-4 py-3 text-right text-text-muted">
        {item.minimumStock}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2 text-meta font-medium">
          <button
            onClick={() => onAdjust(item)}
            className="text-emerald hover:underline"
          >
            Adjust
          </button>
          <button
            onClick={() => del.confirm(item)}
            disabled={del.busy}
            className="text-danger hover:underline disabled:opacity-50"
          >
            {del.busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </td>
      <ConfirmDialog {...del.dialogProps} />
    </tr>
  );
}

function NewItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("0");
  const [minimumStock, setMinimumStock] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim() || !sku.trim()) {
      setError("Name and SKU are required.");
      return;
    }
    const q = parseInt(quantity, 10);
    const m = parseInt(minimumStock, 10);
    if (!Number.isFinite(q) || !Number.isFinite(m)) {
      setError("Quantities must be numbers.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createInventoryItem({
        name: name.trim(),
        sku: sku.trim(),
        unit: unit.trim() || "pcs",
        quantity: q,
        minimum_stock: m,
      });
      onCreated();
      setName("");
      setSku("");
      setUnit("pcs");
      setQuantity("0");
      setMinimumStock("0");
    } catch (err) {
      setError(errorMessage(err) ?? "Couldn't create the item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New inventory item">
      <div className="space-y-3">
        <Input
          id="item-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          id="item-sku"
          label="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="item-unit"
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <Input
            id="item-qty"
            type="number"
            label="Initial qty"
            value={quantity}
            min={0}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            id="item-min"
            type="number"
            label="Min. stock"
            value={minimumStock}
            min={0}
            onChange={(e) => setMinimumStock(e.target.value)}
          />
        </div>
        {error && <p className="text-default text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustModal({
  target,
  onClose,
  onCreated,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [type, setType] = useState<RawInventoryTransactionType>("PURCHASE");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!target) return;
    const q = parseInt(quantity, 10);
    if (!Number.isFinite(q) || q === 0) {
      setError("Quantity must be a non-zero number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Use positive quantities for PURCHASE, negative for ISSUE/RETURN use the actual sign convention.
      await createInventoryTransaction({
        inventory_item_id: target.id,
        type,
        quantity: Math.abs(q) * (type === "ISSUE" ? -1 : 1),
        notes: notes.trim() || undefined,
      });
      onCreated();
      setQuantity("1");
      setNotes("");
    } catch (err) {
      setError(errorMessage(err) ?? "Couldn't record the transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target ? `Adjust "${target.name}"` : ""}
    >
      <div className="space-y-3">
        <AppSelect
          label="Transaction type"
          value={type}
          onValueChange={(v) =>
            setType(v as RawInventoryTransactionType)
          }
          options={[
            { value: "PURCHASE", label: "Purchase (add stock)" },
            { value: "ISSUE", label: "Issue (deduct stock)" },
            { value: "RETURN", label: "Return (add back)" },
            { value: "ADJUSTMENT", label: "Manual adjustment" },
          ]}
        />
        <Input
          id="adj-qty"
          type="number"
          label="Quantity"
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(e.target.value)}
          hint={
            type === "ISSUE"
              ? "Issues record as negative stock movement."
              : "Positive quantity to add stock."
          }
        />
        <div>
          <label
            htmlFor="adj-notes"
            className="mb-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
          >
            Notes
          </label>
          <textarea
            id="adj-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-chip border border-border bg-card px-3.5 py-2.5 text-default text-text placeholder:text-text-subtle focus:border-emerald focus:outline-none transition-colors"
          />
        </div>
        {error && <p className="text-default text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Record
          </Button>
        </div>
      </div>
    </Modal>
  );
}
