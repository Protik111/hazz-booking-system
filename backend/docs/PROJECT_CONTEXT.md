# Hajj & Umrah Package Booking System

## 1. Project Overview

Build a production-oriented **Hajj & Umrah Package Booking System** as a full-stack web application.

The system manages:

* Hajj packages
* Ramadan Umrah packages
* Off-season Umrah packages
* Custom Ziyarah tours
* Package tiers
* Seat quotas
* Pilgrim bookings
* Multiple pilgrims per booking
* Full and installment payments
* Payment gateway webhooks
* Manual branch payments
* Payment reconciliation
* Cancellations
* Refunds
* Vendor expenses
* Currency conversion between SAR and BDT
* Pilgrim inventory/items
* Administrative reporting
* Audit logs

The system should demonstrate correct handling of:

* Concurrent bookings
* Seat overselling prevention
* Transactions
* Payment idempotency
* Out-of-order webhooks
* Financial data integrity
* Role-based access control
* Soft deletion
* Auditability
* Scalable reporting
* Background jobs

---

# 2. Technology Stack

## Frontend

* Next.js
* TypeScript
* React
* Tailwind CSS
* React Query / TanStack Query
* Form validation using Zod
* React Hook Form
* Responsive admin dashboard
* JWT/session-based authentication according to backend implementation

## Backend

* NestJS
* TypeScript
* PostgreSQL
* Prisma ORM
* Redis
* RabbitMQ
* JWT authentication
* Role-based access control
* Class-validator / DTO validation
* Docker

## Optional Infrastructure

* Nginx / Load Balancer
* AWS
* PostgreSQL read replica
* Redis
* RabbitMQ
* Object storage such as S3
* CI/CD

---

# 3. Important Project Principle

This is NOT simply a CRUD application.

The most important parts of the project are:

1. Preventing seat overselling.
2. Correctly handling concurrent bookings.
3. Managing seat holds and expiration.
4. Correctly generating installment schedules.
5. Correctly allocating payments.
6. Handling duplicate payment webhooks.
7. Handling out-of-order webhooks.
8. Server-side payment verification.
9. Financial data integrity.
10. Cancellation and refund rules.
11. Payment reconciliation.
12. Auditability.
13. Role-based access control.
14. Reporting at large scale.

The implementation should prioritize correctness of these business rules over excessive UI complexity.

---

# 4. User Roles

Minimum required roles:

```text
USER
ADMIN
```

## USER

A normal pilgrim/customer.

Can:

* Register
* Login
* View available packages
* View package details
* Select a package tier
* Create a booking
* Add multiple pilgrims to a booking
* Choose full payment or installment plan
* View own bookings
* View own booking details
* View own payments
* View installment schedule
* Make payment
* Request cancellation
* View refund status

Cannot:

* View another user's bookings
* Modify package quota
* Access admin dashboard
* Approve manual payments
* Approve refunds
* Resolve reconciliation issues
* Modify financial records

---

## ADMIN

Can:

* Access admin dashboard
* Create/update/archive packages
* Create/update package tiers
* Adjust quotas
* View all bookings
* Manage booking statuses where permitted
* View payments
* Approve manual payments
* Manage refunds
* Manage cancellation requests
* View reconciliation records
* Resolve reconciliation mismatches
* Manage vendors
* Manage vendor expenses
* Manage inventory
* View reports
* View audit logs

Admin actions that change state must be audited.

---

# 5. Package Types

Supported package types:

```text
HAJJ
RAMADAN_UMRAH
OFF_SEASON_UMRAH
ZIYARAH
```

A package contains:

* Name
* Description
* Type
* Departure date
* Return date if applicable
* Booking start date
* Booking end date
* Status
* One or more tiers

---

# 6. Package Tiers

A package can contain multiple tiers.

Example:

```text
Hajj 2027

Economy
Price: 450,000 BDT
Quota: 100

Standard
Price: 550,000 BDT
Quota: 80

VIP
Price: 750,000 BDT
Quota: 30
```

Each tier has:

* Package ID
* Name
* Price
* Currency
* Total quota
* Reserved/held seats
* Confirmed seats
* Available seats
* Status

Example calculation:

```text
available seats =
total quota
- held seats
- confirmed seats
```

The exact implementation may use counters instead of calculating dynamically.

---

# 7. Package Business Rules

## Booking Window

A booking can only be created when:

```text
booking_start <= current_time <= booking_end
```

If the booking window is closed, new bookings must be rejected.

## Departure Date

The departure date cannot be before the booking date.

## Tier

A package must contain at least one tier.

Each tier has its own:

* Price
* Quota

---

# 8. Seat Management

Seat quota is finite.

The system must NEVER oversell seats.

Example:

```text
Tier quota = 1
Available = 1
```

Two users attempt to book simultaneously.

Only one booking can successfully reserve the final seat.

---

# 9. Concurrent Booking Protection

Seat allocation must happen inside a PostgreSQL transaction.

Recommended approach:

```sql
BEGIN;

SELECT *
FROM package_tiers
WHERE id = :tierId
FOR UPDATE;
```

Then:

1. Check available seats.
2. Reject if no seats remain.
3. Create booking.
4. Create booking pilgrims.
5. Reserve seats.
6. Create installment schedule if required.
7. Commit.

Alternative:

Use an atomic update:

```sql
UPDATE package_tiers
SET available_seats = available_seats - :quantity
WHERE id = :tierId
AND available_seats >= :quantity;
```

Then verify affected rows.

The database must be the source of truth for seat allocation.

Redis must NOT be the authoritative source for seat availability.

---

# 10. Seat Hold

When a booking is created, seats are initially held.

Example lifecycle:

```text
AVAILABLE
   ↓
HELD
   ↓
CONFIRMED
```

If payment is not received within the configured payment window:

```text
HELD
   ↓
EXPIRED
   ↓
SEATS RELEASED
```

Booking should contain:

```text
hold_expires_at
```

A background worker periodically finds expired holds.

Example:

```text
Find bookings where:

status = PAYMENT_PENDING
AND hold_expires_at < NOW()
```

Then:

1. Mark booking expired.
2. Release held seats.
3. Audit the action.
4. Notify the user if required.

---

# 11. Confirmed Booking

Once payment requirements are satisfied and the booking becomes confirmed:

* Price is frozen.
* Tier is frozen.
* Number of pilgrims is frozen unless partial cancellation is performed.
* Financial history must be preserved.

The booking must store the actual price at booking time.

Do NOT calculate historical booking prices from the current package tier price.

Example:

```text
Booking price = 500,000 BDT

Later package price changes:
550,000 BDT

Existing booking remains:
500,000 BDT
```

---

# 12. Booking Model

A booking belongs to exactly one user.

A booking can contain multiple pilgrims.

Example:

