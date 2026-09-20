# Database Schema — Hajj & Umrah Package Booking System

## 1. Database

Database:

```text
PostgreSQL
```

ORM:

```text
Prisma
```

PostgreSQL is the authoritative source of truth for:

* Users
* Packages
* Package tiers
* Seat availability
* Bookings
* Pilgrims
* Installments
* Payments
* Refunds
* Cancellations
* Reconciliation
* Vendor expenses
* Inventory
* Audit logs

Redis must never be the authoritative source for financial or booking state.

---

# 2. Entity Relationship Overview

```text
User
 │
 ├──────────────< Booking
 │                    │
 │                    ├────────< Pilgrim
 │                    ├────────< Installment
 │                    ├────────< Payment
 │                    ├────────< CancellationRequest
 │                    └────────< Refund
 │
 └──────────────< AuditLog


Package
 │
 └──────────────< PackageTier
                       │
                       └────────< Booking


Payment
 │
 ├──────────────< PaymentWebhookEvent
 └──────────────< ReconciliationRecord


Vendor
 │
 └──────────────< VendorExpense


InventoryItem
 │
 └──────────────< InventoryTransaction
```

---

# 3. User

```text
users
-----
id
name
email
phone
password_hash
role
status
created_at
updated_at
deleted_at
```

### Fields

| Field         | Type      | Notes                       |
| ------------- | --------- | --------------------------- |
| id            | UUID      | Primary key                 |
| name          | VARCHAR   | Required                    |
| email         | VARCHAR   | Unique                      |
| phone         | VARCHAR   | Optional/unique if required |
| password_hash | VARCHAR   | Never expose                |
| role          | ENUM      | USER / ADMIN                |
| status        | ENUM      | ACTIVE / INACTIVE           |
| created_at    | TIMESTAMP |                             |
| updated_at    | TIMESTAMP |                             |
| deleted_at    | TIMESTAMP | Soft delete                 |

Indexes:

```text
UNIQUE(email)
INDEX(role)
INDEX(status)
```

---

# 4. Package

```text
packages
--------
id
name
slug
type
description
departure_date
return_date
booking_start
booking_end
status
created_at
updated_at
deleted_at
```

### Package Type

```text
HAJJ
RAMADAN_UMRAH
OFF_SEASON_UMRAH
ZIYARAH
```

### Package Status

```text
DRAFT
PUBLISHED
CLOSED
COMPLETED
ARCHIVED
```

Indexes:

```text
UNIQUE(slug)
INDEX(type)
INDEX(status)
INDEX(departure_date)
INDEX(booking_start, booking_end)
```

---

# 5. Package Tier

```text
package_tiers
-------------
id
package_id
name
price
currency
total_quota
status
created_at
updated_at
deleted_at
```

Example:

```text
Economy
450000 BDT
100 seats

Standard
550000 BDT
80 seats

VIP
750000 BDT
30 seats
```

### Important

The tier price represents the current package price.

The booking stores its own `unit_price` so historical booking prices do not change.

### Quota

The implementation may either:

1. Store explicit counters, or
2. Calculate availability from booking/seat records.

For simplicity and performance, explicit counters can be used:

```text
total_quota
held_seats
confirmed_seats
```

Then:

```text
available_seats =
total_quota - held_seats - confirmed_seats
```

Important invariant:

```text
held_seats + confirmed_seats <= total_quota
```

Quota adjustment must never make:

```text
total_quota < held_seats + confirmed_seats
```

Indexes:

```text
INDEX(package_id)
INDEX(package_id, status)
```

---

# 6. Booking

```text
bookings
--------
id
booking_number
user_id
package_id
package_tier_id

status
payment_plan

unit_price
total_amount
amount_received
amount_outstanding

hold_expires_at
confirmed_at

created_at
updated_at
deleted_at
```

### Booking Status

```text
PENDING_PAYMENT
PARTIALLY_PAID
CONFIRMED
EXPIRED
CANCELLED
DEFAULTED
COMPLETED
```

### Payment Plan

```text
FULL_PAYMENT
INSTALLMENT
```

### Important

`unit_price` is copied from `package_tiers.price` when the booking is created.

Never dynamically calculate an existing booking's historical price using the current tier price.

---

# 7. Booking Number

Booking number should be human-readable.

Example:

```text
HJJ-2027-000123
```

or:

```text
UMR-2027-000456
```

It must be unique.

Database:

```text
UNIQUE(booking_number)
```

---

# 8. Pilgrim

```text
pilgrims
--------
id
booking_id

full_name
date_of_birth
gender
nationality

passport_number
passport_issue_date
passport_expiry_date
passport_document_url

phone
email

status

created_at
updated_at
```

### Status

```text
ACTIVE
CANCELLED
```

One booking can have multiple pilgrims.

Relationship:

```text
Booking 1 ──────── N Pilgrim
```

---

# 9. Installment

```text
installments
------------
id
booking_id
installment_number

amount
paid_amount
due_date
status

created_at
updated_at
```

### Status

```text
PENDING
PARTIALLY_PAID
PAID
OVERDUE
```

