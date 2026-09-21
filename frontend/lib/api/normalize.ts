/**
 * Normalization layer.
 *
 * The backend returns raw entity objects with snake_case fields and DECIMAL
 * money fields as strings. Components want camelCase + number-friendly money.
 * Every endpoint function in `./endpoints` runs its response through these
 * normalizers before returning, so the rest of the app sees one consistent
 * shape per resource.
 *
 * Conventions:
 * - snake_case → camelCase for field names.
 * - string DECIMALs → number (parseFloat).
 * - `null` → `undefined` for optional scalar fields (so `?.` chains work).
 * - nested raw objects (e.g. booking.package) are recursively normalized.
 */

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
  RawReportOverview,
  RawSeatQuotaRow,
  RawUser,
  RawVendor,
  RawVendorExpense,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────

import type { PaginationMeta } from "./types";

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** `null` → `undefined`, otherwise return value. */
export function opt<T>(v: T | null | undefined): T | undefined {
  return v === null ? undefined : v;
}

/** Parse a string-DECIMAL to a number. Falls back to 0 on bad input. */
function money(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── Domain models (camelCase, components consume these) ──────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
}

export interface PackageTier {
  id: string;
  packageId: string;
  name: "ECONOMY" | "STANDARD" | "VIP";
  price: number;
  currency: string;
  totalQuota: number;
  heldSeats: number;
  confirmedSeats: number;
  status: "ACTIVE" | "INACTIVE";
  availableSeats: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPackage {
  id: string;
  name: string;
  slug: string;
  type: "HAJJ" | "RAMADAN_UMRAH" | "OFF_SEASON_UMRAH" | "ZIYARAH";
  description: string | null;
  departureDate: string;
  returnDate: string;
  bookingStart: string;
  bookingEnd: string;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED";
  tiers: Array<{
    id: string;
    name: "ECONOMY" | "STANDARD" | "VIP";
    price: number;
    currency: string;
    totalQuota: number;
    availableSeats: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPackage {
  id: string;
  name: string;
  slug: string;
  type: PublicPackage["type"];
  description: string | null;
  departureDate: string;
  returnDate: string;
  bookingStart: string;
  bookingEnd: string;
  status: PublicPackage["status"];
  tiers: PackageTier[];
  createdAt: string;
  updatedAt: string;
}

export interface Pilgrim {
  id: string;
  bookingId: string;
  fullName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE";
  nationality: string;
  passportNumber: string;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  passportDocumentUrl: string | null;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  bookingId: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  userId: string;
  packageId: string;
  packageTierId: string;
  status:
    | "PENDING"
    | "PARTIALLY_PAID"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELLED"
    | "DEFAULTED"
    | "COMPLETED";
  paymentPlan: "FULL_PAYMENT" | "INSTALLMENT";
  pilgrimCount: number;
  unitPrice: number;
  totalAmount: number;
  amountReceived: number;
  amountOutstanding: number;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  package?: AdminPackage;
  tier?: PackageTier;
  pilgrims: Pilgrim[];
  installments: Installment[];
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: "BKASH" | "NAGAD" | "VISA" | "MANUAL_BRANCH";
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";
  gatewayTransactionId: string | null;
  gatewayReference: string | null;
  paymentDate: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPayment {
  id: string;
  bookingId: string;
  amount: number;
  reference: string;
  notes: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  createdById: string;
  approvedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CancellationRequest {
  id: string;
  bookingId: string;
  pilgrimId: string | null;
  reason: string;
  cancellationCharge: number | null;
  vendorCost: number | null;
  refundAmount: number | null;
  status:
    | "REQUESTED"
    | "APPROVED"
    | "PROCESSING"
    | "COMPLETED"
    | "REJECTED"
    | "FAILED";
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  bookingId: string;
  paymentId: string | null;
  cancellationRequestId: string | null;
  amount: number;
  method: string;
  status:
    | "REQUESTED"
    | "APPROVED"
    | "PROCESSING"
    | "COMPLETED"
    | "REJECTED"
    | "FAILED";
  reason: string | null;
  approvedBy: string | null;
  processedBy: string | null;
  requestedAt: string;
  approvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationRecord {
  id: string;
  paymentId: string | null;
  gateway: string;
  gatewayTransactionId: string;
  internalAmount: number | null;
  gatewayAmount: number;
  difference: number | null;
  status: "MATCHED" | "MISMATCH" | "RESOLVED";
  settlementDate: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: "HOTEL" | "AIRLINE" | "TRANSPORT" | "VISA" | "OTHER";
  contactInfo: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorExpense {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  bookingId: string | null;
  packageId: string | null;
  expenseType: Vendor["type"];
  amount: number;
  currency: string;
  exchangeRate: number;
  amountBdt: number;
  expenseDate: string;
  status: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  minimumStock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  type: "PURCHASE" | "ISSUE" | "RETURN" | "ADJUSTMENT";
  quantity: number;
  bookingId: string | null;
  pilgrimId: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ReportOverview {
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

export interface SeatQuotaRow {
  packageId: string;
  packageName: string;
  packageSlug: string;
  tierId: string;
  tierName: string;
  price: number;
  currency: string;
  totalQuota: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  utilizationRatePercent: number;
}

// ─── Normalizers ──────────────────────────────────────────────────────────

export function normalizeUser(u: RawUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

export function normalizePackageTier(t: RawPackageTier): PackageTier {
  return {
    id: t.id,
    packageId: t.package_id,
    name: t.name,
    price: money(t.price),
    currency: t.currency,
    totalQuota: t.total_quota,
    heldSeats: t.held_seats,
    confirmedSeats: t.confirmed_seats,
    status: t.status,
    availableSeats: Math.max(
      0,
      t.total_quota - t.held_seats - t.confirmed_seats,
    ),
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export function normalizePublicPackage(p: RawPublicPackage): PublicPackage {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    description: p.description,
    departureDate: p.departure_date,
    returnDate: p.return_date,
    bookingStart: p.booking_start,
    bookingEnd: p.booking_end,
    status: p.status,
    tiers: (p.tiers ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      price: money(t.price),
      currency: t.currency,
      totalQuota: t.total_quota,
      availableSeats: t.available_seats,
    })),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function normalizeAdminPackage(p: RawAdminPackage): AdminPackage {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    description: p.description,
    departureDate: p.departure_date,
    returnDate: p.return_date,
    bookingStart: p.booking_start,
    bookingEnd: p.booking_end,
    status: p.status,
    tiers: (p.tiers ?? []).map(normalizePackageTier),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function normalizePilgrim(p: RawPilgrim): Pilgrim {
  return {
    id: p.id,
    bookingId: p.booking_id,
    fullName: p.full_name,
    dateOfBirth: p.date_of_birth,
    gender: p.gender,
    nationality: p.nationality,
    passportNumber: p.passport_number,
    passportIssueDate: p.passport_issue_date,
    passportExpiryDate: p.passport_expiry_date,
    passportDocumentUrl: p.passport_document_url,
    phone: p.phone,
    email: p.email,
    status: p.status,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function normalizeInstallment(i: RawInstallment): Installment {
  return {
    id: i.id,
    bookingId: i.booking_id,
    installmentNumber: i.installment_number,
    amount: money(i.amount),
    paidAmount: money(i.paid_amount),
    dueDate: i.due_date,
    status: i.status,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export function normalizeBooking(b: RawBooking): Booking {
  return {
    id: b.id,
    bookingNumber: b.booking_number,
    userId: b.user_id,
    packageId: b.package_id,
    packageTierId: b.package_tier_id,
    status: b.status,
    paymentPlan: b.payment_plan,
    pilgrimCount: b.pilgrim_count,
    unitPrice: money(b.unit_price),
    totalAmount: money(b.total_amount),
    amountReceived: money(b.amount_received),
    amountOutstanding: money(b.amount_outstanding),
    holdExpiresAt: b.hold_expires_at,
    confirmedAt: b.confirmed_at,
    package: b.package ? normalizeAdminPackage(b.package) : undefined,
    tier: b.package_tier ? normalizePackageTier(b.package_tier) : undefined,
    pilgrims: (b.pilgrims ?? []).map(normalizePilgrim),
    installments: (b.installments ?? []).map(normalizeInstallment),
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

export function normalizePayment(p: RawPayment): Payment {
  return {
    id: p.id,
    bookingId: p.booking_id,
    userId: p.user_id,
    amount: money(p.amount),
    currency: p.currency,
    method: p.method,
    status: p.status,
    gatewayTransactionId: p.gateway_transaction_id,
    gatewayReference: p.gateway_reference,
    paymentDate: p.payment_date,
    metadata: p.metadata,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export function normalizeManualPayment(m: RawManualPayment): ManualPayment {
  return {
    id: m.id,
    bookingId: m.booking_id,
    amount: money(m.amount),
    reference: m.reference,
    notes: m.notes,
    status: m.status,
    createdById: m.created_by_id,
    approvedById: m.approved_by_id,
    rejectionReason: m.rejection_reason,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

export function normalizeCancellation(
  c: RawCancellationRequest,
): CancellationRequest {
  return {
    id: c.id,
    bookingId: c.booking_id,
    pilgrimId: c.pilgrim_id,
    reason: c.reason,
    cancellationCharge: c.cancellation_charge ? money(c.cancellation_charge) : null,
    vendorCost: c.vendor_cost ? money(c.vendor_cost) : null,
    refundAmount: c.refund_amount ? money(c.refund_amount) : null,
    status: c.status,
    requestedBy: c.requested_by,
    approvedBy: c.approved_by,
    approvedAt: c.approved_at,
    rejectionReason: c.rejection_reason,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export function normalizeRefund(r: RawRefund): Refund {
  return {
    id: r.id,
    bookingId: r.booking_id,
    paymentId: r.payment_id,
    cancellationRequestId: r.cancellation_request_id,
    amount: money(r.amount),
    method: r.method,
    status: r.status,
    reason: r.reason,
    approvedBy: r.approved_by,
    processedBy: r.processed_by,
    requestedAt: r.requested_at,
    approvedAt: r.approved_at,
    processedAt: r.processed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function normalizeReconciliation(
  r: RawReconciliationRecord,
): ReconciliationRecord {
  return {
    id: r.id,
    paymentId: r.payment_id,
    gateway: r.gateway,
    gatewayTransactionId: r.gateway_transaction_id,
    internalAmount: r.internal_amount ? money(r.internal_amount) : null,
    gatewayAmount: money(r.gateway_amount),
    difference: r.difference ? money(r.difference) : null,
    status: r.status,
    settlementDate: r.settlement_date,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at,
    resolutionNotes: r.resolution_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function normalizeVendor(v: RawVendor): Vendor {
  return {
    id: v.id,
    name: v.name,
    type: v.type,
    contactInfo: v.contact_info,
    status: v.status,
    createdAt: v.created_at,
    updatedAt: v.updated_at,
  };
}

export function normalizeVendorExpense(e: RawVendorExpense): VendorExpense {
  return {
    id: e.id,
    vendorId: e.vendor_id,
    vendor: e.vendor ? normalizeVendor(e.vendor) : undefined,
    bookingId: e.booking_id,
    packageId: e.package_id,
    expenseType: e.expense_type,
    amount: money(e.amount),
    currency: e.currency,
    exchangeRate: money(e.exchange_rate),
    amountBdt: money(e.amount_bdt),
    expenseDate: e.expense_date,
    status: e.status,
    notes: e.notes,
    createdBy: e.created_by,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

export function normalizeInventoryItem(i: RawInventoryItem): InventoryItem {
  return {
    id: i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    quantity: i.quantity,
    minimumStock: i.minimum_stock,
    status: i.status,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export function normalizeInventoryTransaction(
  t: RawInventoryTransaction,
): InventoryTransaction {
  return {
    id: t.id,
    inventoryItemId: t.inventory_item_id,
    type: t.type,
    quantity: t.quantity,
    bookingId: t.booking_id,
    pilgrimId: t.pilgrim_id,
    createdBy: t.created_by,
    notes: t.notes,
    createdAt: t.created_at,
  };
}

export function normalizeAuditLog(a: RawAuditLog): AuditLog {
  return {
    id: a.id,
    actorId: a.actor_id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    oldValue: a.old_value,
    newValue: a.new_value,
    ipAddress: a.ip_address,
    userAgent: a.user_agent,
    createdAt: a.created_at,
  };
}

export function normalizeReportOverview(r: RawReportOverview): ReportOverview {
  return {
    totalBookings: r.totalBookings,
    confirmedBookings: r.confirmedBookings,
    totalCollected: r.totalCollected,
    totalOutstanding: r.totalOutstanding,
    totalRefunded: r.totalRefunded,
    availableSeats: r.availableSeats,
    heldSeats: r.heldSeats,
    confirmedSeats: r.confirmedSeats,
    overdueInstallments: r.overdueInstallments,
  };
}

export function normalizeSeatQuotaRow(r: RawSeatQuotaRow): SeatQuotaRow {
  return {
    packageId: r.package_id,
    packageName: r.package_name,
    packageSlug: r.package_slug,
    tierId: r.tier_id,
    tierName: r.tier_name,
    price: money(r.price),
    currency: r.currency,
    totalQuota: r.total_quota,
    heldSeats: r.held_seats,
    confirmedSeats: r.confirmed_seats,
    availableSeats: r.available_seats,
    utilizationRatePercent: r.utilization_rate_percent,
  };
}
