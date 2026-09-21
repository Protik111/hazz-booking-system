"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  reportBookings,
  reportInstallments,
  reportPayments,
  reportRefunds,
  reportSeatQuota,
} from "@/lib/api/endpoints";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import KpiCard from "@/components/admin/KpiCard";
import StatusBadge from "@/components/booking/StatusBadge";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import { formatBDT, formatDate } from "@/lib/format";

type Tab = "overview" | "bookings" | "payments" | "installments" | "refunds" | "seat-quota";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <>
      <PageHeader
        title="Reports"
        description="Operational & financial reports for the platform."
      />

      <div className="mt-4 flex flex-wrap gap-1 border-b border-border">
        {(
          [
            { key: "overview", label: "Overview" },
            { key: "bookings", label: "Bookings" },
            { key: "payments", label: "Payments" },
            { key: "installments", label: "Installments" },
            { key: "refunds", label: "Refunds" },
            { key: "seat-quota", label: "Seat quota" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-default font-medium transition-colors ${
              tab === t.key
                ? "border-emerald text-emerald"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "installments" && <InstallmentsTab />}
        {tab === "refunds" && <RefundsTab />}
        {tab === "seat-quota" && <SeatQuotaTab />}
      </div>
    </>
  );
}

function OverviewTab() {
  const { data, loading, error, refetch } = useApi(() => reportSeatQuota(), []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Couldn't load report."} retry={refetch} />;
  }

  const summary = data.summary;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Total quota" value={summary.total_quota} />
        <KpiCard label="Available" value={summary.available_seats} tone="success" />
        <KpiCard label="Held" value={summary.held_seats} tone="warning" />
        <KpiCard label="Confirmed" value={summary.confirmed_seats} tone="success" />
        <KpiCard
          label="Utilization"
          value={`${summary.overall_utilization_percent}%`}
        />
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <table className="w-full text-default">
          <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
            <tr>
              <th className="px-4 py-3 text-left">Package</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Quota</th>
              <th className="px-4 py-3 text-right">Held</th>
              <th className="px-4 py-3 text-right">Confirmed</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Util.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.tiers.map((t, i) => (
              <tr key={`${t.tierId}-${i}`}>
                <td className="px-4 py-3 text-text">{t.packageName}</td>
                <td className="px-4 py-3 text-text-muted">{t.tierName}</td>
                <td className="px-4 py-3 text-right text-text">
                  {formatBDT(t.price)} {t.currency}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {t.totalQuota}
                </td>
                <td className="px-4 py-3 text-right text-text-muted">
                  {t.heldSeats}
                </td>
                <td className="px-4 py-3 text-right text-text-muted">
                  {t.confirmedSeats}
                </td>
                <td className="px-4 py-3 text-right text-text">
                  {t.availableSeats}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {t.utilizationRatePercent}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function BookingsTab() {
  const { data, loading, error, refetch } = useApi(
    () => reportBookings({}),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Couldn't load report."} retry={refetch} />;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total" value={data.summary.totalBookings} />
        <KpiCard label="Confirmed" value={data.summary.confirmed} tone="success" />
        <KpiCard label="Pending" value={data.summary.pending} tone="warning" />
        <KpiCard label="Cancelled" value={data.summary.cancelled} tone="danger" />
        <KpiCard label="Total amount" value={formatBDT(data.summary.totalAmount)} />
        <KpiCard label="Received" value={formatBDT(data.summary.totalReceived)} tone="success" />
        <KpiCard label="Outstanding" value={formatBDT(data.summary.totalOutstanding)} tone="warning" />
      </div>
      <Card className="mt-6 overflow-hidden p-0">
        <table className="w-full text-default">
          <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
            <tr>
              <th className="px-4 py-3 text-left">Booking</th>
              <th className="px-4 py-3 text-left">Departure</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.data.slice(0, 25).map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-text">
                    {b.package?.name ?? "—"}
                  </div>
                  <div className="font-mono text-meta text-text-subtle">
                    {b.bookingNumber}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {b.package?.departureDate
                    ? formatDate(b.package.departureDate)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {formatBDT(b.totalAmount)}
                </td>
                <td className="px-4 py-3 text-right text-text-muted">
                  {formatBDT(b.amountReceived)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function PaymentsTab() {
  const { data, loading, error, refetch } = useApi(() => reportPayments({}), []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Couldn't load report."} retry={refetch} />;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total payments" value={data.summary.totalPayments} />
        <KpiCard label="Total volume" value={formatBDT(data.summary.totalVolume)} tone="success" />
        <KpiCard
          label="Top method"
          value={
            Object.entries(data.summary.byMethod).sort(
              (a, b) => (b[1] ?? 0) - (a[1] ?? 0),
            )[0]?.[0] ?? "—"
          }
        />
        <KpiCard
          label="Success rate"
          value={
            data.summary.byStatus.SUCCESS
              ? `${data.summary.byStatus.SUCCESS} succeeded`
              : "—"
          }
        />
      </div>
      <Card className="mt-6 overflow-hidden p-0">
        <table className="w-full text-default">
          <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
            <tr>
              <th className="px-4 py-3 text-left">Booking</th>
              <th className="px-4 py-3 text-left">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.data.slice(0, 25).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-mono text-meta text-text-muted">
                  {p.bookingId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-text-muted">{p.method}</td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {formatBDT(p.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function InstallmentsTab() {
  const { data, loading, error, refetch } = useApi(
    () => reportInstallments({}),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Couldn't load report."} retry={refetch} />;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total" value={data.summary.totalInstallments} />
        <KpiCard label="Total due" value={formatBDT(data.summary.totalDue)} tone="warning" />
        <KpiCard label="Total paid" value={formatBDT(data.summary.totalPaid)} tone="success" />
        <KpiCard
          label="Overdue"
          value={data.summary.byStatus.OVERDUE ?? 0}
          tone={
            (data.summary.byStatus.OVERDUE ?? 0) > 0 ? "danger" : "neutral"
          }
        />
      </div>
      <Card className="mt-6 overflow-hidden p-0">
        <table className="w-full text-default">
          <thead className="bg-base text-meta uppercase tracking-[0.04em] text-text-subtle">
            <tr>
              <th className="px-4 py-3 text-left">Booking</th>
              <th className="px-4 py-3 text-left">Due date</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.data.slice(0, 25).map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-mono text-meta text-text-muted">
                  {i.bookingId.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {formatDate(i.dueDate)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-text">
                  {formatBDT(i.amount)}
                </td>
                <td className="px-4 py-3 text-right text-text-muted">
                  {formatBDT(i.paidAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={i.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function RefundsTab() {
  const { data, loading, error, refetch } = useApi(() => reportRefunds(), []);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error ?? "Couldn't load report."} retry={refetch} />;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total refunded" value={formatBDT(data.total_refunded)} tone="success" />
        <KpiCard label="Total pending" value={formatBDT(data.total_pending)} tone="warning" />
        <KpiCard label="Total count" value={data.total_count} />
        <KpiCard
          label="Approved"
          value={data.status_breakdown.APPROVED ?? 0}
        />
      </div>
    </>
  );
}

function SeatQuotaTab() {
  return <OverviewTab />;
}