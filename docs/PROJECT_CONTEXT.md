# Hajj & Umrah Booking System — AI Context

## 1. Project

Assessment project for a Hajj & Umrah package booking system.

Stack:
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT / secure HTTP-only cookies
- Optional: Redis, RabbitMQ, Docker

Scale requirement: approximately 5M registered users.
This does NOT mean 5M concurrent users.

---

# 2. Core Features

## Pilgrim

- Register/login
- Browse published packages
- View package tiers and remaining seats
- Create booking
- Add multiple pilgrims
- Provide passport information
- Choose full payment or installment
- View booking/payment/installment status
- Request cancellation
- Cancel individual pilgrim where allowed

## Admin

- Manage packages
- Manage package tiers and quotas
- Manage bookings
- Manage manual payments
- Approve/reject manual payments
- Reconcile gateway settlements
- Manage cancellations/refunds
- Manage vendors and expenses
- Manage inventory
- View reports
- View audit logs

---

# 3. Package Rules

Package types:

- HAJJ
- RAMADAN_UMRAH
- OFF_SEASON_UMRAH
- ZIYARAH

Each package has:

- departure date
- return date
- booking start/end
- one or more tiers

Tier:

- Economy / Standard / VIP
- price
- finite seat quota

Important:

- Never oversell seats.
- Concurrent last-seat bookings must be handled safely.
- Price is frozen when booking is confirmed.
- Admin cannot reduce quota below committed seats.
- A held seat is treated as committed until the hold expires.

---

# 4. Booking Rules

A booking:

- belongs to one user
- belongs to one package
- belongs to one tier
- can contain multiple pilgrims

Booking creation:

1. Lock tier row / atomically reserve seats.
2. Verify seats are available.
3. Capture current tier price.
4. Create booking.
5. Create pilgrims.
6. Create installment schedule if required.
7. Commit transaction.

Seats are held when booking is created.

If payment is not received within the configured hold period:

- booking expires
- held seats are released

Confirmed booking price must never change if admin later changes package pricing.

Financial records are soft-deleted only; never hard-delete financial history.

---

# 5. Payments

Methods:

- BKASH
- NAGAD
- VISA
- MANUAL_BRANCH

Payment plans:

- FULL_PAYMENT
- INSTALLMENT

Installment rules:

- schedule generated when booking is created
- schedule is fixed
- final installment must be paid before departure
- payments are applied to oldest unpaid installment first
- partial payment leaves installment open
- overpayment carries forward

Never trust payment success from the frontend redirect.

Gateway payment must be verified server-side.

---

# 6. Webhooks

Gateway webhooks may be:

- duplicated
- delayed
- out of order

Therefore:

- webhook processing must be idempotent
- store webhook event IDs
- store gateway transaction IDs
- duplicate events must not create duplicate payments
- stale events must not move financial state backwards

Recommended:

payment_webhook_events
- event_id UNIQUE
- gateway_transaction_id
- event_type
- payload
- status
- processed_at

---

# 7. Reconciliation

Gateway settlement reports are compared with internal payment records.

Possible states:

- MATCHED
- MISMATCH
- RESOLVED

Mismatch must be tracked and manually resolved.

Never silently modify internal financial records to make them match the gateway.

---

# 8. Cancellation / Refund

Cancellation flow:

REQUESTED
→ APPROVED
→ PROCESSING
→ COMPLETED

or REJECTED / FAILED.

Cancellation charge depends on:

- days remaining
- vendor costs already incurred

Partial cancellation is supported.

Refund cannot exceed the amount actually received.

Financial history remains auditable.

---

# 9. Accounts / Vendors / Inventory

Vendor types:

- HOTEL
- AIRLINE
- TRANSPORT
- VISA
- OTHER

Vendor expenses must support:

- original currency (e.g. SAR)
- exchange rate
- converted BDT amount
- booking/package reference

Do not overwrite historical exchange rates.

Inventory examples:

- Ihram
- Bags
- SIM cards

Track:

- purchases
- issues
- returns
- adjustments

---

# 10. Database

Core entities:

users
packages
package_tiers
bookings
pilgrims
installments
payments
payment_allocations
payment_webhook_events
reconciliation_records
cancellation_requests
refunds
vendors
vendor_expenses
inventory_items
inventory_transactions
audit_logs

Optional:

booking_status_history

Use:

- UUID internal IDs
- human-readable booking number
- DECIMAL for money
- PostgreSQL as source of truth
- Prisma transactions
- soft deletes where appropriate

---

# 11. Important DB Invariants

Must always hold:

held_seats + confirmed_seats <= quota

quota >= committed seats

paid_amount <= installment_amount

total_refunded <= total_received

payment allocation <= available payment

outstanding_amount >= 0

received_amount >= 0

---

# 12. Seat Concurrency

Preferred implementation:

BEGIN

SELECT package_tier
FROM package_tiers
WHERE id = ?
FOR UPDATE

Check available seats.

If available:

- increase held seats
- create booking
- create pilgrims
- create installments
- create audit log

COMMIT

Alternative:

UPDATE package_tiers
SET available_seats = available_seats - ?
WHERE id = ?
AND available_seats >= ?

Only continue if affected rows = 1.

Seat reservation must be synchronous and transactional.

Do NOT put seat allocation behind RabbitMQ.

---

# 13. Main API

Base:

/api/v1

Auth:

POST /auth/register
POST /auth/login
POST /auth/logout
GET /auth/me

