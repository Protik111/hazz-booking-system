"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  adminListPayments,
  type RawPaymentMethod,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { formatBDT, formatDateTime } from "@/lib/format";

const METHOD_LABEL: Record<string, string> = {
  BKASH: "bKash",
  NAGAD: "Nagad",
  VISA: "Visa",
  MANUAL_BRANCH: "Manual",
};

const METHOD_TONE: Record<string, string> = {
  BKASH: "bg-pink-50 text-pink-700 border-pink-200",
  NAGAD: "bg-orange-50 text-orange-700 border-orange-200",
  VISA: "bg-indigo-50 text-indigo-700 border-indigo-200",
  MANUAL_BRANCH: "bg-base text-text-muted border-border-strong",
};

export default function AdminPaymentsPage() {
  const [method, setMethod] = useState<RawPaymentMethod | "">("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () =>
      adminListPayments({
        method: method || undefined,
        status: status || undefined,
        page,
        limit: 15,
      }),
    [method, status, page],
  );

  const payments = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="All payments"
        description="Every payment initiated on the platform."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          id="method-filter"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as RawPaymentMethod);
            setPage(1);
          }}
          options={[
            { value: "", label: "All methods" },
            { value: "BKASH", label: "bKash" },
            { value: "NAGAD", label: "Nagad" },
            { value: "VISA", label: "Visa" },
            { value: "MANUAL_BRANCH", label: "Manual branch" },
          ]}
          className="min-w-[180px]"
        />
        <Select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "PROCESSING", label: "Processing" },
            { value: "SUCCESS", label: "Success" },
            { value: "FAILED", label: "Failed" },
          ]}
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} className="mt-6" />
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payments"
          description="No payments match the current filters."
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-base">
                    <td className="px-4 py-3 text-text-muted">
                      {p.paymentDate
                        ? formatDateTime(p.paymentDate)
                        : formatDateTime(p.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {p.bookingId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-meta font-medium ${METHOD_TONE[p.method] ?? "bg-base text-text-muted border-border-strong"}`}
                      >
                        {METHOD_LABEL[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatBDT(p.amount)}
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {p.gatewayTransactionId ?? p.gatewayReference ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
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
    </>
  );
}
