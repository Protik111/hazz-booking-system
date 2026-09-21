"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  createVendor,
  createVendorExpense,
  deleteVendor,
  listVendorExpenses,
  listVendors,
} from "@/lib/api/endpoints";
import type { Vendor, VendorExpense } from "@/lib/api/normalize";
import type { PaginationMeta } from "@/lib/api/types";
import type { RawVendorType } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { ApiError } from "@/lib/api/types";
import { formatBDT, formatDate } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  HOTEL: "Hotel",
  AIRLINE: "Airline",
  TRANSPORT: "Transport",
  VISA: "Visa",
  OTHER: "Other",
};

export default function VendorsPage() {
  const [expensesPage, setExpensesPage] = useState(1);
  const [tab, setTab] = useState<"vendors" | "expenses">("vendors");

  const [showVendor, setShowVendor] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const vendors = useApi(() => listVendors({ limit: 50 }), []);
  const expenses = useApi(
    () => listVendorExpenses({ page: expensesPage, limit: 20 }),
    [expensesPage],
  );

  return (
    <>
      <PageHeader
        title="Vendors & expenses"
        description="Manage suppliers (hotels, airlines, transport, visa agents) and the costs you incur against them."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExpense(true)}
            >
              Log expense
            </Button>
            <Button size="sm" onClick={() => setShowVendor(true)}>
              New vendor
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex gap-1 border-b border-border">
        <TabButton active={tab === "vendors"} onClick={() => setTab("vendors")}>
          Vendors
        </TabButton>
        <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
          Expenses
        </TabButton>
      </div>

      {tab === "vendors" && (
        <VendorsList
          loading={vendors.loading}
          error={vendors.error}
          onRefetch={vendors.refetch}
          vendors={vendors.data?.data ?? []}
        />
      )}
      {tab === "expenses" && (
        <ExpensesList
          loading={expenses.loading}
          error={expenses.error}
          onRefetch={expenses.refetch}
          expenses={expenses.data?.data ?? []}
          meta={expenses.data?.meta ?? null}
          setPage={setExpensesPage}
        />
      )}

      <NewVendorModal
        open={showVendor}
        onClose={() => setShowVendor(false)}
        onCreated={() => vendors.refetch()}
      />
      <NewExpenseModal
        open={showExpense}
        onClose={() => setShowExpense(false)}
        vendors={vendors.data?.data ?? []}
        onCreated={() => expenses.refetch()}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-default font-medium transition-colors ${
        active
          ? "border-emerald text-emerald"
          : "border-transparent text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function VendorsList({
  loading,
  error,
  onRefetch,
  vendors,
}: {
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
  vendors: Vendor[];
}) {
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete vendor "${name}"?`)) return;
    try {
      await deleteVendor(id);
      onRefetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't delete vendor.");
    }
  }

  return (
    <div className="mt-6">
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={onRefetch} />
      ) : vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add a hotel, airline, or transport vendor to start logging expenses."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-default">
            <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-text">{v.name}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {TYPE_LABEL[v.type] ?? v.type}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {v.contactInfo ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(v.id, v.name)}
                      className="text-meta font-medium text-danger hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function ExpensesList({
  loading,
  error,
  onRefetch,
  expenses,
  meta,
  setPage,
}: {
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
  expenses: VendorExpense[];
  meta: PaginationMeta | null;
  setPage: (p: number) => void;
}) {
  return (
    <div className="mt-6">
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={onRefetch} />
      ) : expenses.length === 0 ? (
        <EmptyState
          title="No expenses logged"
          description="Once you log a vendor cost, it'll show up here."
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">BDT</th>
                  <th className="px-4 py-3 text-left">Booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDate(e.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-text">
                      {e.vendor?.name ?? e.vendorId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {TYPE_LABEL[e.expenseType] ?? e.expenseType}
                    </td>
                    <td className="px-4 py-3 text-right text-text">
                      {e.amount} {e.currency}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatBDT(e.amountBdt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {e.bookingId ? e.bookingId.slice(0, 8) : "—"}
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
    </div>
  );
}

function NewVendorModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RawVendorType>("HOTEL");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createVendor({
        name: name.trim(),
        type,
        contact_info: contactInfo.trim() || undefined,
      });
      setName("");
      setContactInfo("");
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't create vendor.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New vendor">
      <div className="space-y-4">
        <Input
          id="vendor-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Select
          id="vendor-type"
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as RawVendorType)}
          options={[
            { value: "HOTEL", label: "Hotel" },
            { value: "AIRLINE", label: "Airline" },
            { value: "TRANSPORT", label: "Transport" },
            { value: "VISA", label: "Visa" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Input
          id="vendor-contact"
          label="Contact info (optional)"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          placeholder="Email / phone / website"
        />
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

function NewExpenseModal({
  open,
  onClose,
  vendors,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  vendors: Array<{ id: string; name: string }>;
  onCreated: () => void;
}) {
  const [vendorId, setVendorId] = useState("");
  const [expenseType, setExpenseType] = useState<RawVendorType>("HOTEL");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [expenseDate, setExpenseDate] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!vendorId) {
      setError("Pick a vendor.");
      return;
    }
    if (!expenseDate) {
      setError("Expense date is required.");
      return;
    }
    const amountNum = parseFloat(amount);
    const rate = parseFloat(exchangeRate);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setError("Exchange rate must be greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createVendorExpense({
        vendor_id: vendorId,
        expense_type: expenseType,
        amount: amountNum,
        currency: currency.trim() || "BDT",
        exchange_rate: rate,
        expense_date: expenseDate,
        booking_id: bookingId.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAmount("");
      setNotes("");
      setBookingId("");
      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't log the expense.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log vendor expense">
      <div className="space-y-4">
        <Select
          id="expense-vendor"
          label="Vendor"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          options={[
            { value: "", label: "Select vendor…" },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="expense-amount"
            type="number"
            label="Amount"
            value={amount}
            min={0}
            step="0.01"
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            id="expense-currency"
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
          <Input
            id="expense-rate"
            type="number"
            label="Exchange rate"
            value={exchangeRate}
            min={0}
            step="0.0001"
            onChange={(e) => setExchangeRate(e.target.value)}
            hint="To BDT"
          />
          <Select
            id="expense-type"
            label="Expense type"
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value as RawVendorType)}
            options={[
              { value: "HOTEL", label: "Hotel" },
              { value: "AIRLINE", label: "Airline" },
              { value: "TRANSPORT", label: "Transport" },
              { value: "VISA", label: "Visa" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <Input
            id="expense-date"
            type="date"
            label="Date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
          <Input
            id="expense-booking"
            label="Booking ID (optional)"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <div>
          <label
            htmlFor="expense-notes"
            className="mb-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
          >
            Notes
          </label>
          <textarea
            id="expense-notes"
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
            Log expense
          </Button>
        </div>
      </div>
    </Modal>
  );
}