```text
User
 |
 +---- Booking
          |
          +---- Pilgrim
          +---- Pilgrim
          +---- Pilgrim
```

Example booking:

```text
Booking #1001

User: Rahim

Package: Hajj 2027
Tier: Standard
Price per pilgrim: 550,000 BDT

Pilgrims:
1. Rahim
2. Karim
3. Hasan
```

---

# 13. Pilgrim Model

Each pilgrim must have passport information.

Suggested fields:

```text
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

Status:

```text
ACTIVE
CANCELLED
```

A pilgrim can be individually cancelled from a group booking.

---

# 14. Booking Status

Recommended statuses:

```text
PENDING_PAYMENT
PARTIALLY_PAID
CONFIRMED
EXPIRED
CANCELLED
DEFAULTED
COMPLETED
```

Possible lifecycle:

```text
PENDING_PAYMENT
       |
       +---- payment timeout ---> EXPIRED
       |
       +---- payment received --> CONFIRMED

CONFIRMED
       |
       +---- cancellation ------> CANCELLED
       |
       +---- departure ----------> COMPLETED
```

For installment bookings:

```text
PENDING_PAYMENT
      ↓
PARTIALLY_PAID
      ↓
CONFIRMED
```

Exact confirmation criteria should be documented.

---

# 15. Booking Creation

Booking creation should be transactional.

Pseudo-flow:

```text
POST /bookings

1. Authenticate user
2. Validate package
3. Validate tier
4. Validate booking window
5. Validate pilgrims
6. Lock tier row
7. Check available quota
8. Reserve seats
9. Capture current tier price
10. Create booking
11. Create pilgrims
12. Create installment schedule if applicable
13. Create audit log
14. Commit transaction
```

---

# 16. Payment Options

Users can choose:

```text
FULL_PAYMENT
INSTALLMENT
```

---

# 17. Full Payment

Example:

```text
Booking total:
600,000 BDT

User chooses full payment.

Required payment:
600,000 BDT
```

After successful verified payment:

```text
Booking → CONFIRMED
```

---

# 18. Installment Plan

The user may choose an installment plan.

The plan consists of:

* Down payment
* Scheduled installments
* Final installment before departure

Example:

```text
Total = 600,000 BDT

Down payment = 200,000

Installment #1 = 150,000
Due = 2026-12-10

Installment #2 = 150,000
Due = 2027-01-10

Installment #3 = 100,000
Due = 2027-02-10
```

The schedule is generated at booking time.

Once generated, the schedule is fixed.

Do not dynamically regenerate the schedule every time the package or booking changes.

---

# 19. Installment Model

Suggested fields:

```text
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

Statuses:

```text
PENDING
PARTIALLY_PAID
PAID
OVERDUE
```

---

# 20. Installment Payment Allocation

Payments must be applied to the oldest unpaid installment first.

Example:

```text
Installment 1 = 100,000
Installment 2 = 100,000
Installment 3 = 100,000
```

Payment:

```text
150,000
```

Result:

```text
Installment 1
100,000 → PAID

Installment 2
50,000 → PARTIALLY_PAID

Installment 3
0 → PENDING
```

Another payment:

```text
250,000
```

Result:

```text
Installment 1 → PAID
Installment 2 → PAID
Installment 3 → PARTIALLY_PAID
```

---

# 21. Overpayment

If a payment exceeds the current installment amount:

```text
Installment amount = 100,000
Payment = 150,000
```

Then:

```text
100,000 → current installment
50,000 → next unpaid installment
```

If all installments are paid and excess money remains, the system must preserve the excess as a credit/overpayment rather than silently losing it.

---

# 22. Partial Payment

Partial payment leaves the installment open.

Example:

```text
Installment = 100,000
Paid = 40,000

Status = PARTIALLY_PAID
Outstanding = 60,000
```

---

# 23. Overdue Installments

When:

```text
due_date < current_time
AND outstanding > 0
```

the installment becomes:

```text
OVERDUE
```

The system should:

1. Trigger reminder/notification.
2. Allow a configurable grace period.
3. After grace period, mark the booking as:

```text
DEFAULTED
```

Background jobs should handle this.

---

# 24. Payment Methods

Supported methods:

```text
BKASH
NAGAD
VISA
MANUAL_BRANCH
```

For the assessment, real payment gateway credentials are not required unless explicitly provided.

A mock payment gateway may be implemented.

The architecture should still support real gateway adapters.

---

# 25. Payment Architecture

Use an abstraction:

```text
PaymentService
      |
      +---- BkashGateway
      |
      +---- NagadGateway
      |
      +---- VisaGateway
      |
      +---- ManualPaymentService
```

Business logic should not be tightly coupled to a specific gateway.

---

# 26. Payment Model

Suggested fields:

```text
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

Payment statuses:

```text
PENDING
PROCESSING
SUCCESS
FAILED
CANCELLED
REFUNDED
```

---

# 27. Gateway Transaction ID

Gateway transaction IDs must be unique.

Database constraint:

```text
UNIQUE(gateway_transaction_id)
```

This is required for webhook idempotency.

---

# 28. Payment Webhooks

Gateway webhooks can:

* Arrive late
* Arrive multiple times
* Arrive out of order

The system must handle all cases safely.

---

# 29. Webhook Idempotency

Example:

```text
Gateway transaction:
ABC123
```

Webhook arrives:

```text
payment_success ABC123
```

System processes it.

Same webhook arrives again:

```text
payment_success ABC123
```

System must NOT create another payment.

Recommended:

```text
gateway_transaction_id UNIQUE
```

and/or:

```text
webhook_event_id UNIQUE
```

Webhook events should be stored.

---

# 30. Payment Webhook Event Model

Suggested:

```text
id
payment_id
gateway
event_id
gateway_transaction_id
event_type
payload
received_at
processed_at
status
error_message
```

Statuses:

```text
RECEIVED
PROCESSED
FAILED
IGNORED
```

---

# 31. Out-of-Order Webhooks

Example:

```text
Event 1:
PAYMENT_SUCCESS

Event 2:
PAYMENT_PENDING
```

If `PAYMENT_SUCCESS` was processed first, the later stale event must not downgrade the payment.

Payment state transitions must be validated.

Example:

```text
PENDING
  ↓
PROCESSING
  ↓
SUCCESS
```

A stale event must not perform:

```text
SUCCESS → PENDING
```

Terminal states must be protected.

---

# 32. Server-Side Payment Verification

Never trust the frontend payment redirect.

Incorrect:

```text
Frontend receives success
        ↓
Frontend tells backend:
"Payment successful"
        ↓
Backend marks payment successful
```

Correct:

```text
Gateway
   ↓
Webhook / server-side verification
   ↓
Backend
   ↓
Verify gateway transaction
   ↓
Update payment
   ↓
