/**
 * Builds `/packages?...` search strings for the public package list page.
 * Centralizing this keeps the type/date/page params in sync across the
 * filters component, the availability calendar, and the page itself.
 */
export interface PackagesHrefParams {
  type?: string;
  /** ISO date YYYY-MM-DD. Sets both `departure_from` and `departure_to`. */
  day?: string;
  /** ISO date YYYY-MM-DD range. */
  from?: string;
  to?: string;
  page?: number;
}

export function buildPackagesHref(params: PackagesHrefParams): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);

  if (params.day) {
    sp.set("departure_from", params.day);
    sp.set("departure_to", params.day);
  } else {
    if (params.from) sp.set("departure_from", params.from);
    if (params.to) sp.set("departure_to", params.to);
  }
  if (params.page && params.page > 1) sp.set("page", String(params.page));

  const qs = sp.toString();
  return qs ? `/packages?${qs}` : "/packages";
}
