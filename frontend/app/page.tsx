import Link from "next/link";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PackageCard from "@/components/booking/PackageCard";
import { listPackages } from "@/lib/api/endpoints";
import { formatBDT } from "@/lib/format";

const FEATURES = [
  {
    title: "Browse published packages",
    description:
      "Hajj, Ramadan Umrah, off-season Umrah, and Ziyarah — all in one place, with seats and prices in real time.",
  },
  {
    title: "Reserve seats safely",
    description:
      "Concurrent seat-hold logic means you'll never oversell — your reservation is locked the moment you book.",
  },
  {
    title: "Full payment or installments",
    description:
      "Pay the full amount or split into 2–3 installments. Final installments are due before departure.",
  },
  {
    title: "Mobile-friendly",
    description:
      "Book and manage your trip from any device. All data is current — refreshing isn't required.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Sign up",
    description:
      "Create an account with your name, email, and phone — takes a minute.",
  },
  {
    step: "02",
    title: "Pick a package",
    description:
      "Browse packages by type, departure date, and price. Compare tiers (Economy, Standard, VIP).",
  },
  {
    step: "03",
    title: "Add pilgrims",
    description:
      "Submit passport info for each traveler — your seat count is reserved in real time.",
  },
  {
    step: "04",
    title: "Pay securely",
    description:
      "Pay via bKash, Nagad, Visa, or manual bank deposit — with full or installment plans.",
  },
];

export default async function HomePage() {
  let packages: Awaited<ReturnType<typeof listPackages>>["data"] = [];
  try {
    const result = await listPackages({ limit: 3, sort: "departure_date:asc" });
    packages = result.data;
  } catch {
    // Backend offline is fine on first visit — show the landing without data.
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-card">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-emerald/5 to-transparent lg:block" />
        <Container size="lg" className="relative py-20 sm:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <span className="inline-flex items-center rounded-pill border border-emerald/30 bg-emerald/10 px-3 py-1 text-meta font-semibold uppercase tracking-[0.04em] text-emerald">
                Hajj & Umrah, simplified
              </span>
              <h1 className="text-hero font-bold leading-tight text-text">
                Book your spiritual journey with{" "}
                <span className="text-emerald">confidence.</span>
              </h1>
              <p className="max-w-lg text-lead text-text-muted">
                Real-time seat availability, secure reservation, and transparent
                pricing. Plan your Hajj or Umrah package online — without the
                back-and-forth.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href="/packages" size="lg">
                  Browse packages
                </Button>
                <Button href="/register" size="lg" variant="outline">
                  Create account
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-meta text-text-subtle">
                <span>✓ Secure reservation</span>
                <span>✓ Installments available</span>
                <span>✓ Refund-friendly</span>
              </div>
            </div>

            <div className="relative">
              <Card className="relative overflow-hidden border-emerald/20">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald/10 blur-2xl" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-meta font-semibold uppercase tracking-[0.06em] text-text-subtle">
                      Sample package
                    </span>
                    <span className="rounded-pill border border-success/30 bg-success-bg px-2.5 py-0.5 text-meta font-medium text-success">
                      Published
                    </span>
                  </div>
                  <div>
                    <h3 className="text-card-title font-bold text-text">
                      Hajj Premium 2027
                    </h3>
                    <p className="mt-1 text-meta text-text-muted">
                      16 days · Standard tier
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <Stat label="Departure" value="May 20" />
                    <Stat label="Seats" value="40 left" />
                    <Stat label="From" value={formatBDT(450000)} />
                  </div>
                  <div className="border-t border-border pt-3">
                    <Link
                      href="/packages"
                      className="text-default font-semibold text-emerald hover:underline"
                    >
                      See all packages →
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container size="lg">
          <div className="mb-10 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-meta font-semibold uppercase tracking-[0.06em] text-emerald">
                Featured
              </span>
              <h2 className="mt-1 text-section font-bold text-text">
                Upcoming packages
              </h2>
            </div>
            <Link
              href="/packages"
              className="text-default font-semibold text-emerald hover:underline"
            >
              View all →
            </Link>
          </div>
          {packages.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          ) : (
            <Card className="text-center">
              <p className="text-default text-text-muted">
                Packages will appear here once the backend publishes them.
              </p>
            </Card>
          )}
        </Container>
      </section>

      <section className="border-y border-border bg-card py-16 sm:py-20">
        <Container size="lg">
          <div className="mb-10 max-w-2xl">
            <span className="text-meta font-semibold uppercase tracking-[0.06em] text-emerald">
              What you get
            </span>
            <h2 className="mt-1 text-section font-bold text-text">
              Everything you need to book with confidence
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="h-full">
                <h3 className="text-default font-semibold text-text">
                  {f.title}
                </h3>
                <p className="mt-2 text-meta text-text-muted">
                  {f.description}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container size="lg">
          <div className="mb-10 max-w-2xl">
            <span className="text-meta font-semibold uppercase tracking-[0.06em] text-emerald">
              How it works
            </span>
            <h2 className="mt-1 text-section font-bold text-text">
              Four steps from sign-up to seat
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <Card key={s.step} className="h-full">
                <span className="text-meta font-bold uppercase tracking-[0.06em] text-emerald">
                  Step {s.step}
                </span>
                <h3 className="mt-2 text-default font-semibold text-text">
                  {s.title}
                </h3>
                <p className="mt-2 text-meta text-text-muted">
                  {s.description}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-border bg-card py-16">
        <Container size="md" className="text-center">
          <h2 className="text-section font-bold text-text">
            Ready to start?
          </h2>
          <p className="mt-3 text-default text-text-muted">
            Browse the package catalog or create your account to reserve seats.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/packages" size="lg">
              Browse packages
            </Button>
            <Button href="/register" size="lg" variant="outline">
              Sign up
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-chip border border-border bg-base p-2.5">
      <div className="text-meta uppercase tracking-[0.04em] text-text-subtle">
        {label}
      </div>
      <div className="mt-0.5 text-default font-semibold text-text">
        {value}
      </div>
    </div>
  );
}
