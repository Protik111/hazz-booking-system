/**
 * All API endpoint functions for the Hajj & Umrah Booking System.
 * Each function maps to one backend endpoint per docs/API_SPEC.md.
 *
 * Each function returns the camelCase / number-friendly shape produced by
 * `lib/api/normalize.ts`, so callers can import the camelCase domain types
 * from there without ever seeing a snake_case field or a DECIMAL-as-string.
 */
import { apiRequest } from "./client";
import {
  normalizeAdminPackage,
  normalizeAuditLog,
  normalizeBooking,
  normalizeCancellation,
  normalizeInstallment,
  normalizeInventoryItem,
  normalizeInventoryTransaction,
  normalizeManualPayment,
  normalizePackageTier,
  normalizePayment,
  normalizePilgrim,
  normalizePublicPackage,
  normalizeReconciliation,
  normalizeRefund,
  normalizeReportOverview,
  normalizeSeatQuotaRow,
  normalizeUser,
  normalizeVendor,
  normalizeVendorExpense,
} from "./normalize";
import type {
  AdminPackage,
  AuditLog,
  Booking,
  CancellationRequest,
  Installment,
  InventoryItem,
  InventoryTransaction,
  ManualPayment,
  Paginated,
  PackageTier,
  Payment,
  Pilgrim,
  PublicPackage,
  ReconciliationRecord,
  Refund,
  ReportOverview,
  SeatQuotaRow,
  User,
  Vendor,
  VendorExpense,
} from "./normalize";
import type {
  RawAdminPackage,
  RawAuditLog,
  RawBooking,
  RawCancellationRequest,
  RawInstallment,
  RawInventoryItem,
  RawInventoryTransaction,
  RawManualPayment,
  RawPackageTier,
  RawPayment,
  RawPilgrim,
  RawPublicPackage,
  RawReconciliationRecord,
  RawRefund,
  RawReconciliationStatus,
  RawSeatQuotaRow,
  RawReportOverview,
  RawUser,
  RawVendor,
  RawVendorExpense,
  RawPackageType,
  RawPackageStatus,
  RawTierName,
  RawPaymentMethod,
  RawVendorType,
  RawInventoryTransactionType,
  SuccessEnvelope,
} from "./types";

// ─── Auth ─────────────────────────────────────────────────────────────────

