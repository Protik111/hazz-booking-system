"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { getAuditLog } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import { formatDateTime } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AuditLogDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: log, loading, error, refetch } = useApi(
    () => getAuditLog(id),
    [id],
  );

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} retry={refetch} />;
  }

  if (!log) return null;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/audit-logs"
          className="cursor-pointer text-meta text-text-muted hover:text-text"
        >
          ← Back to audit logs
        </Link>
      </div>

      <PageHeader
        title={`Audit · ${log.action}`}
        description={`Recorded ${formatDateTime(log.createdAt)}`}
      />

      <Card className="mt-6">
        <h2 className="text-card-title font-semibold text-text">Details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 text-default sm:grid-cols-2">
          <Row label="Action">
            <span className="font-mono text-meta">{log.action}</span>
          </Row>
          <Row label="Actor">
            {log.actorId ? (
              <span className="font-mono text-meta text-text-muted">
                {log.actorId}
              </span>
            ) : (
              <span className="text-text-muted">system</span>
            )}
          </Row>
          <Row label="Entity">
            <span className="font-mono text-meta text-text-muted">
              {log.entityType} · {log.entityId}
            </span>
          </Row>
          <Row label="IP address">
            {log.ipAddress ? (
              <span className="font-mono text-meta text-text-muted">
                {log.ipAddress}
              </span>
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </Row>
          {log.userAgent && (
            <Row label="User agent" fullWidth>
              <span className="break-all font-mono text-meta text-text-muted">
                {log.userAgent}
              </span>
            </Row>
          )}
        </dl>
      </Card>

      <Card className="mt-6">
        <h2 className="text-card-title font-semibold text-text">Old value</h2>
        <JsonBlock value={log.oldValue} />
      </Card>

      <Card className="mt-6">
        <h2 className="text-card-title font-semibold text-text">New value</h2>
        <JsonBlock value={log.newValue} />
      </Card>

      <div className="mt-6 flex justify-end">
        <Button href="/admin/audit-logs" variant="outline">
          Back to list
        </Button>
      </div>
    </>
  );
}

function Row({
  label,
  children,
  fullWidth,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="text-meta uppercase tracking-[0.04em] text-text-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-default text-text">{children}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const text =
    value == null ? "—" : JSON.stringify(value, null, 2);
  return (
    <pre className="mt-3 max-h-96 overflow-auto rounded-chip border border-border bg-base p-3 font-mono text-meta text-text-muted">
      {text}
    </pre>
  );
}