"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
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
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { ApiError } from "@/lib/api/types";
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
  const [acting, setActing] = useState<string | null>(null);

  async function handleApprove(id: string) {
    if (!confirm("Approve this cancellation request?")) return;
    setActing(id);
    try {
      await approveCancellation(id, {});
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't approve.");
    } finally {
      setActing(null);
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    if (!rejecting.reason.trim()) return;
    setActing(rejecting.id);
    try {
      await rejectCancellation(rejecting.id, rejecting.reason.trim());
      setRejecting(null);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Couldn't reject.");
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Cancellation requests"
        description="Review and decide on booking cancellation requests."
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
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
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
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
                            disabled={acting === r.id}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(r.id)}
                            loading={acting === r.id}
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
            loading={acting !== null}
            disabled={!rejecting?.reason.trim()}
          >
            Reject
          </Button>
        </div>
      </Modal>
    </>
  );
}
