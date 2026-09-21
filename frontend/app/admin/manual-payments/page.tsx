"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
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
import Select from "@/components/ui/Select";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { ApiError } from "@/lib/api/types";
import { formatBDT, formatDateTime } from "@/lib/format";

export default function AdminManualPaymentsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{
    id: string;
    reason: string;
  } | null>(null);

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

  async function handleApprove(id: string) {
    if (!confirm("Approve this manual payment?")) return;
    setActing(id);
    try {
      await approveManualPayment(id);
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
      await rejectManualPayment(rejecting.id, rejecting.reason.trim());
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
        title="Manual payments"
        description="Record and decide on bank / branch deposits. The approver must differ from the creator (separation of duties)."
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
            { value: "PENDING_APPROVAL", label: "Pending approval" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
          className="min-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="mt-6 flex h-40 items-center justify-center">
          <Spinner />
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
                          className="text-text hover:underline"
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
                              disabled={acting === p.id}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(p.id)}
                              loading={acting === p.id}
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