Packages:

GET /packages
GET /packages/:id

Admin packages:

POST /admin/packages
PATCH /admin/packages/:id
DELETE /admin/packages/:id

Admin tiers:

POST /admin/packages/:packageId/tiers
PATCH /admin/tiers/:id
PATCH /admin/tiers/:id/quota

Bookings:

POST /bookings
GET /bookings
GET /bookings/:id
PATCH /bookings/:id

Pilgrims:

POST /bookings/:bookingId/pilgrims
GET /bookings/:bookingId/pilgrims
PATCH /bookings/:bookingId/pilgrims/:pilgrimId
POST /bookings/:bookingId/pilgrims/:pilgrimId/cancel

Installments:

GET /bookings/:bookingId/installments
GET /installments/:id

Payments:

POST /payments
GET /payments
GET /payments/:id

Webhooks:

POST /webhooks/bkash
POST /webhooks/nagad
POST /webhooks/visa

Manual payments:

POST /admin/manual-payments
POST /admin/manual-payments/:id/approve
POST /admin/manual-payments/:id/reject

Reconciliation:

GET /admin/reconciliation
POST /admin/reconciliation/import
POST /admin/reconciliation/:id/resolve

Cancellation:

POST /bookings/:bookingId/cancellation-request
GET /admin/cancellations
POST /admin/cancellations/:id/approve
POST /admin/cancellations/:id/reject

Refund:

GET /bookings/:bookingId/refunds
GET /admin/refunds
POST /admin/refunds/:id/approve
POST /admin/refunds/:id/process

Reports:

GET /admin/reports/overview
GET /admin/reports/bookings
GET /admin/reports/payments
GET /admin/reports/installments
GET /admin/reports/refunds
GET /admin/reports/seat-quota

---

# 14. Authorization

Roles:

USER
ADMIN

Users:

- access only their own bookings/payments
- cannot access admin APIs

Admins:

- access admin management/reporting APIs

Always perform ownership checks.

Role guard alone is not sufficient because of IDOR risk.

---

# 15. Idempotency

Use Idempotency-Key for operations where duplicate requests can cause financial/state problems.

Important operations:

- booking creation
- payment creation
- refund processing
- webhook processing

Webhook uniqueness:

event_id UNIQUE

Gateway transaction IDs should also be unique where applicable.

---

# 16. Audit

Every important state-changing action should create an audit log.

Examples:

- booking created
- booking confirmed
- payment received
- installment updated
- quota changed
- cancellation approved
- refund processed
- manual payment approved
- reconciliation resolved

Store:

actor
action
entity
old value
new value
timestamp

---

# 17. Scheduled Jobs

Required time-based processes:

- expire unpaid seat holds
- mark overdue installments
- send overdue reminders
- default bookings after grace period

For the assessment, a NestJS scheduler/cron job is sufficient.

RabbitMQ is NOT required for these.

RabbitMQ/workers can be shown as a production scaling option.

---

# 18. Scaling

Production architecture may include:

Client
↓
CDN / Load Balancer
↓
Next.js instances
↓
NestJS instances
↓
Redis / PostgreSQL / Workers

Possible additions:

- Redis caching
- Redis rate limiting
- RabbitMQ
- background workers
- PostgreSQL read replicas
- pre-aggregated reporting tables
- CDN
- horizontal scaling

PostgreSQL remains the source of truth.

Do not use Redis as the source of truth for:

- seats
- payments
- bookings
- refunds

For reports at large scale:

- proper indexes
- pagination
- aggregate/precomputed reporting data
- caching
- read replicas where appropriate

---

# 19. MVP vs Production

## Must implement

- Authentication
- RBAC
- Packages
- Package tiers
- Booking
- Multiple pilgrims
- Seat concurrency
- Seat hold/expiration
- Full/installment payments
- Payment allocation
- Webhook idempotency
- Cancellation
- Refund
- Reconciliation
- Reports
- Audit logs

## Optional

- Redis
- RabbitMQ
- Worker processes
- Mock payment gateway
- Swagger
- Automated tests
- Docker
- Advanced report caching

Do not add infrastructure complexity unless it provides a clear benefit.

---

# 20. Backend Module Structure

backend/src/

auth/
users/
packages/
bookings/
pilgrims/
payments/
installments/
cancellations/
refunds/
reconciliation/
vendors/
expenses/
inventory/
reports/
audit/
scheduler/
config/
database/
common/

Use domain-based modules.

Controllers should remain thin.

Business rules belong in services.

Database access belongs behind the service/data-access layer.

---

# 21. Development Priority

Implement in this order:

1. Database + Prisma
2. Auth + users
3. Packages + tiers
4. Booking + seat concurrency
5. Pilgrims
6. Installments
7. Payments
8. Webhooks/idempotency
9. Cancellation/refunds
10. Reconciliation
11. Admin reports
12. Audit
13. Scheduler
14. Frontend polish
15. Optional scaling features

The primary end-to-end flow should work:

Register
→ Login
→ Browse package
→ Create booking
→ Add pilgrims
→ Pay
→ Webhook verification
→ Installment/payment update
→ Booking confirmation

---

# 22. Important Development Rule

Do not invent additional business rules unless necessary.

When implementing something ambiguous:

1. Follow this document.
2. Prefer simple transactional PostgreSQL solutions.
3. Keep financial operations auditable.
4. Prefer correctness over premature scalability.
5. Document assumptions in README.