Allocate payment
   ↓
Update booking
```

The frontend redirect is only for user experience.

---

# 33. Manual Branch Payment

Manual payments are recorded by branch employees/admin users.

Manual payments require approval.

Example:

```text
Created by:
Branch Employee A

Status:
PENDING_APPROVAL

Approved by:
Admin B

Status:
APPROVED
```

The creator and approver should be different users.

Store:

```text
created_by
approved_by
approved_at
```

Manual payment approval must create an audit log.

---

# 34. Payment Reconciliation

The system must compare:

```text
Internal payment records
        VS
Gateway settlement reports
```

Example:

```text
Internal:
Transaction ABC123
Amount = 100,000 BDT

Gateway:
Transaction ABC123
Amount = 95,000 BDT
```

This is a mismatch.

Do NOT silently modify the internal record.

Create a reconciliation record.

---

# 35. Reconciliation Model

Suggested fields:

```text
id
payment_id
gateway_transaction_id
internal_amount
gateway_amount
difference
status
gateway_settlement_date
resolved_by
resolved_at
resolution_notes
created_at
updated_at
```

Statuses:

```text
MATCHED
MISMATCH
RESOLVED
```

Only authorized admins can resolve mismatches.

---

# 36. Cancellation

Cancellation charges are configurable.

The cancellation charge depends on:

* Days remaining before departure
* Vendor costs already disbursed

Example:

```text
Booking amount = 500,000

Cancellation charge = 10%

Vendor cost already disbursed = 20,000

Received amount = 500,000

Refund =
500,000
- 50,000
- 20,000

= 430,000
```

The actual cancellation formula should be configurable.

---

# 37. Cancellation Rule

Possible configuration:

```text
More than 60 days:
5%

31–60 days:
10%

15–30 days:
25%

Less than 15 days:
50%
```

These percentages are implementation examples, not fixed requirements.

The system should make the cancellation rule configurable.

---

# 38. Cancellation Workflow

Cancellation follows:

```text
REQUEST
   ↓
APPROVAL
   ↓
PROCESSING
   ↓
COMPLETED
```

Suggested statuses:

```text
REQUESTED
APPROVED
REJECTED
PROCESSING
COMPLETED
```

---

# 39. Refund Rules

A refund can NEVER exceed the amount actually received for that booking.

Invariant:

```text
total_refunded <= total_received
```

Refund should be processed through:

```text
Request
   ↓
Approval
   ↓
Processing
   ↓
Completed
```

Refunds must never be hard deleted.

---

# 40. Partial Cancellation

A group booking can contain multiple pilgrims.

Example:

```text
Booking
 ├── Rahim
 ├── Karim
 └── Hasan
```

Karim cancels.

Result:

```text
Booking
 ├── Rahim → ACTIVE
 ├── Karim → CANCELLED
 └── Hasan → ACTIVE
```

Only the cancelled pilgrim's seat should be released.

The financial impact must be calculated for that pilgrim according to the configured cancellation rules.

---

# 41. Financial Records

Financial records must never be hard deleted.

Use:

* Status changes
* Reversal
* Refund
* Adjustment
* Audit logs

rather than physical deletion.

Soft deletion may be used where appropriate.

All financial records must remain available for:

* Reports
* Accounting
* Reconciliation
* Audit

---

# 42. Soft Delete

Entities may use:

```text
deleted_at
```

instead of physical deletion.

Example:

```text
deleted_at = NULL
```

means active.

```text
deleted_at != NULL
```

means soft deleted.

Financial records must still be visible in reporting and reconciliation.

---

# 43. Accounting Module

Basic accounting must cover:

## Booking Payment Tracking

Track:

```text
Booking total
Received amount
Outstanding amount
```

Example:

```text
Total = 600,000
Received = 400,000
Outstanding = 200,000
```

---

# 44. Vendor Fund Distribution

Track costs paid to:

* Hotels
* Airlines
* Transport
* Visa processing
* Other vendors

Costs may be incurred in SAR while collections are in BDT.

Vendor expense should preserve:

```text
amount_sar
exchange_rate
amount_bdt
currency
```

Example:

```text
Vendor cost:
1,000 SAR

Exchange rate:
1 SAR = 32 BDT

BDT equivalent:
32,000 BDT
```

Historical exchange rates must not be recalculated using today's rate.

---

# 45. Vendor Expense Model

Suggested:

```text
id
vendor_id
booking_id / package_id
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

Expense types:

```text
HOTEL
AIRLINE
TRANSPORT
VISA
OTHER
```

---

# 46. Inventory Management

Inventory must cover items issued to pilgrims.

Examples:

```text
Ihram sets
Bags
SIM cards
```

Track:

```text
Stock received
Stock issued
Stock returned
Stock adjusted
Current stock
```

---

# 47. Inventory Models

## Inventory Item

```text
id
name
sku
unit
quantity
minimum_stock
status
created_at
updated_at
```

## Inventory Transaction

```text
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

Transaction types:

```text
PURCHASE
ISSUE
RETURN
ADJUSTMENT
```

---

# 48. Authentication

Implement:

```text
Register
Login
Logout
Current user
```

Authentication should use secure HTTP-only cookies or another secure token strategy.

Never store sensitive authentication tokens insecurely in browser localStorage if avoidable.

---

# 49. Password Security

Passwords must be hashed using a secure password hashing algorithm such as:

```text
bcrypt
```

or:

```text
argon2
```

Never store plain-text passwords.

---

# 50. RBAC

Every protected API must verify:

1. Authentication
2. User identity
3. Role
4. Resource ownership where applicable

Example:

```text
GET /bookings/:id
```

A normal user can only access:

```text
booking.user_id === currentUser.id
```

Admins can access all bookings.

---

# 51. Input Validation

All API inputs must be validated.

Validate:

* Required fields
* String lengths
* Dates
* Numbers
* Currency values
* IDs
* Enum values
* Passport details
* Payment amounts
* Pagination
* Sorting
* Filters

Reject malformed requests.

---

# 52. Security Requirements

Protect against:

* SQL injection
* XSS
* CSRF where applicable
* Broken authorization
* IDOR
* Mass assignment
* Invalid state transitions
* Duplicate payments
* Replay attacks
* Malicious file uploads
* Excessive request rates

Use:

* DTO validation
* ORM parameterization
* RBAC
* Ownership checks
* Rate limiting
* Secure headers
* Authentication
* Audit logs

---

# 53. Audit Logs

Every state-changing financial/business action should be auditable.

Audit log should contain:

```text
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
RECONCILE_PAYMENT
UPDATE_PACKAGE
UPDATE_TIER
RELEASE_SEAT
```

---

# 54. Suggested Database Models

The following models are the recommended starting point.

---

## User

```text
User
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

Role:

```text
USER
ADMIN
```

