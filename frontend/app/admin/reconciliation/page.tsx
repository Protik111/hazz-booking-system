"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  importSettlement,
  listReconciliation,
  resolveReconciliation,
} from "@/lib/api/endpoints";
import type { RawReconciliationStatus } from "@/lib/api/endpoints";
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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "MATCHED", label: "Matched" },
  { value: "MISMATCH", label: "Mismatch" },
  { value: "RESOLVED", label: "Resolved" },
];

interface ImportRow {
  gateway_transaction_id: string;
  amount: string;
  settlement_date: string;
}

function parseCsv(text: string): ImportRow[] {
  const rows: ImportRow[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // Skip header row if it looks like one.
  const start = lines[0]?.toLowerCase().includes("gateway") ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 3) continue;
    rows.push({
      gateway_transaction_id: cols[0],
      amount: cols[1],
      settlement_date: cols[2],
    });
  }
  return rows;
}

export default function ReconciliationPage() {
  const [status, setStatus] = useState<RawReconciliationStatus | "">("");
  const [page, setPage] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [gateway, setGateway] = useState("BKASH");
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{
    id: string;
    notes: string;
    status: "RESOLVED" | "MATCHED" | "MISMATCH";
  } | null>(null);

  const { data, loading, error, refetch } = useApi(
    () =>
      listReconciliation({
        status: status || undefined,
        page,
        limit: 15,
      }),
    [status, page],
  );

  const records = data?.data ?? [];
  const meta = data?.meta;

  async function handleImport() {
    setImporting(true);
    setImportMsg(null);
    try {
      const rows = parseCsv(csv);
      if (rows.length === 0) {
        setImportMsg("No valid rows parsed from CSV.");
        return;
      }
      const parsed = rows.map((r) => ({
        gateway_transaction_id: r.gateway_transaction_id,
        amount: parseFloat(r.amount),
        settlement_date: r.settlement_date,
      }));
      const result = await importSettlement({
        gateway,
        records: parsed,
      });
      setImportMsg(
        `Imported ${result.imported} records · ${result.mismatches} mismatches`,
      );
      refetch();
    } catch (err) {
      setImportMsg(
        err instanceof ApiError
          ? err.message
          : "Couldn't import settlement CSV.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleResolve() {
    if (!resolving) return;
    try {
      await resolveReconciliation(resolving.id, {
        resolution: resolving.notes,
        status: resolving.status,
      });
      setResolving(null);
      refetch();
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Couldn't resolve the record.",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Reconciliation"
        description="Compare gateway settlements against internal payments."
        actions={
          <Button size="sm" onClick={() => setShowImport(true)}>
            Import CSV
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RawReconciliationStatus);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
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
          title="No reconciliation records"
          description="Import a gateway settlement CSV to start reconciling."
          action={
            <Button onClick={() => setShowImport(true)}>Import CSV</Button>
          }
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Gateway</th>
                  <th className="px-4 py-3 text-left">Transaction</th>
                  <th className="px-4 py-3 text-right">Internal</th>
                  <th className="px-4 py-3 text-right">Gateway</th>
                  <th className="px-4 py-3 text-right">Diff</th>
                  <th className="px-4 py-3 text-left">Settled</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-text-muted">{r.gateway}</td>
                    <td className="px-4 py-3 font-mono text-meta text-text-muted">
                      {r.gatewayTransactionId}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted">
                      {r.internalAmount !== null
                        ? formatBDT(r.internalAmount)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">
                      {formatBDT(r.gatewayAmount)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        r.difference !== null && r.difference !== 0
                          ? "text-danger"
                          : "text-success"
                      }`}
                    >
                      {r.difference !== null
                        ? formatBDT(r.difference)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {formatDate(r.settlementDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "MISMATCH" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResolving({
                              id: r.id,
                              notes: r.resolutionNotes ?? "",
                              status: "RESOLVED",
                            })
                          }
                        >
                          Resolve
                        </Button>
                      )}
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

      <Modal
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import settlement CSV"
      >
        <p className="mb-3 text-default text-text-muted">
          Paste CSV rows of <code className="font-mono">gateway_transaction_id,amount,settlement_date</code>.
          The first row may be a header and will be skipped.
        </p>
        <div className="space-y-3">
          <Input
            id="gateway"
            label="Gateway"
            value={gateway}
            onChange={(e) => setGateway(e.target.value.toUpperCase())}
            placeholder="BKASH"
          />
          <div>
            <label
              htmlFor="csv"
              className="mb-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
            >
              CSV
            </label>
            <textarea
              id="csv"
              rows={8}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="gateway_transaction_id,amount,settlement_date&#10;TX12345,25000,2026-09-21"
              className="w-full rounded-chip border border-border bg-card px-3.5 py-2.5 font-mono text-meta text-text placeholder:text-text-subtle focus:border-emerald focus:outline-none transition-colors"
            />
          </div>
          {importMsg && (
            <p className="text-default text-text-muted">{importMsg}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImport(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} loading={importing}>
            Import
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Resolve mismatch"
      >
        {resolving && (
          <div className="space-y-4">
            <Select
              id="resolve-status"
              label="Resolution status"
              value={resolving.status}
              onChange={(e) =>
                setResolving({
                  ...resolving,
                  status: e.target.value as "RESOLVED" | "MATCHED" | "MISMATCH",
                })
              }
              options={[
                { value: "RESOLVED", label: "Resolved" },
                { value: "MATCHED", label: "Matched (override)" },
                { value: "MISMATCH", label: "Mismatch (keep open)" },
              ]}
            />
            <div>
              <label
                htmlFor="resolve-notes"
                className="mb-1.5 block text-meta font-semibold uppercase tracking-[0.06em] text-text-muted"
              >
                Resolution notes
              </label>
              <textarea
                id="resolve-notes"
                rows={4}
                value={resolving.notes}
                onChange={(e) =>
                  setResolving({ ...resolving, notes: e.target.value })
                }
                className="w-full rounded-chip border border-border bg-card px-3.5 py-2.5 text-default text-text placeholder:text-text-subtle focus:border-emerald focus:outline-none transition-colors"
                placeholder="What was the cause? What did you do?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResolving(null)}>
                Cancel
              </Button>
              <Button onClick={handleResolve}>Save resolution</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