### Important

Installment schedules are generated at booking creation.

Once generated, they remain fixed unless an explicit audited administrative adjustment is introduced.

---

# 10. Payment

```text
payments
--------
id

booking_id
user_id

amount
currency

method
status

gateway_transaction_id
gateway_reference

payment_date
metadata

created_at
updated_at
```

### Payment Method

```text
BKASH
NAGAD
VISA
MANUAL_BRANCH
```

### Payment Status

```text
PENDING
PROCESSING
SUCCESS
FAILED
CANCELLED
REFUNDED
```

### Important

Gateway transaction ID should be unique when present.

```text
UNIQUE(gateway_transaction_id)
```

This is a major part of webhook idempotency.

---

# 11. Payment Webhook Event

```text
payment_webhook_events
----------------------
id

payment_id

gateway
event_id
gateway_transaction_id

event_type
payload

status

received_at
processed_at

error_message
```

### Status

```text
RECEIVED
PROCESSED
FAILED
IGNORED
```

Recommended constraints:

```text
UNIQUE(event_id)
```

If the gateway does not provide a reliable event ID, use a suitable composite uniqueness strategy based on gateway + transaction + event type.

---

# 12. Reconciliation Record

```text
reconciliation_records
----------------------
id

payment_id
gateway_transaction_id

internal_amount
gateway_amount
difference

status

settlement_date

resolved_by
resolved_at
resolution_notes

created_at
updated_at
```

### Status

```text
MATCHED
MISMATCH
RESOLVED
```

Never silently modify internal payment records because of a settlement mismatch.

---

# 13. Cancellation Request

```text
cancellation_requests
---------------------
id

booking_id
pilgrim_id

reason

cancellation_charge
vendor_cost
refund_amount

status

requested_by
approved_by
approved_at

created_at
updated_at
```

`pilgrim_id` is nullable.

If NULL:

```text
Whole booking cancellation
```

If populated:

```text
Partial cancellation of one pilgrim
```

### Status

```text
REQUESTED
APPROVED
REJECTED
PROCESSING
COMPLETED
```

---

# 14. Refund

```text
refunds
-------
id

booking_id
payment_id

amount
method
status

requested_by
approved_by
processed_by

requested_at
approved_at
processed_at
completed_at

notes

created_at
updated_at
```

### Refund Status

```text
REQUESTED
APPROVED
PROCESSING
COMPLETED
REJECTED
FAILED
```

Important invariant:

```text
total_refunded <= total_received
```

Refunds must never be hard deleted.

---

# 15. Vendor

```text
vendors
-------
id
name
type
contact_name
phone
email
status
created_at
updated_at
deleted_at
```

### Vendor Type

```text
HOTEL
AIRLINE
TRANSPORT
VISA
OTHER
```

---

# 16. Vendor Expense

```text
vendor_expenses
---------------
id

vendor_id

booking_id
package_id

expense_type

amount
currency
exchange_rate
amount_bdt

expense_date
status

notes
created_by

created_at
updated_at
```

`booking_id` and `package_id` may be nullable depending on whether the expense is booking-specific or package-level.

### Expense Type

```text
HOTEL
AIRLINE
TRANSPORT
VISA
OTHER
```

---

# 17. Currency Handling

Collections are primarily tracked in BDT.

Vendor expenses may be incurred in SAR.

Never overwrite the original foreign currency amount.

Store:

```text
amount
currency
exchange_rate
amount_bdt
```

Example:

```text
amount = 1000
currency = SAR
exchange_rate = 32
amount_bdt = 32000
```

Historical financial records use the exchange rate stored at the time of the transaction.

---

# 18. Inventory Item

```text
inventory_items
---------------
id
name
sku
unit

quantity
minimum_stock

status

created_at
updated_at
deleted_at
```

Examples:

```text
Ihram Set
Travel Bag
SIM Card
```

---

# 19. Inventory Transaction

```text
inventory_transactions
----------------------
id

inventory_item_id

type
quantity

booking_id
pilgrim_id

created_by
notes

created_at
```

### Transaction Type

```text
PURCHASE
ISSUE
RETURN
ADJUSTMENT
```

Inventory quantity should be changed through transactions rather than arbitrary direct modification whenever possible.

---

# 20. Audit Log

```text
audit_logs
----------
id

actor_id

action
entity_type
entity_id

old_value
new_value

ip_address
user_agent

created_at
```

Examples:

```text
CREATE_BOOKING
CANCEL_BOOKING
APPROVE_PAYMENT
REJECT_PAYMENT
APPROVE_REFUND
PROCESS_REFUND
ADJUST_QUOTA
UPDATE_PACKAGE
UPDATE_TIER
RELEASE_SEAT
RECONCILE_PAYMENT
```

Audit logs must never be silently removed.

---

# 21. Optional Booking Status History

Recommended:

```text
booking_status_history
----------------------
id
booking_id
from_status
to_status
changed_by
reason
created_at
```

This is useful for debugging and auditing booking lifecycle changes.

---

# 22. Optional Payment Allocation Model