---

## Package

```text
Package
-------
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

---

## PackageTier

```text
PackageTier
-----------
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

---

## Booking

```text
Booking
-------
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

Payment plan:

```text
FULL_PAYMENT
INSTALLMENT
```

---

## Pilgrim

```text
Pilgrim
-------
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

---

## Installment

```text
Installment
-----------
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

---

## Payment

```text
Payment
-------
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

---

## PaymentWebhookEvent

```text
PaymentWebhookEvent
-------------------
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

---

## ReconciliationRecord

```text
ReconciliationRecord
--------------------
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

---

## CancellationRequest

```text
CancellationRequest
-------------------
id
booking_id
pilgrim_id nullable
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

---

## Refund

```text
Refund
------
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

---

## Vendor

```text
Vendor
------
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

Vendor types:

```text
HOTEL
AIRLINE
TRANSPORT
VISA
OTHER
```

---

## VendorExpense

```text
VendorExpense
-------------
id
vendor_id
booking_id nullable
package_id nullable
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

---

## InventoryItem

```text
InventoryItem
-------------
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

---

## InventoryTransaction

```text
InventoryTransaction
--------------------
id
inventory_item_id
type
quantity
booking_id nullable
pilgrim_id nullable
created_by
notes
created_at
```

---

## AuditLog

```text
AuditLog
--------
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

---

# 55. Database Relationships

Main relationships:

```text
User
 │
 └──< Booking
          │
          ├──< Pilgrim
          ├──< Installment
          ├──< Payment
          ├──< CancellationRequest
          └──< Refund


Package
 │
 └──< PackageTier
          │
          └──< Booking


Payment
 │
 ├──< PaymentWebhookEvent
 └──< ReconciliationRecord


Vendor
 │
 └──< VendorExpense


InventoryItem
 │
 └──< InventoryTransaction


User
 │
 └──< AuditLog
```

---

# 56. Important Database Constraints

Implement appropriate database constraints.

Examples:

```text
User.email UNIQUE

Package.slug UNIQUE

Payment.gateway_transaction_id UNIQUE

PaymentWebhookEvent.event_id UNIQUE

PackageTier.total_quota >= 0

Payment.amount > 0

Installment.amount > 0

Installment.paid_amount >= 0
```

Important financial invariant:

```text
total_refunded <= total_received
```

Important quota invariant:

```text
confirmed_seats + held_seats <= total_quota
```

---

# 57. REST API Design

Base URL:

```text
/api/v1
```

---

# 58. Authentication Endpoints

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
```

---

# 59. Package Endpoints

Public:

```http
GET /api/v1/packages
GET /api/v1/packages/:id
GET /api/v1/packages/:id/tiers
```

Admin:

```http
POST   /api/v1/admin/packages
GET    /api/v1/admin/packages
GET    /api/v1/admin/packages/:id
PATCH  /api/v1/admin/packages/:id
DELETE /api/v1/admin/packages/:id
```

Deletion should normally be soft deletion.

---

# 60. Package Tier Endpoints

Admin:

```http
POST   /api/v1/admin/packages/:packageId/tiers
GET    /api/v1/admin/packages/:packageId/tiers
GET    /api/v1/admin/tiers/:id
PATCH  /api/v1/admin/tiers/:id
DELETE /api/v1/admin/tiers/:id
PATCH  /api/v1/admin/tiers/:id/quota
```

Quota adjustment must never reduce quota below already confirmed/held seats.

---

# 61. Booking Endpoints

User:

```http
POST /api/v1/bookings
GET  /api/v1/bookings
GET  /api/v1/bookings/:id
PATCH /api/v1/bookings/:id
POST /api/v1/bookings/:id/cancel
```

Admin:

```http
GET /api/v1/admin/bookings
GET /api/v1/admin/bookings/:id
PATCH /api/v1/admin/bookings/:id/status
```

Users must only access their own bookings.

---

# 62. Pilgrim Endpoints

```http
POST   /api/v1/bookings/:bookingId/pilgrims
GET    /api/v1/bookings/:bookingId/pilgrims
GET    /api/v1/bookings/:bookingId/pilgrims/:id
PATCH  /api/v1/bookings/:bookingId/pilgrims/:id
POST   /api/v1/bookings/:bookingId/pilgrims/:id/cancel
```

Authorization must verify booking ownership.

---

# 63. Installment Endpoints

```http
GET /api/v1/bookings/:bookingId/installments
GET /api/v1/installments/:id
```

Admin:

```http
GET /api/v1/admin/installments
GET /api/v1/admin/installments/overdue
```

Installment schedules should not be arbitrarily edited after booking creation unless an explicit admin adjustment feature is designed and audited.

---

# 64. Payment Endpoints

User:

```http
POST /api/v1/payments
GET  /api/v1/payments
GET  /api/v1/payments/:id
```

Payment initiation should validate:

* Booking ownership
* Booking status
* Outstanding amount
* Payment method
* Amount

---

# 65. Payment Gateway Endpoints

Example:

```http
POST /api/v1/payments/bkash/initiate
POST /api/v1/payments/nagad/initiate
POST /api/v1/payments/visa/initiate
```

Webhook:

```http
POST /api/v1/webhooks/bkash
POST /api/v1/webhooks/nagad
POST /api/v1/webhooks/visa
```

Webhook endpoints must NOT rely on normal user authentication.

They must validate the gateway's authentication/signature mechanism where applicable.

---

# 66. Manual Payment Endpoints

```http
POST /api/v1/admin/manual-payments
GET  /api/v1/admin/manual-payments
GET  /api/v1/admin/manual-payments/:id
POST /api/v1/admin/manual-payments/:id/approve
POST /api/v1/admin/manual-payments/:id/reject
```

Creator and approver must be different users.

---

# 67. Reconciliation Endpoints

```http
GET  /api/v1/admin/reconciliation
GET  /api/v1/admin/reconciliation/:id
POST /api/v1/admin/reconciliation/import
POST /api/v1/admin/reconciliation/:id/resolve
```

Possible filters:

```text
status
gateway
date_from
date_to
transaction_id
```

---

# 68. Cancellation Endpoints

User:

```http
POST /api/v1/bookings/:bookingId/cancellation-request
GET  /api/v1/bookings/:bookingId/cancellation-request
```

Admin:

```http
GET  /api/v1/admin/cancellations
GET  /api/v1/admin/cancellations/:id
POST /api/v1/admin/cancellations/:id/approve
POST /api/v1/admin/cancellations/:id/reject
```

---

# 69. Refund Endpoints

```http
GET /api/v1/bookings/:bookingId/refunds
GET /api/v1/refunds/:id
```

Admin:

```http
GET  /api/v1/admin/refunds
POST /api/v1/admin/refunds/:id/approve
POST /api/v1/admin/refunds/:id/process
```

Refund amount must never exceed received amount.

---

# 70. Vendor Endpoints

Admin:

```http
POST   /api/v1/admin/vendors
GET    /api/v1/admin/vendors
GET    /api/v1/admin/vendors/:id
PATCH  /api/v1/admin/vendors/:id
DELETE /api/v1/admin/vendors/:id
```

Expenses:

```http
POST /api/v1/admin/vendor-expenses
GET  /api/v1/admin/vendor-expenses
GET  /api/v1/admin/vendor-expenses/:id
PATCH /api/v1/admin/vendor-expenses/:id
```

---

# 71. Inventory Endpoints

Admin:

```http
POST /api/v1/admin/inventory/items
GET  /api/v1/admin/inventory/items
GET  /api/v1/admin/inventory/items/:id
PATCH /api/v1/admin/inventory/items/:id

