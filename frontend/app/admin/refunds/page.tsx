"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  adminListRefunds,
  approveRefund,
  processRefund,
  rejectRefund,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import Pagination from "@/components/ui/Pagination";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { errorMessage } from "@/lib/api/types";
import { useToast } from "@/contexts/ToastContext";
import { formatBDT, formatDateTime } from "@/lib/format";

const TABLE_COLUMNS = 7;
const TABLE_WIDTHS = [
  "w-20", // Booking
  "w-20", // Amount
  "w-24", // Method
  "w-44", // Reason
  "w-32", // Requested
  "w-20", // Status
  "w-24", // Actions
];

export default function AdminRefundsPage() {
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const toast = useToast();

  const { data, loading, error, refetch } = useApi(
    () => adminListRefunds({ page, limit: 10 }),
    [page],
  );

  const records = data?.data ?? [];
  const meta = data?.meta;

  const approve = useConfirmAction<string>({
    title: "Approve this refund?",
    description:
      "Approving authorizes the refund to be paid out. It still needs to be processed by an operator.",
    confirmText: "Approve",
    successTitle: "Refund approved",
    errorTitle: "Couldn't approve",
    action: (id) => approveRefund(id),
    onSuccess: refetch,
  });

  async function handleProcess(id: string) {
    try {
      await processRefund(id, {});
      toast.success({ title: "Refund processed" });
      refetch();
    } catch (err) {
      toast.error({
        title: "Couldn't process",
        description: errorMessage(err),
      });
    }
  }

  async function handleReject() {
    if (!rejecting || !rejecting.reason.trim()) return;
    try {
      await rejectRefund(rejecting.id, rejecting.reason.trim());
      toast.success({ title: "Refund rejected" });
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
        title="Refund requests"
        description="Approve, process, or reject refund requests."
      />

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
          title="No refund requests"
          description="When refunds are created, they'll show up here."
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
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {r.bookingId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatBDT(r.amount)}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{r.method}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.reason ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDateTime(r.requestedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {r.status === "REQUESTED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRejecting({ id: r.id, reason: "" })
                              }
                              disabled={approve.busy}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approve.confirm(r.id)}
                              loading={approve.busy}
                            >
                              Approve
                            </Button>
                          </>
                        )}
                        {r.status === "APPROVED" && (
                          <Button
                            size="sm"
                            onClick={() => handleProcess(r.id)}
                          >
                            Process
                          </Button>
                        )}
                      </div>
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

      <ConfirmDialog {...approve.dialogProps} />

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject refund"
      >
        <p className="mb-3 text-default text-text-muted">
          Tell the pilgrim why this refund was rejected.
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
