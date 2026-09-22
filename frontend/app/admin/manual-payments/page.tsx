"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  adminListPayments,
  approveManualPayment,
  rejectManualPayment,
} from "@/lib/api/endpoints";
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
import { useToast } from "@/contexts/ToastContext";
import { formatBDT, formatDateTime } from "@/lib/format";

const TABLE_COLUMNS = 6;
const TABLE_WIDTHS = [
  "w-20", // Booking
  "w-20", // Amount
  "w-32", // Reference
  "w-32", // Created
  "w-20", // Status
  "w-24", // Actions
];

export default function AdminManualPaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const toast = useToast();

  const { data, loading, error, refetch } = useApi(
    () =>
      adminListPayments({
        method: "MANUAL_BRANCH",
        status: status || undefined,
        page,
        limit: 10,
      }),
    [status, page],
  );

  const records = data?.data ?? [];
  const meta = data?.meta;

  const approve = useConfirmAction<string>({
    title: "Approve manual payment?",
    description:
      "The approver must differ from the creator (separation of duties). Confirming will mark the booking's received amount and may confirm the booking.",
    confirmText: "Approve",
    successTitle: "Manual payment approved",
    errorTitle: "Couldn't approve",
    action: (id) => approveManualPayment(id),
    onSuccess: refetch,
  });

  async function handleReject() {
    if (!rejecting || !rejecting.reason.trim()) return;
    try {
      await rejectManualPayment(rejecting.id, rejecting.reason.trim());
      toast.success({ title: "Manual payment rejected" });
      setRejecting(null);
      refetch();
    } catch (err) {
      toast.error({
        title: "Couldn't reject",
        description: errorMessage(err),
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Manual payments"
        description="Record and decide on bank / branch deposits. The approver must differ from the creator (separation of duties)."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <AppSelect
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "PENDING_APPROVAL", label: "Pending approval" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
          placeholder="All statuses"
          className="min-w-[180px]"
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
      ) : records.length === 0 ? (
        <EmptyState
          title="No manual payments"
          description="Bank / branch deposits recorded by admins will appear here."
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Booking</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((p) => {
                  const isPending = p.status === "PENDING_APPROVAL";
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-meta text-text-muted">
                        <Link
                          href={`/admin/bookings/${p.bookingId}`}
                          className="cursor-pointer text-text hover:underline"
                        >
                          {p.bookingId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text">
                        {formatBDT(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {p.reference ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRejecting({ id: p.id, reason: "" })
                              }
                              disabled={approve.busy}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approve.confirm(p.id)}
                              loading={approve.busy}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="text-meta text-text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      <ConfirmDialog {...approve.dialogProps} />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject manual payment"
      >
        <p className="mb-3 text-default text-text-muted">
          Tell the team why this manual payment was rejected.
        </p>
        <Input
          id="reject-reason"
          label="Rejection reason"
          value={rejecting?.reason ?? ""}
          onChange={(e) =>
            setRejecting((s) => (s ? { ...s, reason: e.target.value } : s))
          }
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            disabled={!rejecting?.reason.trim()}
          >
            Reject
          </Button>
        </div>
      </Modal>
    </>
  );
}