POST /api/v1/admin/inventory/transactions
GET  /api/v1/admin/inventory/transactions
```

---

# 72. Reporting Endpoints

Admin:

```http
GET /api/v1/admin/reports/overview
GET /api/v1/admin/reports/bookings
GET /api/v1/admin/reports/payments
GET /api/v1/admin/reports/installments
GET /api/v1/admin/reports/refunds
GET /api/v1/admin/reports/seat-quota
GET /api/v1/admin/reports/vendor-expenses
GET /api/v1/admin/reports/inventory
```

Overview response can contain:

```text
total_bookings
confirmed_bookings
pending_bookings
total_collected
total_outstanding
total_refunded
total_available_seats
total_held_seats
total_confirmed_seats
overdue_installments
```

---

# 73. Audit Endpoints

Admin:

```http
GET /api/v1/admin/audit-logs
GET /api/v1/admin/audit-logs/:id
```

Filters:

```text
actor
action
entity_type
entity_id
date_from
date_to
```

---

# 74. API Pagination

List endpoints should use pagination.

Example:

```http
GET /api/v1/admin/bookings?page=1&limit=20
```

Response:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1000,
    "totalPages": 50
  }
}
```

Avoid returning millions of records in a single response.

---

# 75. Filtering and Sorting

Admin list endpoints should support:

```text
status
date_from
date_to
package
tier
payment_method
payment_status
booking_number
user
```

Sorting:

```text
created_at
amount
departure_date
due_date
```

Whitelist sortable columns to avoid unsafe dynamic SQL.

---

# 76. Frontend Structure

Suggested Next.js structure:

```text
app/
│
├── (auth)/
│   ├── login/
│   └── register/
│
├── packages/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
│
├── bookings/
│   ├── page.tsx
│   ├── create/
│   └── [id]/
│
├── payments/
│
├── profile/
│
└── dashboard/
    ├── page.tsx
    ├── packages/
    ├── bookings/
    ├── payments/
    ├── installments/
    ├── refunds/
    ├── reconciliation/
    ├── vendors/
    ├── inventory/
    ├── reports/
    └── audit-logs/
```

---

# 77. Frontend Public Pages

Required:

```text
/
```

Home page.

```text
/packages
```

Package listing.

```text
/packages/:id
```

Package details.

```text
/login
/register
```

Authentication.

---

# 78. Package Listing UI

Show:

* Package name
* Package type
* Departure date
* Return date
* Starting price
* Available tiers
* Available seats
* Booking window
* Status
* View details

Example:

```text
Hajj Premium 2027

Departure:
20 May 2027

Starting from:
450,000 BDT

Available tiers:
Economy
Standard
VIP

[View Package]
```

---

# 79. Booking UI

Booking form should include:

### Package

Read-only selected package.

### Tier

Select:

```text
Economy
Standard
VIP
```

Show:

```text
Price
Available seats
```

### Pilgrims

Allow:

```text
Add pilgrim
Remove pilgrim
Edit pilgrim
```

Each pilgrim needs passport information.

### Payment plan

```text
○ Full Payment

○ Installment Plan
```

If installment:

Show generated schedule.

---

# 80. Booking Review

Before final submission show:

```text
Package
Tier
Number of pilgrims
Price per pilgrim
Total amount
Payment plan
Down payment
Installment schedule
Terms
```

Then:

```text
[Confirm Booking]
```

The backend must perform the actual validation again.

Never trust frontend calculations.

---

# 81. User Booking Dashboard

Show:

```text
Booking Number
Package
Departure Date
Tier
Pilgrim Count
Total Amount
Paid
Outstanding
Status
```

Example:

```text
HJJ-2027-000123
Hajj Premium
Standard
3 Pilgrims

Total: 1,650,000 BDT
Paid: 550,000 BDT
Outstanding: 1,100,000 BDT

Status: PARTIALLY_PAID
```

---

# 82. Booking Details UI

Display:

```text
Booking information
Package
Tier
Departure
Pilgrims
Payment status
Installment schedule
Payment history
Cancellation status
Refund status
```

---

# 83. Admin Dashboard

Dashboard cards:

```text
Total Bookings
Confirmed Bookings
Total Collection
Outstanding Amount
Total Refunds
Available Seats
Held Seats
Overdue Installments
```

Charts may show:

```text
Bookings over time
Payments over time
Package distribution
Payment method distribution
```

Charts are optional but useful.

---

# 84. Admin Package Management

Features:

```text
Create package
Edit package
Soft delete/archive package
Add tier
Edit tier
Adjust quota
View seat availability
```

Quota adjustment must enforce:

```text
new quota >= already confirmed/held seats
```

---

# 85. Admin Booking Management

Features:

```text
Search
Filter
Pagination
View booking
View pilgrims
View payments
View installments
View cancellation
View refund
View audit history
```

---

# 86. Admin Payment Management

Display:

```text
Payment ID
Booking
Amount
Method
Gateway transaction
Status
Date
```

Actions:

```text
Approve manual payment
Reject manual payment
View webhook events
View reconciliation
```

---

# 87. Admin Refund Management

Display:

```text
Refund ID
Booking
Received amount
Cancellation charge
Vendor cost
Refund amount
Status
Requested by
Approved by
Processed by
```

---

# 88. Admin Reconciliation UI

Display:

```text
Gateway transaction
Internal amount
Gateway amount
Difference
Status
```

For mismatches:

```text
[Mismatch]

Internal:
100,000 BDT

Gateway:
95,000 BDT

Difference:
5,000 BDT

[Resolve]
```

Resolution must require an admin note.

---

# 89. Reporting Performance

The system is expected to support approximately 5 million users.

The application should be designed for scalability.

Recommended:

```text
CDN
 ↓
Load Balancer
 ↓
Multiple Next.js instances
 ↓
Multiple NestJS API instances
 ↓
Redis
 ↓
RabbitMQ
 ↓
PostgreSQL Primary
 ↓
PostgreSQL Read Replicas
```

