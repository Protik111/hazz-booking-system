"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import {
  adminListCancellations,
  approveCancellation,
  rejectCancellation,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import CardSkeleton from "@/components/ui/CardSkeleton";
import Pagination from "@/components/ui/Pagination";
import AppSelect from "@/components/ui/AppSelect";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { errorMessage } from "@/lib/api/types";
import { formatBDT, formatDateTime } from "@/lib/format";

export default function AdminCancellationsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () =>
      adminListCancellations({
        status: status || undefined,
        page,
        limit: 10,
      }),
    [status, page],
  );

  const records = data?.data ?? [];
  const meta = data?.meta;

  const [rejecting, setRejecting] = useState<{
    id: string;
    reason: string;
  } | null>(null);
  const toast = useToast();

  const approve = useConfirmAction<string>({
    title: "Approve cancellation request?",
    description:
      "This will release the seats back to inventory and, if applicable, spawn a refund. This cannot be undone.",
    confirmText: "Approve",
    successTitle: "Cancellation approved",
    errorTitle: "Couldn't approve",
    action: (id) => approveCancellation(id, {}),
    onSuccess: refetch,
  });

  async function handleReject() {
    if (!rejecting || !rejecting.reason.trim()) return;
    try {
      await rejectCancellation(rejecting.id, rejecting.reason.trim());
      toast.success({ title: "Cancellation rejected" });
      setRejecting(null);
      refetch();
    } catch (err) {
      toast.error({ title: "Couldn't reject", description: errorMessage(err) });
    }
  }

  return (
    <>
      <PageHeader
        title="Cancellation requests"
        description="Review and decide on booking cancellation requests."
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
            { value: "REQUESTED", label: "Requested" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "COMPLETED", label: "Completed" },
            { value: "FAILED", label: "Failed" },
          ]}
          placeholder="All statuses"
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
          <CardSkeleton rows={3} />
        </div>
      ) : error ? (
        <ErrorState message={error} retry={refetch} className="mt-6" />
      ) : records.length === 0 ? (
        <EmptyState
          title="No cancellation requests"
          description="Once a pilgrim requests cancellation, it will appear here."
          className="mt-6"
        />
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {records.map((r) => {
              const isRequested = r.status === "REQUESTED";
              const busy = approve.busy;
              return (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-default text-text">
                        <span className="font-mono text-meta text-text-subtle">
                          Booking {r.bookingId.slice(0, 8)}
                        </span>
                      </p>
                      <p className="mt-1 text-default text-text">
                        {r.reason}
                      </p>
                      <p className="mt-2 text-meta text-text-subtle">
                        Requested {formatDateTime(r.createdAt)}
                        {r.refundAmount !== undefined &&
                          r.refundAmount !== null &&
                          ` · estimated refund ${formatBDT(r.refundAmount)}`}
                      </p>
                      {r.rejectionReason && (
                        <p className="mt-2 text-meta text-danger">
                          Rejected: {r.rejectionReason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={r.status} />
                      {isRequested && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setRejecting({ id: r.id, reason: "" })
                            }
                            disabled={busy}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approve.confirm(r.id)}
                            loading={busy}
                          >
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
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
        title="Reject cancellation"
      >
        <p className="mb-3 text-default text-text-muted">
          Tell the pilgrim why their cancellation request was rejected.
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