export async function register(body: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<User> {
  const res = await apiRequest<SuccessEnvelope<{ user: RawUser }>>(
    "/auth/register",
    { method: "POST", body },
  );
  return normalizeUser(res.data.user);
}

export async function login(email: string, password: string): Promise<User> {
  // Backend returns { user, access_token, refresh_token }; the cookies are
  // set as HttpOnly by the response. We only need the user here.
  const res = await apiRequest<SuccessEnvelope<{ user: RawUser }>>(
    "/auth/login",
    { method: "POST", body: { email, password } },
  );
  return normalizeUser(res.data.user);
}

export async function logout(): Promise<void> {
  await apiRequest("/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<User> {
  const res = await apiRequest<SuccessEnvelope<{ user: RawUser }>>(
    "/auth/me",
  );
  return normalizeUser(res.data.user);
}

// ─── Public Packages ──────────────────────────────────────────────────────

export interface ListPackagesParams {
  type?: RawPackageType | "";
  departure_from?: string;
  departure_to?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export async function listPackages(
  params: ListPackagesParams = {},
): Promise<Paginated<PublicPackage>> {
  const res = await apiRequest<SuccessEnvelope<RawPublicPackage[]>>(
    "/packages",
    {
      query: params as Record<string, string | number | undefined>,
    },
  );
  return { data: res.data.map(normalizePublicPackage), meta: res.meta! };
}

export async function getPackage(id: string): Promise<PublicPackage> {
  const res = await apiRequest<SuccessEnvelope<RawPublicPackage>>(
    `/packages/${id}`,
  );
  return normalizePublicPackage(res.data);
}

export interface PackageAvailability {
  type: string;
  year: number;
  months: Array<{ month: string; count: number }>;
  /** Sparse `YYYY-MM-DD → true` for days with at least one published package. */
  days: Record<string, boolean>;
}

/**
 * Cheap aggregation endpoint that powers the public /packages calendar UI.
 * Returns month buckets and per-day booleans for the given year + optional type.
 */
export async function getPackageAvailability(params: {
  type?: RawPackageType | "";
  year?: number;
} = {}): Promise<PackageAvailability> {
  const res = await apiRequest<SuccessEnvelope<PackageAvailability>>(
    "/packages/availability",
    { query: params as Record<string, string | number | undefined> },
  );
  return res.data;
}

// ─── Admin — Packages ─────────────────────────────────────────────────────

export async function adminListPackages(params: {
  type?: RawPackageType | "";
  status?: RawPackageStatus | "";
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<AdminPackage>> {
  const res = await apiRequest<SuccessEnvelope<RawAdminPackage[]>>(
    "/admin/packages",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeAdminPackage), meta: res.meta! };
}

export async function adminGetPackage(id: string): Promise<AdminPackage> {
  const res = await apiRequest<SuccessEnvelope<RawAdminPackage>>(
    `/admin/packages/${id}`,
  );
  return normalizeAdminPackage(res.data);
}

export async function createPackage(body: {
  name: string;
  type: RawPackageType;
  description?: string;
  departure_date: string;
  return_date: string;
  booking_start: string;
  booking_end: string;
  tiers?: Array<{
    name: RawTierName;
    price: number;
    currency?: string;
    total_quota: number;
  }>;
}): Promise<AdminPackage> {
  const res = await apiRequest<SuccessEnvelope<RawAdminPackage>>(
    "/admin/packages",
    { method: "POST", body },
  );
  return normalizeAdminPackage(res.data);
}

export async function updatePackage(
  id: string,
  body: Partial<{
    name: string;
    type: RawPackageType;
    description: string | null;
    status: RawPackageStatus;
    departure_date: string;
    return_date: string;
    booking_start: string;
    booking_end: string;
  }>,
): Promise<AdminPackage> {
  const res = await apiRequest<SuccessEnvelope<RawAdminPackage>>(
    `/admin/packages/${id}`,
    { method: "PATCH", body },
  );
  return normalizeAdminPackage(res.data);
}

export async function deletePackage(id: string): Promise<void> {
  await apiRequest(`/admin/packages/${id}`, { method: "DELETE" });
}

// ─── Admin — Tiers ────────────────────────────────────────────────────────

export async function createTier(
  packageId: string,
  body: {
    name: RawTierName;
    price: number;
    currency?: string;
    total_quota: number;
  },
): Promise<PackageTier> {
  const res = await apiRequest<SuccessEnvelope<RawPackageTier>>(
    `/admin/packages/${packageId}/tiers`,
    { method: "POST", body },
  );
  return normalizePackageTier(res.data);
}

export async function updateTier(
  tierId: string,
  body: Partial<{
    name: RawTierName;
    price: number;
    currency: string;
    status: "ACTIVE" | "INACTIVE";
  }>,
): Promise<PackageTier> {
  const res = await apiRequest<SuccessEnvelope<RawPackageTier>>(
    `/admin/tiers/${tierId}`,
    { method: "PATCH", body },
  );
  return normalizePackageTier(res.data);
}

export async function adjustQuota(
  tierId: string,
  total_quota: number,
): Promise<PackageTier> {
  const res = await apiRequest<SuccessEnvelope<RawPackageTier>>(
    `/admin/tiers/${tierId}/quota`,
    { method: "PATCH", body: { total_quota } },
  );
  return normalizePackageTier(res.data);
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export interface CreateBookingBody {
  package_id: string;
  package_tier_id: string;
  payment_plan: "FULL_PAYMENT" | "INSTALLMENT";
  pilgrim_count?: number;
  pilgrims: Array<{
    full_name: string;
    date_of_birth: string;
    gender: "MALE" | "FEMALE";
    nationality: string;
    passport_number: string;
    passport_issue_date?: string;
    passport_expiry_date?: string;
    phone?: string;
    email?: string;
  }>;
}

export async function createBooking(
  body: CreateBookingBody,
  idempotencyKey?: string,
): Promise<Booking> {
  const res = await apiRequest<SuccessEnvelope<RawBooking>>("/bookings", {
    method: "POST",
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
  return normalizeBooking(res.data);
}

export async function listBookings(params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Booking>> {
  const res = await apiRequest<SuccessEnvelope<RawBooking[]>>("/bookings", {
    query: params as Record<string, string | number | undefined>,
  });
  return { data: res.data.map(normalizeBooking), meta: res.meta! };
}

export async function getBooking(id: string): Promise<Booking> {
  const res = await apiRequest<SuccessEnvelope<RawBooking>>(`/bookings/${id}`);
  return normalizeBooking(res.data);
}

export async function cancelBooking(id: string): Promise<Booking> {
  const res = await apiRequest<SuccessEnvelope<RawBooking>>(
    `/bookings/${id}/cancel`,
    { method: "POST" },
  );
  return normalizeBooking(res.data);
}

// ─── Pilgrims ─────────────────────────────────────────────────────────────

export async function listPilgrims(bookingId: string): Promise<Pilgrim[]> {
  const res = await apiRequest<SuccessEnvelope<RawPilgrim[]>>(
    `/bookings/${bookingId}/pilgrims`,
  );
  return res.data.map(normalizePilgrim);
}

export async function cancelPilgrim(
  bookingId: string,
  pilgrimId: string,
): Promise<void> {
  await apiRequest(`/bookings/${bookingId}/pilgrims/${pilgrimId}/cancel`, {
    method: "POST",
  });
}

// ─── Installments ─────────────────────────────────────────────────────────

export async function listInstallments(
  bookingId: string,
): Promise<Installment[]> {
  const res = await apiRequest<SuccessEnvelope<RawInstallment[]>>(
    `/bookings/${bookingId}/installments`,
  );
  return res.data.map(normalizeInstallment);
}

// ─── Payments ─────────────────────────────────────────────────────────────

export async function initiatePayment(body: {
  booking_id: string;
  amount: number;
  method: RawPaymentMethod;
}): Promise<Payment> {
  const res = await apiRequest<SuccessEnvelope<RawPayment>>("/payments", {
    method: "POST",
    body,
  });
  return normalizePayment(res.data);
}

export async function listPayments(params: {
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Payment>> {
  const res = await apiRequest<SuccessEnvelope<RawPayment[]>>("/payments", {
    query: params as Record<string, string | number | undefined>,
  });
  return { data: res.data.map(normalizePayment), meta: res.meta! };
}

export async function getPayment(id: string): Promise<Payment> {
  const res = await apiRequest<SuccessEnvelope<RawPayment>>(
    `/payments/${id}`,
  );
  return normalizePayment(res.data);
}

/** Mock gateway — simulate payment success (assessment only) */
export async function mockPaymentSuccess(paymentId: string): Promise<Payment> {
  const res = await apiRequest<SuccessEnvelope<RawPayment>>(
    `/mock-payments/${paymentId}/success`,
    { method: "POST" },
  );
  return normalizePayment(res.data);
}

/** Mock gateway — simulate payment failure (assessment only) */
export async function mockPaymentFail(paymentId: string): Promise<Payment> {
  const res = await apiRequest<SuccessEnvelope<RawPayment>>(
    `/mock-payments/${paymentId}/fail`,
    { method: "POST" },
  );
  return normalizePayment(res.data);
}

// ─── Cancellations ────────────────────────────────────────────────────────

export async function requestCancellation(
  bookingId: string,
  reason: string,
): Promise<CancellationRequest> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest>>(
    `/bookings/${bookingId}/cancellation-request`,
    { method: "POST", body: { reason } },
  );
  return normalizeCancellation(res.data);
}

export async function listBookingCancellations(
  bookingId: string,
): Promise<CancellationRequest[]> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest[]>>(
    `/bookings/${bookingId}/cancellation-requests`,
  );
  return res.data.map(normalizeCancellation);
}

// ─── Admin — Bookings ─────────────────────────────────────────────────────

export async function adminListBookings(params: {
  status?: string;
  package_id?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Booking>> {
  const res = await apiRequest<SuccessEnvelope<RawBooking[]>>(
    "/admin/bookings",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeBooking), meta: res.meta! };
}

export async function adminGetBooking(id: string): Promise<Booking> {
  const res = await apiRequest<SuccessEnvelope<RawBooking>>(
    `/admin/bookings/${id}`,
  );
  return normalizeBooking(res.data);
}

// ─── Admin — Manual Payments ──────────────────────────────────────────────

export async function createManualPayment(body: {
  booking_id: string;
  amount: number;
  reference: string;
  notes?: string;
}): Promise<ManualPayment> {
  const res = await apiRequest<SuccessEnvelope<RawManualPayment>>(
    "/admin/manual-payments",
    { method: "POST", body },
  );
  return normalizeManualPayment(res.data);
}

export async function approveManualPayment(
  id: string,
): Promise<ManualPayment> {
  const res = await apiRequest<SuccessEnvelope<RawManualPayment>>(
    `/admin/manual-payments/${id}/approve`,
    { method: "POST" },
  );
  return normalizeManualPayment(res.data);
}

export async function rejectManualPayment(
  id: string,
  reason: string,
): Promise<ManualPayment> {
  const res = await apiRequest<SuccessEnvelope<RawManualPayment>>(
    `/admin/manual-payments/${id}/reject`,
    { method: "POST", body: { reason } },
  );
  return normalizeManualPayment(res.data);
}

export async function adminListPayments(params: {
  method?: RawPaymentMethod | "";
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Payment>> {
  const res = await apiRequest<SuccessEnvelope<RawPayment[]>>(
    "/admin/payments",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizePayment), meta: res.meta! };
}

// ─── Admin — Cancellations ────────────────────────────────────────────────

export async function adminListCancellations(params: {
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<CancellationRequest>> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest[]>>(
    "/admin/cancellations",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeCancellation), meta: res.meta! };
}

export async function adminGetCancellation(
  id: string,
): Promise<CancellationRequest> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest>>(
    `/cancellations/${id}`,
  );
  return normalizeCancellation(res.data);
}

export async function approveCancellation(
  id: string,
  body: { cancellation_charge?: number } = {},
): Promise<CancellationRequest> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest>>(
    `/admin/cancellations/${id}/approve`,
    { method: "POST", body },
  );
  return normalizeCancellation(res.data);
}

export async function rejectCancellation(
  id: string,
  reason: string,
): Promise<CancellationRequest> {
  const res = await apiRequest<SuccessEnvelope<RawCancellationRequest>>(
    `/admin/cancellations/${id}/reject`,
    { method: "POST", body: { reason } },
  );
  return normalizeCancellation(res.data);
}

// ─── Refunds ──────────────────────────────────────────────────────────────

export async function listBookingRefunds(
  bookingId: string,
): Promise<Refund[]> {
  const res = await apiRequest<SuccessEnvelope<RawRefund[]>>(
    `/bookings/${bookingId}/refunds`,
  );
  return res.data.map(normalizeRefund);
}

export async function createRefund(body: {
  booking_id: string;
  payment_id?: string;
  amount: number;
  reason?: string;
}): Promise<Refund> {
  const res = await apiRequest<SuccessEnvelope<RawRefund>>("/refunds", {
    method: "POST",
    body,
  });
  return normalizeRefund(res.data);
}

// ─── Admin — Refunds ──────────────────────────────────────────────────────

export async function adminListRefunds(params: {
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Refund>> {
  const res = await apiRequest<SuccessEnvelope<RawRefund[]>>(
    "/admin/refunds",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeRefund), meta: res.meta! };
}

export async function approveRefund(id: string): Promise<Refund> {
  const res = await apiRequest<SuccessEnvelope<RawRefund>>(
    `/admin/refunds/${id}/approve`,
    { method: "POST" },
  );
  return normalizeRefund(res.data);
}

export async function processRefund(
  id: string,
  body: { gateway_reference?: string } = {},
): Promise<Refund> {
  const res = await apiRequest<SuccessEnvelope<RawRefund>>(
    `/admin/refunds/${id}/process`,
    { method: "POST", body },
  );
  return normalizeRefund(res.data);
}

export async function rejectRefund(
  id: string,
  reason: string,
): Promise<Refund> {
  const res = await apiRequest<SuccessEnvelope<RawRefund>>(
    `/admin/refunds/${id}/reject`,
    { method: "POST", body: { reason } },
  );
  return normalizeRefund(res.data);
}

// ─── Admin — Reconciliation ───────────────────────────────────────────────

export async function listReconciliation(params: {
  status?: RawReconciliationStatus | "";
  gateway?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<ReconciliationRecord>> {
  const res = await apiRequest<SuccessEnvelope<RawReconciliationRecord[]>>(
    "/admin/reconciliation",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeReconciliation), meta: res.meta! };
}

export async function importSettlement(body: {
  gateway: string;
  records: Array<{
    gateway_transaction_id: string;
    amount: number;
    settlement_date: string;
  }>;
}): Promise<{ imported: number; mismatches: number }> {
  return apiRequest("/admin/reconciliation/import", {
    method: "POST",
    body,
  });
}

export async function resolveReconciliation(
  id: string,
  body: { resolution: string; status: "RESOLVED" | "MATCHED" | "MISMATCH" },
): Promise<ReconciliationRecord> {
  const res = await apiRequest<SuccessEnvelope<RawReconciliationRecord>>(
    `/admin/reconciliation/${id}/resolve`,
    { method: "POST", body },
  );
  return normalizeReconciliation(res.data);
}

// ─── Admin — Vendors ──────────────────────────────────────────────────────

export async function listVendors(params: {
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<Vendor>> {
  const res = await apiRequest<SuccessEnvelope<RawVendor[]>>(
    "/admin/vendors",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeVendor), meta: res.meta! };
}

export async function createVendor(body: {
  name: string;
  type: RawVendorType;
  contact_info?: string;
}): Promise<Vendor> {
  const res = await apiRequest<SuccessEnvelope<RawVendor>>(
    "/admin/vendors",
    { method: "POST", body },
  );
  return normalizeVendor(res.data);
}

export async function updateVendor(
  id: string,
  body: Partial<{ name: string; type: RawVendorType; contact_info: string }>,
): Promise<Vendor> {
  const res = await apiRequest<SuccessEnvelope<RawVendor>>(
    `/admin/vendors/${id}`,
    { method: "PATCH", body },
  );
  return normalizeVendor(res.data);
}

export async function deleteVendor(id: string): Promise<void> {
  await apiRequest(`/admin/vendors/${id}`, { method: "DELETE" });
}

export async function listVendorExpenses(params: {
  vendor?: string;
  booking_id?: string;
  package_id?: string;
  expense_type?: RawVendorType;
  currency?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<VendorExpense>> {
  const res = await apiRequest<SuccessEnvelope<RawVendorExpense[]>>(
    "/admin/vendor-expenses",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeVendorExpense), meta: res.meta! };
}

export async function createVendorExpense(body: {
  vendor_id: string;
  booking_id?: string;
  expense_type: RawVendorType;
  amount: number;
  currency: string;
  exchange_rate: number;
  expense_date: string;
  notes?: string;
}): Promise<VendorExpense> {
  const res = await apiRequest<SuccessEnvelope<RawVendorExpense>>(
    "/admin/vendor-expenses",
    { method: "POST", body },
  );
  return normalizeVendorExpense(res.data);
}

export async function deleteVendorExpense(id: string): Promise<void> {
  await apiRequest(`/admin/vendor-expenses/${id}`, { method: "DELETE" });
}

// ─── Admin — Inventory ────────────────────────────────────────────────────

export async function listInventoryItems(params: {
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<InventoryItem>> {
  const res = await apiRequest<SuccessEnvelope<RawInventoryItem[]>>(
    "/admin/inventory/items",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeInventoryItem), meta: res.meta! };
}

export async function createInventoryItem(body: {
  name: string;
  sku: string;
  unit?: string;
  quantity?: number;
  minimum_stock?: number;
}): Promise<InventoryItem> {
  const res = await apiRequest<SuccessEnvelope<RawInventoryItem>>(
    "/admin/inventory/items",
    { method: "POST", body },
  );
  return normalizeInventoryItem(res.data);
}

export async function updateInventoryItem(
  id: string,
  body: Partial<{
    name: string;
    sku: string;
    unit: string;
    quantity: number;
    minimum_stock: number;
    status: string;
  }>,
): Promise<InventoryItem> {
  const res = await apiRequest<SuccessEnvelope<RawInventoryItem>>(
    `/admin/inventory/items/${id}`,
    { method: "PATCH", body },
  );
  return normalizeInventoryItem(res.data);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await apiRequest(`/admin/inventory/items/${id}`, { method: "DELETE" });
}

export async function createInventoryTransaction(body: {
  inventory_item_id: string;
  type: RawInventoryTransactionType;
  quantity: number;
  booking_id?: string;
  pilgrim_id?: string;
  notes?: string;
}): Promise<InventoryTransaction> {
  const res = await apiRequest<SuccessEnvelope<RawInventoryTransaction>>(
    "/admin/inventory/transactions",
    { method: "POST", body },
  );
  return normalizeInventoryTransaction(res.data);
}

// ─── Admin — Reports ──────────────────────────────────────────────────────

export async function reportOverview(): Promise<ReportOverview> {
  const res = await apiRequest<SuccessEnvelope<RawReportOverview>>(
    "/admin/reports/overview",
  );
  return normalizeReportOverview(res.data);
}

export interface BookingReportResponse {
  summary: {
    totalBookings: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    totalAmount: number;
    totalReceived: number;
    totalOutstanding: number;
  };
  data: Booking[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function reportBookings(params: {
  package_id?: string;
  tier_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<BookingReportResponse> {
  const res = await apiRequest<
    SuccessEnvelope<RawBooking[]> & {
      summary: BookingReportResponse["summary"];
    }
  >("/admin/reports/bookings", {
    query: params as Record<string, string | number | undefined>,
  });
  return {
    summary: res.summary,
    data: res.data.map(normalizeBooking),
    meta: res.meta!,
  };
}

export interface PaymentReportResponse {
  summary: {
    totalPayments: number;
    totalVolume: number;
    byMethod: Record<string, number>;
    byStatus: Record<string, number>;
  };
  data: Payment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function reportPayments(params: {
  method?: RawPaymentMethod | "";
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaymentReportResponse> {
  const res = await apiRequest<
    SuccessEnvelope<RawPayment[]> & {
      summary: PaymentReportResponse["summary"];
    }
  >("/admin/reports/payments", {
    query: params as Record<string, string | number | undefined>,
  });
  return {
    summary: res.summary,
    data: res.data.map(normalizePayment),
    meta: res.meta!,
  };
}

export interface InstallmentReportResponse {
  summary: {
    totalInstallments: number;
    totalDue: number;
    totalPaid: number;
    byStatus: Record<string, number>;
  };
  data: Installment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function reportInstallments(params: {
  status?: string;
  package_id?: string;
  due_date_from?: string;
  due_date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<InstallmentReportResponse> {
  const res = await apiRequest<
    SuccessEnvelope<RawInstallment[]> & {
      summary: InstallmentReportResponse["summary"];
    }
  >("/admin/reports/installments", {
    query: params as Record<string, string | number | undefined> },
  );
  return {
    summary: res.summary,
    data: res.data.map(normalizeInstallment),
    meta: res.meta!,
  };
}

export interface RefundReportResponse {
  total_refunded: number;
  total_pending: number;
  total_count: number;
  status_breakdown: Record<string, number>;
}

export async function reportRefunds(): Promise<RefundReportResponse> {
  return apiRequest("/admin/reports/refunds");
}

export interface SeatQuotaReportResponse {
  summary: {
    total_quota: number;
    held_seats: number;
    confirmed_seats: number;
    available_seats: number;
    overall_utilization_percent: number;
  };
  tiers: SeatQuotaRow[];
}

export async function reportSeatQuota(): Promise<SeatQuotaReportResponse> {
  const res = await apiRequest<
    SuccessEnvelope<RawSeatQuotaRow[] | { tiers: RawSeatQuotaRow[] }>
  >("/admin/reports/seat-quota");
  // The seat-quota endpoint returns `{ summary, tiers }` not the standard envelope.
  // Handle both shapes defensively.
  if (res.data && typeof res.data === "object" && "tiers" in res.data) {
    const data = res.data as unknown as {
      summary: SeatQuotaReportResponse["summary"];
      tiers: RawSeatQuotaRow[];
    };
    return {
      summary: data.summary,
      tiers: (data.tiers ?? []).map(normalizeSeatQuotaRow),
    };
  }
  const rows = res.data as unknown as RawSeatQuotaRow[];
  return {
    summary: {
      total_quota: 0,
      held_seats: 0,
      confirmed_seats: 0,
      available_seats: 0,
      overall_utilization_percent: 0,
    },
    tiers: (rows ?? []).map(normalizeSeatQuotaRow),
  };
}

// ─── Admin — Audit Logs ───────────────────────────────────────────────────

export async function listAuditLogs(params: {
  actor_id?: string;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<AuditLog>> {
  const res = await apiRequest<SuccessEnvelope<RawAuditLog[]>>(
    "/admin/audit-logs",
    { query: params as Record<string, string | number | undefined> },
  );
  return { data: res.data.map(normalizeAuditLog), meta: res.meta! };
}

export async function getAuditLog(id: string): Promise<AuditLog> {
  const res = await apiRequest<SuccessEnvelope<RawAuditLog>>(
    `/admin/audit-logs/${id}`,
  );
  return normalizeAuditLog(res.data);
}

// ─── Pagination re-export ─────────────────────────────────────────────────

export type { Paginated } from "./normalize";

// Re-export the raw type aliases so consumers don't need to import from
// `./types` directly.
export type {
  RawPackageType,
  RawPackageStatus,
  RawTierName,
  RawTierStatus,
  RawPaymentMethod,
  RawPaymentStatus,
  RawCancellationStatus,
  RawRefundStatus,
  RawReconciliationStatus,
  RawVendorType,
  RawInventoryTransactionType,
  RawBookingStatus,
  RawPaymentPlan,
  RawManualPaymentStatus,
  UserRole,
  UserStatus,
} from "./types";