---

# 90. Reporting Optimization

Do not execute expensive aggregation queries over millions of records on every dashboard request.

Use:

* Proper database indexes
* Pagination
* Read replicas
* Redis caching
* Materialized views
* Summary tables
* Pre-aggregation
* Background report generation

Example:

```text
Raw payments
     ↓
Daily aggregation worker
     ↓
report_daily_payment_summary
     ↓
Admin dashboard
```

---

# 91. Redis Usage

Redis can be used for:

* Cache
* Rate limiting
* Short-lived data
* Frequently accessed package data
* Report cache
* Distributed locks where appropriate

Redis must NOT be the authoritative source for financial records.

PostgreSQL remains the source of truth.

---

# 92. RabbitMQ Usage

RabbitMQ/background workers can handle:

* Payment webhook processing
* Email notifications
* SMS notifications
* Installment reminders
* Overdue processing
* Seat hold expiration
* Report generation
* Reconciliation processing

Long-running operations should not block HTTP requests unnecessarily.

---

# 93. Background Jobs

Recommended jobs:

```text
expire-seat-holds
process-overdue-installments
send-installment-reminders
process-payment-webhooks
generate-report
reconciliation-processing
send-notifications
```

---

# 94. Caching Strategy

Good candidates:

```text
Package listing
Package details
Package tiers
Public package availability
Dashboard summaries
```

Do NOT cache mutable financial truth without an invalidation strategy.

After important changes, invalidate relevant cache entries.

---

# 95. High-Level Architecture

Recommended architecture:

```text
                         USERS
                           |
                           v
                    CDN / WAF
                           |
                           v
                    Load Balancer
                           |
              +------------+------------+
              |                         |
              v                         v
        Next.js App                NestJS API
        Instances                 Instances
                                        |
                  +---------------------+-------------------+
                  |                     |                   |
                  v                     v                   v
                Redis              RabbitMQ           PostgreSQL
                  |                     |                   |
                  |                     v                   |
                  |                  Workers                |
                  |                                         |
                  |                              +----------+---------+
                  |                              |                    |
                  |                              v                    v
                  |                         Read Replicas          Backup
                  |
                  v
             Cache Layer


External systems:

NestJS
   |
   +---- bKash
   +---- Nagad
   +---- VISA
   +---- Notification provider
```

---

# 96. Critical Transaction Boundaries

## Booking

```text
BEGIN

Lock tier
Check quota
Reserve seats
Create booking
Create pilgrims
Create installments
Create audit log

COMMIT
```

## Payment

```text
BEGIN

Validate/idempotency
Record payment
Allocate payment
Update installments
Update booking balance/status
Create audit log

COMMIT
```

## Cancellation

```text
BEGIN

Validate booking
Calculate charges
Create cancellation
Release seats if applicable
Create refund
Create audit log

COMMIT
```

---

# 97. API Error Format

Use a consistent format.

Example:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SEATS",
    "message": "Not enough seats are available for this tier."
  }
}
```

Common errors:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
BOOKING_WINDOW_CLOSED
INSUFFICIENT_SEATS
BOOKING_EXPIRED
PAYMENT_ALREADY_PROCESSED
INVALID_PAYMENT_STATE
REFUND_LIMIT_EXCEEDED
CANCELLATION_NOT_ALLOWED
INSTALLMENT_OVERDUE
RECONCILIATION_MISMATCH
```

---

# 98. Idempotency

State-changing APIs that may be retried should support idempotency where appropriate.

Example:

```http
Idempotency-Key: abc-123
```

Useful for:

```text
Payment creation
Refund processing
Booking creation
Webhook processing
```

The server should ensure retrying the same operation does not create duplicate financial records.

---

# 99. Observability

Production-oriented implementation should include:

* Structured logging
* Request IDs
* Error logging
* Payment event logging
* Webhook logs
* Audit logs

Useful fields:

```text
request_id
user_id
booking_id
payment_id
gateway_transaction_id
timestamp
```

Never log:

* Passwords
* Full payment credentials
* Sensitive card information
* Authentication secrets

---

# 100. Testing Requirements

At minimum test:

## Unit tests

* Booking calculation
* Installment generation
* Payment allocation
* Cancellation calculation
* Refund calculation
* Payment state transitions

## Integration tests

* Booking creation
* Seat reservation
* Payment confirmation
* Webhook processing
* Refund workflow

## Critical concurrency test

Test two concurrent users attempting to book the last seat.

Expected:

```text
User A → SUCCESS
User B → INSUFFICIENT_SEATS
```

Never:

```text
User A → SUCCESS
User B → SUCCESS
```

---

# 101. Important Test Cases

### Seat tests

```text
1 seat available
2 simultaneous requests
```

Expected:

```text
1 success
1 failure
```

### Duplicate webhook

```text
Same event received twice
```

Expected:

```text
One payment record
```

### Out-of-order webhook

```text
SUCCESS
then stale PENDING
```

Expected:

```text
Payment remains SUCCESS
```

### Partial payment

```text
100k installment
40k payment
```

Expected:

```text
PARTIALLY_PAID
60k outstanding
```

### Overpayment

```text
Installment = 100k
Payment = 150k
```

Expected:

```text
100k current installment
50k next installment
```

### Refund

```text
Received = 100k
Refund = 120k
```

Expected:

```text
REJECT
```

### Quota

```text
Confirmed = 50
Held = 10
New quota = 55
```

Expected:

```text
REJECT
```

because quota cannot be below seats already committed.

---

# 102. Frontend State Management

Use server-state management such as TanStack Query for:

* Packages
* Bookings
* Payments
* Installments
* Reports

Use local React state/form state for:

* Form fields
* UI state
* Modal state
* Temporary booking form state

Avoid duplicating server state unnecessarily.

---

# 103. Frontend Form Validation

Use:

```text
React Hook Form
+
Zod
```

Validate:

* Required fields
* Passport
* Dates
* Email
* Phone
* Payment plan
* Pilgrim information

However, frontend validation is only for UX.

The backend must validate everything again.

---

# 104. Frontend Authorization

The frontend should hide unauthorized navigation.

Example:

```text
USER:
Packages
Bookings
Payments
Profile

ADMIN:
Dashboard
Packages
Bookings
Payments
Refunds
Reconciliation
Reports
Inventory
Vendors
Audit Logs
```

However, frontend hiding is NOT security.

Backend authorization remains mandatory.

---

# 105. Docker

Recommended services:

```yaml
services:

  frontend:
    # Next.js

  backend:
    # NestJS

  postgres:
    # PostgreSQL

  redis:
    # Redis

  rabbitmq:
    # RabbitMQ
```

Development should be possible with:

```bash
docker compose up
```

---

# 106. Environment Variables

Example:

