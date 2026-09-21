/**
 * Type definitions for the Hajj & Umrah Booking System API.
 *
 * The backend (NestJS + TypeORM) returns raw entity objects with snake_case
 * field names. These types mirror the backend shape exactly so the client.ts
 * `apiRequest` can pass them through. The normalize layer in `normalize.ts`
 * converts each raw entity into a camelCase shape that the components
 * consume — components import the camelCase versions, not these.
 */

// ─── Auth ─────────────────────────────────────────────────────────────────

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface RawUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface RawAuthLoginResponse {
  access_token: string;
  refresh_token: string;
  user: RawUser;
}

export interface RawAuthMeResponse {
  user: RawUser;
}

// ─── Packages ─────────────────────────────────────────────────────────────

export type RawPackageType = "HAJJ" | "RAMADAN_UMRAH" | "OFF_SEASON_UMRAH" | "ZIYARAH";
export type RawPackageStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED";
export type RawTierName = "ECONOMY" | "STANDARD" | "VIP";
export type RawTierStatus = "ACTIVE" | "INACTIVE";

export interface RawPackageTier {
  id: string;
  package_id: string;
  name: RawTierName;
  /** DECIMAL returned as string from TypeORM */
  price: string;
  currency: string;
  total_quota: number;
  held_seats: number;
  confirmed_seats: number;
  status: RawTierStatus;
  created_at: string;
  updated_at: string;
}

export interface RawPublicPackage {
  id: string;
  name: string;
  slug: string;
  type: RawPackageType;
  description: string | null;
  /** ISO date or YYYY-MM-DD strings from TypeORM */
  departure_date: string;
  return_date: string;
  booking_start: string;
  booking_end: string;
  status: RawPackageStatus;
  tiers: Array<{
    id: string;
    name: RawTierName;
    price: string;
    currency: string;
    total_quota: number;
    available_seats: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface RawAdminPackage {
  id: string;
  name: string;
  slug: string;
  type: RawPackageType;
  description: string | null;
  departure_date: string;
  return_date: string;
  booking_start: string;
  booking_end: string;
  status: RawPackageStatus;
  tiers: RawPackageTier[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export type RawPaymentPlan = "FULL_PAYMENT" | "INSTALLMENT";
export type RawBookingStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "DEFAULTED"
  | "COMPLETED";

export interface RawPilgrim {
  id: string;
  booking_id: string;
  full_name: string;
  /** YYYY-MM-DD */
  date_of_birth: string;
  gender: "MALE" | "FEMALE";
  nationality: string;
  passport_number: string;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_document_url: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "CANCELLED";
  created_at: string;
  updated_at: string;
}

export interface RawInstallment {
  id: string;
  booking_id: string;
  installment_number: number;
  amount: string;
  paid_amount: string;
  /** YYYY-MM-DD */
  due_date: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  created_at: string;
  updated_at: string;
}

export interface RawBooking {
  id: string;
  booking_number: string;
  user_id: string;
  package_id: string;
  package_tier_id: string;
  status: RawBookingStatus;
  payment_plan: RawPaymentPlan;
  pilgrim_count: number;
  /** DECIMAL as string */
  unit_price: string;
  total_amount: string;
  amount_received: string;
  amount_outstanding: string;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  package?: RawAdminPackage;
  package_tier?: RawPackageTier;
  pilgrims?: RawPilgrim[];
  installments?: RawInstallment[];
  created_at: string;
  updated_at: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────

export type RawPaymentMethod = "BKASH" | "NAGAD" | "VISA" | "MANUAL_BRANCH";
export type RawPaymentStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export interface RawPayment {
  id: string;
  booking_id: string;
  user_id: string;
  amount: string;
  currency: string;
  method: RawPaymentMethod;
  /**
   * Gateway payments: PENDING | PROCESSING | SUCCESS | FAILED.
   * Manual branch payments: PENDING_APPROVAL | APPROVED | REJECTED.
   * Widened to a union here so the single Payment shape covers both.
   */
  status:
    | RawPaymentStatus
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED";
  gateway_transaction_id: string | null;
  gateway_reference: string | null;
  payment_date: string | null;
  /** Manual branch only — bank/branch reference supplied by the admin. */
  reference: string | null;
  /** Manual branch only — free-text notes from the admin. */
  notes: string | null;
  /** Manual branch only — UUID of the admin who created the record. */
  created_by_id: string | null;
  /** Manual branch only — UUID of the admin who approved it. */
  approved_by_id: string | null;
  /** Manual branch only — populated when status = REJECTED. */
  rejection_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type RawManualPaymentStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export interface RawManualPayment {
  id: string;
  booking_id: string;
  amount: string;
  reference: string;
  notes: string | null;
  status: RawManualPaymentStatus;
  created_by_id: string;
  approved_by_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Cancellations ────────────────────────────────────────────────────────

export type RawCancellationStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface RawCancellationRequest {
  id: string;
  booking_id: string;
  pilgrim_id: string | null;
  reason: string;
  cancellation_charge: string | null;
  vendor_cost: string | null;
  refund_amount: string | null;
  status: RawCancellationStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Refunds ──────────────────────────────────────────────────────────────

export type RawRefundStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export interface RawRefund {
  id: string;
  booking_id: string;
  payment_id: string | null;
  cancellation_request_id: string | null;
  amount: string;
  method: string;
  status: RawRefundStatus;
  reason: string | null;
  approved_by: string | null;
  processed_by: string | null;
  requested_at: string;
  approved_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Reconciliation ───────────────────────────────────────────────────────

export type RawReconciliationStatus = "MATCHED" | "MISMATCH" | "RESOLVED";

export interface RawReconciliationRecord {
  id: string;
  payment_id: string | null;
  gateway: string;
  gateway_transaction_id: string;
  internal_amount: string | null;
  gateway_amount: string;
  difference: string | null;
  status: RawReconciliationStatus;
  settlement_date: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Vendors ──────────────────────────────────────────────────────────────

export type RawVendorType = "HOTEL" | "AIRLINE" | "TRANSPORT" | "VISA" | "OTHER";

export interface RawVendor {
  id: string;
  name: string;
  type: RawVendorType;
  contact_info: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RawVendorExpense {
  id: string;
  vendor_id: string;
  vendor?: RawVendor;
  booking_id: string | null;
  package_id: string | null;
  expense_type: RawVendorType;
  amount: string;
  currency: string;
  exchange_rate: string;
  amount_bdt: string;
  expense_date: string;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Inventory ────────────────────────────────────────────────────────────

export type RawInventoryTransactionType =
  | "PURCHASE"
  | "ISSUE"
  | "RETURN"
  | "ADJUSTMENT";

export interface RawInventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  minimum_stock: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RawInventoryTransaction {
  id: string;
  inventory_item_id: string;
  type: RawInventoryTransactionType;
  quantity: number;
  booking_id: string | null;
  pilgrim_id: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────

export interface RawAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Reports ──────────────────────────────────────────────────────────────

export interface RawReportOverview {
  totalBookings: number;
  confirmedBookings: number;
  totalCollected: number;
  totalOutstanding: number;
  totalRefunded: number;
  availableSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  overdueInstallments: number;
}

export interface RawSeatQuotaRow {
  package_id: string;
  package_name: string;
  package_slug: string;
  tier_id: string;
  tier_name: string;
  price: string;
  currency: string;
  total_quota: number;
  held_seats: number;
  confirmed_seats: number;
  available_seats: number;
  utilization_rate_percent: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string | string[];
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  message: string | string[];
  code: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message || "Request failed";
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code || "UNKNOWN";
  }
}