For a more robust financial design, introduce:

```text
payment_allocations
-------------------
id
payment_id
installment_id
amount
created_at
```

Relationship:

```text
Payment
   |
   └──< PaymentAllocation >── Installment
```

This is preferable to only storing `paid_amount` on installments because it creates a clear audit trail showing exactly which payment funded which installment.

Example:

```text
Payment #P100
150,000

Allocation:
Installment #1 → 100,000
Installment #2 → 50,000
```

This model is recommended.

---

# 23. Recommended Final Financial Structure

```text
Booking
   |
   +── Installments
   |
   +── Payments
          |
          └── PaymentAllocations
                    |
                    └── Installment
```

This makes payment history and reconciliation easier.

---

# 24. Database Transactions

Use Prisma transactions for critical operations.

## Booking Creation

```text
BEGIN

Lock package tier
Check quota
Reserve seats
Create booking
Create pilgrims
Create installments
Create audit log

COMMIT
```

## Payment Confirmation

```text
BEGIN

Check idempotency
Create/update payment
Allocate payment
Update installments
Update booking balance/status
Create audit log

COMMIT
```

## Cancellation

```text
BEGIN

Calculate cancellation charge
Calculate vendor cost
Create cancellation
Update pilgrim/booking
Release seats
Create refund request
Create audit log

COMMIT
```

---

# 25. Concurrency Strategy

The database must prevent overselling.

Recommended:

```sql
SELECT *
FROM package_tiers
WHERE id = ?
FOR UPDATE;
```

Then:

```text
check available seats
reserve seats
create booking
```

inside the same transaction.

Alternative:

```sql
UPDATE package_tiers
SET available_seats = available_seats - ?
WHERE id = ?
AND available_seats >= ?;
```

The operation is successful only if affected rows > 0.

---

# 26. Important Database Indexes

At minimum consider indexes on:

```text
users.email

packages.slug
packages.type
packages.status
packages.departure_date

package_tiers.package_id

bookings.booking_number
bookings.user_id
bookings.package_id
bookings.package_tier_id
bookings.status
bookings.created_at

pilgrims.booking_id
pilgrims.passport_number

installments.booking_id
installments.status
installments.due_date

payments.booking_id
payments.user_id
payments.status
payments.gateway_transaction_id
payments.created_at

payment_webhook_events.event_id
payment_webhook_events.gateway_transaction_id

refunds.booking_id
refunds.status

cancellation_requests.booking_id
cancellation_requests.status

vendor_expenses.vendor_id
vendor_expenses.booking_id

inventory_transactions.inventory_item_id

audit_logs.actor_id
audit_logs.entity_type
audit_logs.entity_id
audit_logs.created_at
```

Do not blindly index every column.

Indexes should support actual query patterns.

---

# 27. Soft Delete

Entities that support soft deletion use:

```text
deleted_at
```

Normal application queries should exclude soft-deleted records.

Reports and reconciliation may intentionally include historical soft-deleted records.

Financial records should generally use status/reversal/refund semantics rather than deletion.

---

# 28. Financial Invariants

These must always hold:

```text
total_refunded <= total_received

paid_amount <= installment.amount

held_seats + confirmed_seats <= total_quota

new_quota >= held_seats + confirmed_seats

payment cannot be allocated more than its available amount

booking outstanding >= 0

booking received >= 0
```

These should be enforced using a combination of:

* Database constraints
* Transactions
* Application validation
* Domain/service-level validation

---

# 29. ERD Deliverable

The repository must contain an ERD.

Suggested tool:

```text
dbdiagram.io
```

or:

```text
Mermaid ER diagram
```

The ERD must clearly show:

```text
User
Package
PackageTier
Booking
Pilgrim
Installment
Payment
PaymentAllocation
PaymentWebhookEvent
CancellationRequest
Refund
ReconciliationRecord
Vendor
VendorExpense
InventoryItem
InventoryTransaction
AuditLog
```

---

# 30. AI Implementation Rules

When generating Prisma models:

1. Preserve all relationships.
2. Add appropriate foreign keys.
3. Add appropriate indexes.
4. Add unique constraints where required.
5. Use enums for controlled status values.
6. Use Decimal for financial amounts.
7. Do not use floating-point types for money.
8. Use timestamps consistently.
9. Preserve soft deletion.
10. Do not remove financial history.
11. Preserve transaction boundaries.
12. Add migrations instead of manually changing production schema.
13. Do not modify this schema without explaining the impact on the API and business rules.

---

# 31. Money Representation

Use PostgreSQL `DECIMAL` / Prisma `Decimal`.

Do NOT use:

```text
float
double
```

for financial amounts.

Examples:

```text
price
amount
paid_amount
refund_amount
exchange_rate
vendor_cost
```

should use decimal-compatible types.

---

# 32. UUIDs

UUIDs are recommended for internal database IDs.

Human-readable booking numbers should be separate.

Example:

```text
id:
550e8400-e29b-41d4-a716-446655440000

booking_number:
HJJ-2027-000123
```

This provides both secure identifiers and user-friendly references.
