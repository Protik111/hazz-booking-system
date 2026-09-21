"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { listAuditLogs } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Input from "@/components/ui/Input";
import { formatDateTime } from "@/lib/format";

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () =>
      listAuditLogs({
        action: action || undefined,
        entity_type: entityType || undefined,
        page,
        limit: 20,
      }),
    [action, entityType, page],
  );

  const records = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Every state-changing action recorded by the system."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          id="action"
          label="Action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          placeholder="e.g. BOOKING_CREATED"
        />
        <Input
          id="entity-type"
          label="Entity type"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          placeholder="e.g. booking"
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
          title="No audit entries"
          description="Once actions occur, they will be listed here."
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      <span className="font-mono text-meta">{log.entityType}</span>
                      <span className="ml-2 font-mono text-meta text-text-subtle">
                        {log.entityId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {log.actorId ? log.actorId.slice(0, 8) : "system"}
                    </td>
                    <td className="px-4 py-3 max-w-md truncate font-mono text-meta text-text-subtle">
                      <Link
                        href={`/admin/audit-logs/${log.id}`}
                        className="cursor-pointer hover:text-text hover:underline"
                        title="View full audit entry"
                      >
                        {summarize(log.oldValue, log.newValue)}
                      </Link>
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

function summarize(oldVal: unknown, newVal: unknown): string {
  const o = oldVal == null ? "—" : JSON.stringify(oldVal);
  const n = newVal == null ? "—" : JSON.stringify(newVal);
  const oLen = o.length;
  const nLen = n.length;
  if (oLen + nLen < 80) return `${o} → ${n}`;
  return `(${oLen} → ${nLen} chars)`;
}