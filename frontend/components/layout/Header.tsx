"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

interface NavLink {
  href: string;
  label: string;
}

const PUBLIC_LINKS: NavLink[] = [
  { href: "/packages", label: "Packages" },
];

const USER_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/payments", label: "Payments" },
];

const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/cancellations", label: "Cancellations" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit-logs", label: "Audit" },
];

export default function Header() {
  const { status, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const links =
    user?.role === "ADMIN" ? ADMIN_LINKS : status === "authenticated" ? USER_LINKS : PUBLIC_LINKS;

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-emerald text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 2L21 7L12 12L3 7L12 2Z"
                  fill="currentColor"
                  opacity="0.3"
                />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-default font-bold text-text">HajjGo</div>
              <div className="text-meta text-text-subtle">Booking System</div>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-chip px-3 py-1.5 text-default font-medium transition-colors",
                    active
                      ? "bg-emerald/10 text-emerald"
                      : "text-text-muted hover:bg-base hover:text-text",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {status === "loading" ? (
              <div className="h-9 w-24 rounded-chip bg-base" />
            ) : status === "authenticated" && user ? (
              <>
                <div className="hidden text-right sm:block">
                  <div className="text-default font-semibold text-text">{user.name}</div>
                  <div className="text-meta text-text-subtle">{user.role}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Log in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}