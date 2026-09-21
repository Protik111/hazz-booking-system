import Link from "next/link";
import Container from "@/components/ui/Container";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <Container className="py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-chip bg-emerald text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-default font-bold text-text">HajjGo</span>
            </div>
            <p className="text-meta text-text-muted">
              Hajj & Umrah package booking, simplified.
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-meta font-semibold uppercase tracking-[0.06em] text-text">
              Browse
            </h4>
            <ul className="space-y-2 text-default">
              <li>
                <Link href="/packages" className="text-text-muted hover:text-text">
                  All packages
                </Link>
              </li>
              <li>
                <Link
                  href="/packages?type=HAJJ"
                  className="text-text-muted hover:text-text"
                >
                  Hajj
                </Link>
              </li>
              <li>
                <Link
                  href="/packages?type=RAMADAN_UMRAH"
                  className="text-text-muted hover:text-text"
                >
                  Ramadan Umrah
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-meta font-semibold uppercase tracking-[0.06em] text-text">
              Account
            </h4>
            <ul className="space-y-2 text-default">
              <li>
                <Link href="/login" className="text-text-muted hover:text-text">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-text-muted hover:text-text">
                  Sign up
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-text-muted hover:text-text">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-meta font-semibold uppercase tracking-[0.06em] text-text">
              Support
            </h4>
            <p className="text-meta text-text-muted">
              Reach out via your booking dashboard for refund, cancellation,
              and payment support.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-meta text-text-subtle">
          © {new Date().getFullYear()} HajjGo Booking System.
        </div>
      </Container>
    </footer>
  );
}