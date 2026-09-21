"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { adminListPackages, RawPackageStatus, RawPackageType } from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/booking/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { formatBDT, formatDate } from "@/lib/format";

const PACKAGE_TYPE_LABEL: Record<string, string> = {
  HAJJ: "Hajj",
  RAMADAN_UMRAH: "Ramadan Umrah",
  OFF_SEASON_UMRAH: "Off-season Umrah",
  ZIYARAH: "Ziyarah",
};

export default function AdminPackagesPage() {
  const [status, setStatus] = useState<RawPackageStatus | "">("");
  const [type, setType] = useState<RawPackageType | "">("");
  const [page, setPage] = useState(1);

  const { data, loading, error, refetch } = useApi(
    () =>
      adminListPackages({
        status: status || undefined,
        type: type || undefined,
        page,
        limit: 10,
      }),
    [status, type, page],
  );

  const packages = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader
        title="Packages"
        description="Create, edit, and manage package inventory."
        actions={
          <Button href="/admin/packages/new" size="sm">
            New package
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Select
          id="type-filter"
          value={type}
          onChange={(e) => {
            setType(e.target.value as RawPackageType);
            setPage(1);
          }}
          options={[
            { value: "", label: "All types" },
            { value: "HAJJ", label: "Hajj" },
            { value: "RAMADAN_UMRAH", label: "Ramadan Umrah" },
            { value: "OFF_SEASON_UMRAH", label: "Off-season Umrah" },
            { value: "ZIYARAH", label: "Ziyarah" },
          ]}
          className="min-w-[180px]"
        />
        <Select
          id="status-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as RawPackageStatus);
            setPage(1);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published" },
            { value: "CLOSED", label: "Closed" },
            { value: "CANCELLED", label: "Cancelled" },
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
      ) : packages.length === 0 ? (
        <EmptyState
          title="No packages found"
          description="Try a different filter or create a new one."
          action={<Button href="/admin/packages/new">Create package</Button>}
          className="mt-6"
        />
      ) : (
        <>
          <Card className="mt-6 overflow-hidden p-0">
            <table className="w-full text-default">
              <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Departure</th>
                  <th className="px-4 py-3 text-right">Tiers</th>
                  <th className="px-4 py-3 text-right">Total quota</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {packages.map((p) => {
                  const totalQuota = p.tiers.reduce(
                    (s, t) => s + t.totalQuota,
                    0,
                  );
                  const minPrice = p.tiers.reduce(
                    (min, t) => (t.price < min ? t.price : min),
                    Number.POSITIVE_INFINITY,
                  );
                  return (
                    <tr key={p.id} className="hover:bg-base">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/packages/${p.id}`}
                          className="font-medium text-text hover:text-emerald"
                        >
                          {p.name}
                        </Link>
                        <p className="text-meta text-text-subtle">
                          {p.slug} · from {formatBDT(minPrice)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {PACKAGE_TYPE_LABEL[p.type] ?? p.type}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {formatDate(p.departureDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-muted">
                        {p.tiers.length}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text">
                        {totalQuota}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
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
    </>
  );
}
