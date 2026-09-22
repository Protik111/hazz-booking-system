"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/Skeleton";
import KpiGridSkeleton from "@/components/ui/KpiGridSkeleton";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/manual-payments", label: "Manual payments" },
  { href: "/admin/cancellations", label: "Cancellations" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/reconciliation", label: "Reconciliation" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-logs", label: "Audit logs" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "authenticated" && user?.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, user, pathname, router]);

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32 rounded-pill" />
        <nav className="mb-6 mt-3 flex flex-wrap gap-x-1 gap-y-0 border-b border-border">
          {TABS.map((tab) => (
            <Skeleton key={tab.href} className="mr-3 h-8 w-24" />
          ))}
        </nav>
        <KpiGridSkeleton count={6} />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-card border border-border bg-card p-6">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-card border border-border bg-card p-6">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 inline-flex items-center gap-2 rounded-pill border border-gold/30 bg-gold-bg px-3 py-1 text-meta font-medium text-gold">
        <span aria-hidden>🛡</span>
        Admin mode
      </div>

      <nav className="mb-6 mt-3 flex flex-wrap gap-x-1 gap-y-0 border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-meta font-medium transition-colors whitespace-nowrap",
                active
                  ? "border-emerald text-emerald"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