```env
DATABASE_URL=
REDIS_URL=
RABBITMQ_URL=

JWT_SECRET=

BKASH_BASE_URL=
BKASH_API_KEY=
BKASH_API_SECRET=

NAGAD_BASE_URL=
NAGAD_API_KEY=

VISA_API_URL=
VISA_API_KEY=

NEXT_PUBLIC_API_URL=
```

Never commit secrets.

Provide:

```text
.env.example
```

---

# 107. README Requirements

README must contain:

1. Project overview
2. Features
3. Architecture
4. Technology stack
5. Prerequisites
6. Environment variables
7. Installation
8. Database migration
9. Seed data
10. Running locally
11. Running tests
12. API documentation
13. Architecture diagram
14. ERD
15. Business rules
16. Assumptions
17. Trade-offs
18. Scalability strategy

---

# 108. Required README Questions

The README MUST explicitly answer:

## How do you prevent overselling a seat under concurrent bookings?

Answer:

Use a PostgreSQL transaction with row-level locking or an atomic conditional update. Seat availability is checked and reservation is performed atomically so concurrent transactions cannot allocate the same final seat.

---

## How do you handle a duplicate or out-of-order payment webhook?

Answer:

Use unique gateway/event transaction identifiers and idempotent processing. Duplicate events are ignored. Payment state transitions are validated so stale events cannot downgrade an already successful terminal payment state.

---

## How would you keep reporting fast at 5 million users?

Answer:

Use proper indexes, pagination, read replicas, caching, pre-aggregated summary tables/materialized views, and asynchronous report generation for expensive reports.

---

# 109. Assumptions

The implementation may make the following assumptions:

1. Real payment gateway credentials may not be available.
2. Mock payment adapters can be used.
3. Actual gateway-specific APIs should be abstracted behind gateway interfaces.
4. Notification providers can be mocked.
5. Exact cancellation percentages are configurable and not hardcoded as business requirements.
6. Exact installment schedule rules may be configurable.
7. The assessment focuses on demonstrating architecture and correctness rather than production deployment.
8. PostgreSQL is the authoritative source for financial and booking data.
9. Redis is used only as a supporting infrastructure component.
10. RabbitMQ is used for asynchronous processing.
11. Real banking settlement files may be represented using CSV/mock data for the assessment.

---

# 110. Trade-offs

Document trade-offs explicitly.

Example:

## Real Payment Gateway

Instead of implementing production bKash/Nagad/VISA credentials:

```text
PaymentGateway interface
        ↓
MockPaymentGateway
```

This demonstrates the architecture without requiring real credentials.

## Reporting

Instead of implementing a complete data warehouse:

```text
PostgreSQL
+
indexes
+
summary tables/materialized views
+
Redis cache
```

can be used for the assessment.

## Scale

The assessment may run as a Docker Compose application locally, while the architecture diagram demonstrates how the same application can scale horizontally in production.

---

# 111. Non-Goals

Do NOT unnecessarily implement:

* Full ERP
* Full accounting ledger system
* Real banking infrastructure
* Complete airline integration
* Complete hotel supplier integration
* Actual visa authority integration
* Complex tax system
* Multi-country legal compliance
* Advanced BI/data warehouse
* Microservices for every module

Keep the application modular while avoiding unnecessary complexity.

---

# 112. Recommended Backend Module Structure

```text
src/

auth/
users/

packages/
package-tiers/

bookings/
pilgrims/

installments/

payments/
payment-gateways/
webhooks/
reconciliation/

cancellations/
refunds/

vendors/
accounting/
inventory/

reports/
audit/

notifications/

common/
database/
config/
```

---

# 113. Recommended NestJS Architecture

Use:

```text
Controller
    ↓
Service
    ↓
Repository / Prisma
    ↓
PostgreSQL
```

For complex operations:

```text
Controller
    ↓
Application Service
    ↓
Transaction
    ↓
Multiple repositories/services
```

Example:

```text
BookingController
       ↓
BookingService
       ↓
Prisma Transaction
       ↓
Tier + Booking + Pilgrim + Installment
```

---

# 114. Important Business Invariants

These must ALWAYS remain true.

### Seat quota

```text
confirmed seats + held seats <= total quota
```

### Refund

```text
total refunded <= total received
```

### Payment

```text
same gateway transaction cannot create multiple successful payments
```

### Booking ownership

```text
USER can only access own bookings
```

### Manual payment

```text
creator != approver
```

### Historical price

```text
confirmed booking price does not change
when package tier price changes
```

### Installments

```text
paid amount <= installment amount
```

unless overpayment is intentionally represented separately.

### Financial history

```text
Financial records are never silently deleted.
```

---

# 115. Critical Flows

## Flow 1 — Normal Full Payment

```text
User
 ↓
Browse package
 ↓
Select tier
 ↓
Add pilgrims
 ↓
Choose full payment
 ↓
Create booking
 ↓
Seats HELD
 ↓
Payment initiated
 ↓
Gateway
 ↓
Webhook
 ↓
Server-side verification
 ↓
Payment SUCCESS
 ↓
Payment allocated
 ↓
Booking CONFIRMED
 ↓
Seats CONFIRMED
```

---

# 116. Flow 2 — Payment Timeout

```text
User
 ↓
Create booking
 ↓
Seats HELD
 ↓
Payment not received
 ↓
hold_expires_at reached
 ↓
Background worker
 ↓
Booking EXPIRED
 ↓
Seats RELEASED
```

---

# 117. Flow 3 — Installment Payment

```text
Booking
 ↓
Installment schedule created
 ↓
Down payment
 ↓
Installment #1
 ↓
Installment #2
 ↓
Installment #3
 ↓
Fully paid
 ↓
Booking CONFIRMED
```

---

# 118. Flow 4 — Duplicate Webhook

```text
Gateway
 ↓
SUCCESS event
 ↓
Process
 ↓
Payment SUCCESS

Same event
 ↓
Received again
 ↓
Find existing event/transaction
 ↓
Ignore
```

---

# 119. Flow 5 — Manual Payment

```text
Branch Employee
 ↓
Record payment
 ↓
PENDING_APPROVAL
 ↓
Admin
 ↓
Approve
 ↓
Payment recorded
 ↓
Allocate to installment
 ↓
Audit log
```

---

# 120. Flow 6 — Cancellation

```text
User
 ↓
Cancellation request
 ↓
Calculate cancellation charge
 ↓
Calculate vendor cost
 ↓
Admin approval
 ↓
Refund created
 ↓
Refund processed
 ↓
Seats released
 ↓
Audit log
```

---

# 121. Flow 7 — Partial Cancellation

