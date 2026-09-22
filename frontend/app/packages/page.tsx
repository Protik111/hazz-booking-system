import { Suspense } from "react";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import PackageCard from "@/components/booking/PackageCard";
import PackageFilters from "@/components/booking/PackageFilters";
import PackageAvailabilityCalendar from "@/components/booking/PackageAvailabilityCalendar";
import EmptyState from "@/components/ui/EmptyState";
import {
  getPackageAvailability,
  listPackages,
  type PackageAvailability,
} from "@/lib/api/endpoints";
import { monthKey, parseMonthFromIso } from "@/lib/format";
import { buildPackagesHref } from "@/lib/booking/packagesHref";

interface PackagesPageProps {
  searchParams: Promise<{
    type?: string;
    departure_from?: string;
    departure_to?: string;
    page?: string;
  }>;
}

export default async function PackagesPage({ searchParams }: PackagesPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10) || 1;

  // Pick the calendar's focused month+year. URL `departure_from` wins;
  // fall back to the current calendar month.
  const parsed = parseMonthFromIso(params.departure_from);
  const now = new Date();
  const year = parsed?.year ?? now.getUTCFullYear();
  const monthIdx = parsed?.monthIdx ?? now.getUTCMonth();
  const focusedMonth = monthKey(year, monthIdx);

  // Fetch the result list and the availability hint in parallel — they are
  // independent. Lifting both to the server avoids two duplicate client
  // roundtrips when both <PackageFilters/> and <PackageAvailabilityCalendar/>
  // would otherwise fetch availability independently.
  const typeFilter = (params.type as never) || undefined;

  type ListResult = Awaited<ReturnType<typeof listPackages>>;
  const [listResult, availability] = await Promise.all([
    listPackages({
      type: typeFilter,
      departure_from: params.departure_from,
      departure_to: params.departure_to,
      page,
      limit: 12,
      sort: "departure_date:asc",
    }).catch<ListResult | { __error: string }>((err) => ({
      __error: err instanceof Error ? err.message : "Failed to load packages",
    })),
    getPackageAvailability({ type: typeFilter, year }).catch<PackageAvailability | null>(
      () => null,
    ),
  ]);

  const isError = "__error" in listResult;
  const error = isError ? listResult.__error : null;
  const packages = isError ? [] : listResult.data;
  const meta = isError ? null : listResult.meta;

  // Highlight the day only if the URL filter is a single-day match.
  const selectedDate =
    params.departure_from && params.departure_from === params.departure_to
      ? params.departure_from
      : null;

  return (
    <Container size="lg" className="py-10">
      <PageHeader
        title="Browse packages"
        description="Hajj, Ramadan Umrah, off-season Umrah, and Ziyarah packages — all in one place."
      />

      <Suspense>
        <PackageFilters
          availability={availability}
          currentType={params.type ?? ""}
          currentFrom={params.departure_from ?? ""}
        />
      </Suspense>

      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PackageAvailabilityCalendar
            month={focusedMonth}
            type={params.type ?? undefined}
            selectedDate={selectedDate}
            availability={availability}
          />
        </aside>

        <section>
          {error ? (
            <EmptyState
              title="Couldn't load packages"
              description={error}
            />
          ) : packages.length === 0 ? (
            <EmptyState
              title="No packages match your filters"
              description="Try widening your search or clearing the filters."
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} />
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-between text-meta text-text-muted">
              <span>
                Page {meta.page} of {meta.totalPages} · {meta.total} packages
              </span>
              <div className="flex gap-2">
                {meta.page > 1 && (
                  <a
                    href={buildPackagesHref({
                      type: params.type,
                      from: params.departure_from,
                      to: params.departure_to,
                      page: meta.page - 1,
                    })}
                    className="rounded-chip border border-border px-3 py-1 hover:border-emerald hover:text-emerald"
                  >
                    Previous
                  </a>
                )}
                {meta.page < meta.totalPages && (
                  <a
                    href={buildPackagesHref({
                      type: params.type,
                      from: params.departure_from,
                      to: params.departure_to,
                      page: meta.page + 1,
                    })}
                    className="rounded-chip border border-border px-3 py-1 hover:border-emerald hover:text-emerald"
                  >
                    Next
                  </a>
                )}
              </div>
            </nav>
          )}
        </section>
      </div>
    </Container>
  );
}
