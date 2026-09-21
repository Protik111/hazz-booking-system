import { Suspense } from "react";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import PackageCard from "@/components/booking/PackageCard";
import PackageFilters from "@/components/booking/PackageFilters";
import EmptyState from "@/components/ui/EmptyState";
import { listPackages } from "@/lib/api/endpoints";

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

  let packages: Awaited<ReturnType<typeof listPackages>>["data"] = [];
  let meta: Awaited<ReturnType<typeof listPackages>>["meta"] | null = null;
  let error: string | null = null;

  try {
    const result = await listPackages({
      type: (params.type as never) || undefined,
      departure_from: params.departure_from,
      departure_to: params.departure_to,
      page,
      limit: 12,
      sort: "departure_date:asc",
    });
    packages = result.data;
    meta = result.meta;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load packages";
  }

  return (
    <Container size="lg" className="py-10">
      <PageHeader
        title="Browse packages"
        description="Hajj, Ramadan Umrah, off-season Umrah, and Ziyarah packages — all in one place."
      />

      <Suspense>
        <PackageFilters />
      </Suspense>

      {error ? (
        <EmptyState
          title="Couldn't load packages"
          description={error}
          className="mt-8"
        />
      ) : packages.length === 0 ? (
        <EmptyState
          title="No packages match your filters"
          description="Try widening your search or clearing the filters."
          className="mt-8"
        />
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                href={buildPageHref(params, meta.page - 1)}
                className="rounded-chip border border-border px-3 py-1 hover:border-emerald hover:text-emerald"
              >
                Previous
              </a>
            )}
            {meta.page < meta.totalPages && (
              <a
                href={buildPageHref(params, meta.page + 1)}
                className="rounded-chip border border-border px-3 py-1 hover:border-emerald hover:text-emerald"
              >
                Next
              </a>
            )}
          </div>
        </nav>
      )}
    </Container>
  );
}

function buildPageHref(
  current: Awaited<PackagesPageProps["searchParams"]>,
  page: number,
) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v && k !== "page") sp.set(k, String(v));
  }
  sp.set("page", String(page));
  return `/packages?${sp.toString()}`;
}