```text
Booking
 ├── Pilgrim A
 ├── Pilgrim B
 └── Pilgrim C

Pilgrim B requests cancellation

        ↓

Booking
 ├── Pilgrim A ACTIVE
 ├── Pilgrim B CANCELLED
 └── Pilgrim C ACTIVE

Only Pilgrim B's seat is released.
```

---

# 122. Flow 8 — Reconciliation

```text
Gateway Settlement
        ↓
Import settlement
        ↓
Match transaction ID
        ↓
Compare amounts
        |
        +---- MATCH
        |
        +---- MISMATCH
                  ↓
             Admin review
                  ↓
              Resolution
                  ↓
              Audit log
```

---

# 123. UI Design Principles

The UI should be:

* Clean
* Responsive
* Professional
* Easy to navigate
* Consistent
* Accessible

Focus on usability rather than excessive animations.

Important UI elements:

```text
Tables
Forms
Modals
Confirmation dialogs
Status badges
Pagination
Search
Filters
Loading states
Empty states
Error states
Toast notifications
```

---

# 124. Status Badge Colors

Use semantic styling:

```text
SUCCESS / CONFIRMED → positive
PENDING → warning
FAILED / CANCELLED → destructive
OVERDUE → destructive
PROCESSING → informational
```

Do not rely only on color; include text labels.

---

# 125. Definition of Done

The project is considered complete when:

* [ ] Users can register/login.
* [ ] Users can browse packages.
* [ ] Admins can manage packages.
* [ ] Admins can manage package tiers.
* [ ] Users can create bookings.
* [ ] Users can add multiple pilgrims.
* [ ] Seat quota is enforced.
* [ ] Concurrent booking cannot oversell.
* [ ] Seats are held during payment.
* [ ] Expired holds release seats.
* [ ] Prices are frozen after confirmation.
* [ ] Full payment works.
* [ ] Installment schedules are generated.
* [ ] Payments allocate to oldest unpaid installments.
* [ ] Partial payments work.
* [ ] Overpayments carry forward.
* [ ] Overdue installments are detected.
* [ ] Payment webhook is idempotent.
* [ ] Out-of-order webhook cannot corrupt payment state.
* [ ] Server-side payment verification is implemented/abstracted.
* [ ] Manual payment approval works.
* [ ] Reconciliation is supported.
* [ ] Cancellation workflow works.
* [ ] Partial cancellation works.
* [ ] Refund workflow works.
* [ ] Refund cannot exceed received amount.
* [ ] Vendor expenses work.
* [ ] SAR → BDT conversion is stored.
* [ ] Inventory management exists.
* [ ] Audit logs exist.
* [ ] Soft deletion is supported.
* [ ] Admin reports exist.
* [ ] Pagination exists.
* [ ] RBAC exists.
* [ ] Input validation exists.
* [ ] ERD is included.
* [ ] High-level architecture diagram is included.
* [ ] README is complete.
* [ ] Tests cover critical business logic.
* [ ] Docker setup works.

---

# 126. AI Coding Instructions

When using an AI coding assistant on this project:

1. Read this entire `PROJECT_CONTEXT.md` before implementing features.
2. Treat the Business Rules section as authoritative.
3. Do not simplify away concurrency requirements.
4. Do not use frontend state as the source of truth for financial data.
5. Do not trust client-side payment success.
6. Do not hard-delete financial records.
7. Do not create duplicate payment records for repeated webhooks.
8. Do not allow users to access other users' bookings.
9. Do not calculate historical booking prices from current package prices.
10. Use PostgreSQL transactions for critical financial/booking operations.
11. Preserve auditability.
12. Use database constraints in addition to application validation.
13. Prefer modular architecture.
14. Keep controllers thin and business logic inside services.
15. Avoid unnecessary microservices.
16. Do not introduce libraries unless they provide clear value.
17. Do not change business rules without explicitly documenting the change.
18. Before implementing a major feature, identify:

    * database changes
    * API changes
    * authorization requirements
    * transaction requirements
    * audit requirements
    * background job requirements
    * frontend changes
    * tests required
19. When modifying an existing feature, preserve all existing business invariants.
20. Financial operations must be treated as high-integrity operations.

---

# 127. Suggested Implementation Order

Implement in this order.

## Phase 1 — Foundation

```text
1. Monorepo/project setup
2. Docker
3. PostgreSQL
4. Prisma
5. NestJS
6. Next.js
7. Authentication
8. RBAC
```

## Phase 2 — Packages

```text
9. Package model
10. Package tier model
11. Admin package CRUD
12. Public package listing
13. Package details
```

## Phase 3 — Booking

```text
14. Booking model
15. Pilgrim model
16. Booking creation
17. Seat reservation
18. Transaction/locking
19. Seat hold
20. Seat expiration
```

## Phase 4 — Payments

```text
21. Payment model
22. Payment service
23. Mock gateway
24. Webhook model
25. Idempotency
26. Payment allocation
```

## Phase 5 — Installments

```text
27. Installment model
28. Schedule generation
29. Partial payment
30. Overpayment
31. Oldest-first allocation
32. Overdue processing
```

## Phase 6 — Financial Operations

```text
33. Manual payments
34. Reconciliation
35. Cancellation
36. Refunds
37. Partial cancellation
38. Vendor expenses
39. Currency conversion
```

## Phase 7 — Admin

```text
40. Dashboard
41. Booking management
42. Payment management
43. Refund management
44. Reconciliation
45. Reports
46. Inventory
47. Audit logs
```

## Phase 8 — Scalability

```text
48. Redis
49. RabbitMQ
50. Background workers
51. Report aggregation
52. Caching
53. Database indexes
```

## Phase 9 — Quality

```text
54. Unit tests
55. Integration tests
56. Concurrency tests
57. Security review
58. README
59. ERD
60. Architecture diagram
```

---

# 128. Final Architecture Goal

The final system should conceptually look like:

```text
                         ┌──────────────────┐
                         │      Users       │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   Next.js Web    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │   NestJS API     │
                         └────────┬─────────┘
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
          ▼                       ▼                        ▼
      PostgreSQL                Redis                  RabbitMQ
          │                       │                        │
          │                       │                        ▼
          │                       │                   Background
          │                       │                    Workers
          │                       │                        │
          │                       │            ┌───────────┼───────────┐
          │                       │            │           │           │
          ▼                       ▼            ▼           ▼           ▼
     Transactions              Cache       Payments    Reminders    Reports
          │
          ├── Users
          ├── Packages
          ├── Tiers
          ├── Bookings
          ├── Pilgrims
          ├── Installments
          ├── Payments
          ├── Refunds
          ├── Reconciliation
          ├── Vendors
          ├── Inventory
          └── Audit Logs
```

The primary source of truth for:

```text
Bookings
Seats
Payments
Installments
Refunds
Accounting
```

must remain PostgreSQL.

Redis and RabbitMQ are supporting infrastructure, not replacements for the transactional database.
