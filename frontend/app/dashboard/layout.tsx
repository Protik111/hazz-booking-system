"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/Skeleton";
import CardSkeleton from "@/components/ui/CardSkeleton";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/payments", label: "Payments" },
];

export default function DashboardLayout({
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
    } else if (status === "authenticated" && user?.role === "ADMIN") {
      // Admins still get a dashboard, but redirect to /admin for the main screen
      // only on the bare dashboard route
      if (pathname === "/dashboard") router.replace("/admin");
    }
  }, [status, user, pathname, router]);

  if (status === "loading") {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
          {TABS.map((tab) => (
            <Skeleton key={tab.href} className="mr-4 h-8 w-24" />
          ))}
        </nav>
        <div className="grid gap-4 sm:grid-cols-3">
          <CardSkeleton rows={2} withHeader />
          <CardSkeleton rows={2} withHeader />
          <CardSkeleton rows={2} withHeader />
        </div>
        <div className="mt-6">
          <CardSkeleton rows={4} />
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-default font-medium transition-colors",
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