# API Specification — Hajj & Umrah Package Booking System

## 1. API Overview

Base URL:

```text
/api/v1
```

Protocol:

```text
HTTPS
```

Format:

```text
JSON
```

Authentication:

```text
JWT/session using secure HTTP-only cookies
```

---

# 2. Standard Response Format

Successful response:

```json
{
  "success": true,
  "data": {}
}
```

Paginated response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SEATS",
    "message": "Not enough seats are available."
  }
}
```

---

# 3. Authentication

## Register

```http
POST /api/v1/auth/register
```

Request:

```json
{
  "name": "Rahim Ahmed",
  "email": "rahim@example.com",
  "phone": "01700000000",
  "password": "secure-password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Rahim Ahmed",
      "email": "rahim@example.com",
      "role": "USER"
    }
  }
}
```

---

## Login

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "rahim@example.com",
  "password": "secure-password"
}
```

---

## Logout

```http
POST /api/v1/auth/logout
```

Authenticated.

---

## Current User

```http
GET /api/v1/auth/me
```

Authenticated.

---

# 4. Public Packages

## List Packages

```http
GET /api/v1/packages
```

Query parameters:

```text
type
status
departure_from
departure_to
page
limit
sort
```

Example:

```http
GET /api/v1/packages?type=HAJJ&page=1&limit=12
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Hajj Premium 2027",
      "type": "HAJJ",
      "departureDate": "2027-05-20",
      "startingPrice": 450000,
      "tiers": [
        {
          "id": "uuid",
          "name": "Economy",
          "price": 450000,
          "availableSeats": 20
        }
      ]
    }
  ],
  "meta": {}
}
```

---

## Package Details

```http
GET /api/v1/packages/:id
```

Returns:

* Package information
* Booking window
* Departure date
* Tiers
* Current seat availability

---

# 5. Admin Package APIs

All require:

```text
ADMIN
```

## Create Package

```http
POST /api/v1/admin/packages
```

Request:

```json
{
  "name": "Hajj Premium 2027",
  "type": "HAJJ",
  "description": "Premium Hajj package",
  "departureDate": "2027-05-20",
  "returnDate": "2027-06-05",
  "bookingStart": "2026-09-01T00:00:00Z",
  "bookingEnd": "2027-04-15T23:59:59Z"
}
```

---

## Update Package

```http
PATCH /api/v1/admin/packages/:id
```

---

## Soft Delete Package

```http
DELETE /api/v1/admin/packages/:id
```

This must perform soft deletion.

---

# 6. Package Tier APIs

## Create Tier

```http
POST /api/v1/admin/packages/:packageId/tiers
```

Request:

```json
{
  "name": "Standard",
  "price": 550000,
  "currency": "BDT",
  "totalQuota": 100
}
```

---

## Update Tier

```http
PATCH /api/v1/admin/tiers/:id
```

Do not allow arbitrary modification of historical booking prices.

Changing tier price only affects future bookings.

---

## Adjust Quota

```http
PATCH /api/v1/admin/tiers/:id/quota
```

Request:

```json
{
  "totalQuota": 120
}
```

Validation:

```text
new quota >= held seats + confirmed seats
```

The action must be audited.

---

# 7. Booking APIs

## Create Booking

```http
POST /api/v1/bookings
```

Authenticated USER.

Request:

```json
{
  "packageId": "uuid",
  "packageTierId": "uuid",
  "paymentPlan": "INSTALLMENT",
  "pilgrims": [
    {
      "fullName": "Rahim Ahmed",
      "dateOfBirth": "1995-01-01",
      "gender": "MALE",
      "nationality": "Bangladeshi",
      "passportNumber": "A1234567",
      "passportIssueDate": "2024-01-01",
      "passportExpiryDate": "2029-01-01",
      "phone": "01700000000",
      "email": "rahim@example.com"
    }
  ]
}
```

The backend must:

1. Validate user.
2. Validate package.
3. Validate tier.
4. Validate booking window.
5. Validate pilgrims.
6. Start DB transaction.
7. Lock tier.
8. Check seats.
9. Reserve seats.
10. Capture current price.
11. Create booking.
12. Create pilgrims.
13. Generate installment schedule if required.
14. Create audit log.
15. Commit.

---

## Create Booking — Idempotency

Support:

```http
Idempotency-Key: unique-client-generated-key
```

Recommended for booking creation.

A retry with the same key must not create another booking.

---

# 8. Get User Bookings

```http
GET /api/v1/bookings
```

Authenticated.

The backend must automatically filter by:

```text
booking.user_id = currentUser.id
```

Query:

```text
status
page
limit
sort
```

---

# 9. Get Booking

```http
GET /api/v1/bookings/:id
```

USER:

Only own booking.

ADMIN:

Any booking.

---

# 10. Update Booking

```http
PATCH /api/v1/bookings/:id
```

Only permitted fields should be editable.

Do not allow users to arbitrarily modify:

```text
price
amount_received
payment status
booking status
seat count
refund amount
```

---

# 11. Pilgrim APIs

## Add Pilgrim

```http
POST /api/v1/bookings/:bookingId/pilgrims
```

Must verify booking ownership.

Adding a pilgrim may require seat availability and therefore must use the same concurrency protection as initial booking creation.

---

## List Pilgrims

```http
GET /api/v1/bookings/:bookingId/pilgrims
```

---

## Update Pilgrim

```http
PATCH /api/v1/bookings/:bookingId/pilgrims/:pilgrimId
```

---

## Cancel Pilgrim

```http
POST /api/v1/bookings/:bookingId/pilgrims/:pilgrimId/cancel
```

This initiates partial cancellation.

---

# 12. Installment APIs

## Get Installments

```http
GET /api/v1/bookings/:bookingId/installments
```

---

## Get Installment

```http
GET /api/v1/installments/:id
```

The backend must verify ownership.

---

# 13. Payment APIs

## Initiate Payment

```http
POST /api/v1/payments
```

Request:

```json
{
  "bookingId": "uuid",
  "amount": 200000,
  "method": "BKASH"
}
```

Backend validates:

* User owns booking.
* Booking is payable.
* Amount is valid.
* Payment method is supported.
* Amount does not exceed permitted amount unless overpayment is intentionally supported.

---

# 14. Get Payments

```http
GET /api/v1/payments
```

USER sees only own payments.

---

## Get Payment

```http
GET /api/v1/payments/:id
```

Authorization required.

---

# 15. Mock Payment Gateway

For assessment purposes, real credentials may not be available.

A mock gateway can expose:

```http
POST /api/v1/mock-payments/:paymentId/success
POST /api/v1/mock-payments/:paymentId/fail
```

These endpoints should simulate gateway behavior.

The actual business logic should still be processed through the same payment service used by real gateways.

---

# 16. Gateway Webhooks

## bKash

```http
POST /api/v1/webhooks/bkash
```

## Nagad

```http
POST /api/v1/webhooks/nagad
```

## VISA

```http
POST /api/v1/webhooks/visa
```

Webhook authentication/signature verification must be implemented where supported.

---

# 17. Webhook Processing

Webhook flow:

```text
Gateway
   ↓
Webhook endpoint
   ↓
Validate signature
   ↓
Check event/transaction idempotency
   ↓
Store webhook event
   ↓
Validate payment state transition
   ↓
Process payment
   ↓
Allocate payment
   ↓
Update booking
   ↓
Mark webhook processed
```

Duplicate event:

```text
return successful response
without duplicating financial state
```

---

# 18. Manual Payment APIs

## Create Manual Payment

```http
POST /api/v1/admin/manual-payments
```

Request:

```json
{
  "bookingId": "uuid",
  "amount": 100000,
  "reference": "BRANCH-2026-00123",
  "notes": "Cash payment at branch"
}
```

Status:

```text
PENDING_APPROVAL
```

---

## Approve Manual Payment

```http
POST /api/v1/admin/manual-payments/:id/approve
```

The approver must be different from the creator.

---

## Reject Manual Payment

```http
POST /api/v1/admin/manual-payments/:id/reject
```

All actions must be audited.

---

# 19. Reconciliation APIs

## List Reconciliation Records

```http
GET /api/v1/admin/reconciliation
```

Filters:

```text
status
gateway
date_from
date_to
transaction_id
page
limit
```

---

## Import Settlement

```http
POST /api/v1/admin/reconciliation/import
```

Possible input:

```text
CSV
```

Example:

```text
gateway_transaction_id,amount,settlement_date
ABC123,100000,2026-09-20
ABC124,95000,2026-09-20
```

---

## Resolve Mismatch

```http
POST /api/v1/admin/reconciliation/:id/resolve
```

Request:

```json
{
  "resolution": "Gateway settlement confirmed after review",
  "status": "RESOLVED"
}
```

Must create an audit log.

---

# 20. Cancellation APIs

## Request Cancellation

```http
POST /api/v1/bookings/:bookingId/cancellation-request
```

Request:

```json
{
  "reason": "Personal reasons"
}
```

For partial cancellation:

```http
POST /api/v1/bookings/:bookingId/pilgrims/:pilgrimId/cancel
```

---

# 21. Admin Cancellation APIs

## List

```http
GET /api/v1/admin/cancellations
```

## Details

```http
GET /api/v1/admin/cancellations/:id
```

## Approve

```http
POST /api/v1/admin/cancellations/:id/approve
```

## Reject

```http
POST /api/v1/admin/cancellations/:id/reject
```

---

# 22. Refund APIs

## List Booking Refunds

```http
GET /api/v1/bookings/:bookingId/refunds
```

---

## Admin Refund List

```http
GET /api/v1/admin/refunds
```

---

## Approve Refund

```http
POST /api/v1/admin/refunds/:id/approve
```

---

## Process Refund

```http
POST /api/v1/admin/refunds/:id/process
```

Before processing:

```text
total refunded + requested refund <= total received
```

must be verified.

---

# 23. Vendor APIs

## Create Vendor

```http
POST /api/v1/admin/vendors
```

## List Vendors

```http
GET /api/v1/admin/vendors
```

## Get Vendor

```http
GET /api/v1/admin/vendors/:id
```

## Update Vendor

```http
PATCH /api/v1/admin/vendors/:id
```

## Soft Delete Vendor

```http
DELETE /api/v1/admin/vendors/:id
```

---

# 24. Vendor Expense APIs

## Create Expense

```http
POST /api/v1/admin/vendor-expenses
```

Request:

```json
{
  "vendorId": "uuid",
  "bookingId": "uuid",
  "expenseType": "HOTEL",
  "amount": 1000,
  "currency": "SAR",
  "exchangeRate": 32,
  "expenseDate": "2026-09-20",
  "notes": "Hotel advance"
}
```

Backend calculates/stores:

```text
amount_bdt = amount * exchange_rate
```

---

## List Expenses

```http
GET /api/v1/admin/vendor-expenses
```

Filters:

```text
vendor
booking
package
expense_type
currency
date_from
date_to
page
limit
```

---

# 25. Inventory APIs

## Create Inventory Item

```http
POST /api/v1/admin/inventory/items
```

---

## List Inventory

```http
GET /api/v1/admin/inventory/items
```

---

## Get Inventory Item

```http
GET /api/v1/admin/inventory/items/:id
```

---

## Update Inventory Item

```http
PATCH /api/v1/admin/inventory/items/:id
```

---

## Create Inventory Transaction

```http
POST /api/v1/admin/inventory/transactions
```

Request:

```json
{
  "inventoryItemId": "uuid",
  "type": "ISSUE",
  "quantity": 1,
  "bookingId": "uuid",
  "pilgrimId": "uuid",
  "notes": "Issued ihram set"
}
```

---

# 26. Reporting APIs

All admin-only.

## Overview

```http
GET /api/v1/admin/reports/overview
```

Response:

```json
{
  "success": true,
  "data": {
    "totalBookings": 12000,
    "confirmedBookings": 10000,
    "totalCollected": 45000000,
    "totalOutstanding": 8000000,
    "totalRefunded": 1200000,
    "availableSeats": 320,
    "heldSeats": 40,
    "confirmedSeats": 1640,
    "overdueInstallments": 120
  }
}
```

---

## Booking Report

```http
GET /api/v1/admin/reports/bookings
```

Filters:

```text
package
tier
status
date_from
date_to
page
limit
```

---

## Payment Report

```http
GET /api/v1/admin/reports/payments
```

Filters:

```text
method
status
date_from
date_to
page
limit
```

---

## Installment Report

```http
GET /api/v1/admin/reports/installments
```

Filters:

```text
status
due_date_from
due_date_to
package
page
limit
```

---

## Refund Report

```http
GET /api/v1/admin/reports/refunds
```

---

## Seat Quota Report

```http
GET /api/v1/admin/reports/seat-quota
```

Response should provide:

```text
package
tier
total quota
held
confirmed
available
```

---

# 27. Audit APIs

## List Audit Logs

```http
GET /api/v1/admin/audit-logs
```

Filters:

```text
actor
action
entity_type
entity_id
date_from
date_to
page
limit
```

---

## Get Audit Log

```http
GET /api/v1/admin/audit-logs/:id
```

---

# 28. Authorization Matrix

| Endpoint Group          |        USER |    ADMIN |
| ----------------------- | ----------: | -------: |
| Public Packages         |           ✅ |        ✅ |
| Own Bookings            |           ✅ |        ✅ |
| Other User Bookings     |           ❌ |        ✅ |
| Own Payments            |           ✅ |        ✅ |
| All Payments            |           ❌ |        ✅ |
| Create Booking          |           ✅ | Optional |
| Package Management      |           ❌ |        ✅ |
| Tier Management         |           ❌ |        ✅ |
| Quota Adjustment        |           ❌ |        ✅ |
| Manual Payment Creation |           ❌ |        ✅ |
| Manual Payment Approval |           ❌ |        ✅ |
| Reconciliation          |           ❌ |        ✅ |
| Cancellation Request    |           ✅ |        ✅ |
| Cancellation Approval   |           ❌ |        ✅ |
| Refund Request          | User action |        ✅ |
| Refund Approval         |           ❌ |        ✅ |
| Vendor Management       |           ❌ |        ✅ |
| Inventory Management    |           ❌ |        ✅ |
| Reports                 |           ❌ |        ✅ |
| Audit Logs              |           ❌ |        ✅ |

---

# 29. Important Authorization Rule

Never rely only on route-level role checks.

For user-owned resources:

```text
GET /bookings/:id
```

must verify:

```text
booking.user_id === currentUser.id
```

This prevents IDOR vulnerabilities.

---

# 30. State Transition Rules

## Booking

Allowed examples:

```text
PENDING_PAYMENT → PARTIALLY_PAID
PENDING_PAYMENT → CONFIRMED
PENDING_PAYMENT → EXPIRED

PARTIALLY_PAID → CONFIRMED
PARTIALLY_PAID → DEFAULTED

CONFIRMED → CANCELLED
CONFIRMED → COMPLETED
```

Invalid transitions must be rejected.

---

# 31. Payment State Transitions

Example:

```text
PENDING
   ↓
PROCESSING
   ↓
SUCCESS
```

or:

```text
PENDING
   ↓
FAILED
```

Once:

```text
SUCCESS
```

a stale webhook must not change it back to:

```text
PENDING
```

---

# 32. Refund State Transitions

```text
REQUESTED
   ↓
APPROVED
   ↓
PROCESSING
   ↓
COMPLETED
```

Rejected:

```text
REQUESTED → REJECTED
```

Failed processing:

```text
PROCESSING → FAILED
```

---

# 33. Idempotency Rules

The following operations should support idempotency:

```text
Booking creation
Payment creation
Refund processing
Webhook processing
```

Use:

```http
Idempotency-Key
```

where appropriate.

Gateway webhook idempotency must additionally use:

```text
event_id
gateway_transaction_id
```

---

# 34. HTTP Status Codes

Use appropriate status codes.

```text
200 OK
201 Created
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
```

Examples:

No seat:

```text
409 CONFLICT
```

Unauthorized:

```text
401
```

Authenticated but not allowed:

```text
403
```

Validation failure:

```text
422
```

---

# 35. Common Error Codes

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND

BOOKING_WINDOW_CLOSED
INSUFFICIENT_SEATS
BOOKING_EXPIRED
INVALID_BOOKING_STATE

PAYMENT_NOT_FOUND
PAYMENT_ALREADY_PROCESSED
INVALID_PAYMENT_STATE
PAYMENT_VERIFICATION_FAILED

DUPLICATE_WEBHOOK
INVALID_WEBHOOK
WEBHOOK_PROCESSING_FAILED

INSTALLMENT_NOT_FOUND
INSTALLMENT_OVERDUE

CANCELLATION_NOT_ALLOWED
REFUND_LIMIT_EXCEEDED
INVALID_REFUND_STATE

QUOTA_BELOW_COMMITTED_SEATS

RECONCILIATION_MISMATCH
INVALID_RECONCILIATION_STATE
```

---

# 36. API Security Rules

Every protected endpoint must:

1. Authenticate the user.
2. Validate the user's role.
3. Validate resource ownership where necessary.
4. Validate request body.
5. Validate query parameters.
6. Validate state transitions.
7. Never trust client-calculated financial values.

---

# 37. Financial Security Rules

The client must NOT be allowed to determine:

```text
total_amount
amount_received
amount_outstanding
refund_amount
cancellation_charge
payment_status
```

The server calculates these values.

Frontend values are treated as input only where appropriate.

---

# 38. Booking Security

The frontend may send:

```text
packageId
packageTierId
pilgrims
paymentPlan
```

The backend determines:

```text
current tier price
seat availability
total amount
booking status
hold expiration
installment schedule
```

---

# 39. Payment Security

The frontend must never be trusted to declare:

```text
payment = SUCCESS
```

The backend determines payment success using:

```text
server-side gateway verification
and/or
trusted gateway webhook
```

---

# 40. Pagination

Default:

```text
page = 1
limit = 20
```

Maximum:

```text
limit = 100
```

Never allow an API request to return millions of records.

---

# 41. Sorting

Only allow whitelisted fields.

Example:

```text
created_at
departure_date
amount
due_date
```

Do not directly interpolate arbitrary client-provided column names into SQL.

---

# 42. Filtering

Use typed DTOs.

Example:

```http
GET /admin/bookings?
status=CONFIRMED
&packageId=uuid
&page=1
&limit=20
```

---

# 43. Background Jobs

Background jobs are supporting functionality rather than a requirement for every operation.

Recommended jobs:

```text
expire-seat-holds
process-overdue-installments
send-installment-reminders
send-notifications
generate-heavy-reports
```

These can initially be implemented using a scheduler/cron mechanism.

RabbitMQ can be introduced when asynchronous processing needs to scale independently.

---

# 44. RabbitMQ Integration

If RabbitMQ is implemented:

```text
NestJS API
   ↓
RabbitMQ
   ↓
Workers
```

Suitable messages:

```text
payment.webhook.received
booking.hold.expired
installment.reminder.due
installment.overdue
report.generate
notification.send
```

Do NOT put the core seat reservation transaction into an asynchronous queue.

Seat allocation must remain synchronous and transactional.

---

# 45. Redis Integration

Use Redis for:

```text
Package cache
Dashboard cache
Rate limiting
Short-lived data
Session support if needed
```

Do NOT use Redis as the source of truth for:

```text
seat count
payment status
booking status
refund amount
financial balance
```

---

# 46. API Documentation

Use Swagger/OpenAPI for the backend.

Recommended:

```text
/api/docs
```

Document:

* Authentication
* Request DTOs
* Response DTOs
* Error responses
* Authorization
* Query parameters
* Webhooks

---

# 47. Frontend API Mapping


## Public

```text
GET /packages
GET /packages/:id
```

## User

```text
POST /bookings
GET /bookings
GET /bookings/:id
GET /bookings/:id/pilgrims
GET /bookings/:id/installments
GET /payments
POST /payments
POST /bookings/:id/cancellation-request
```

## Admin

```text
GET /admin/dashboard
CRUD /admin/packages
CRUD /admin/tiers
GET /admin/bookings
GET /admin/payments
GET /admin/installments
GET /admin/refunds
GET /admin/reconciliation
GET /admin/reports
GET /admin/audit-logs
CRUD /admin/vendors
CRUD /admin/inventory
```

---

# 48. AI Implementation Rules

When implementing an API:

1. Check `PROJECT_CONTEXT.md`.
2. Check `DATABASE_SCHEMA.md`.
3. Follow this API specification.
4. Do not invent a conflicting business rule.
5. Use DTO validation.
6. Use authentication guards.
7. Use role guards.
8. Use ownership checks.
9. Use transactions for financial operations.
10. Add audit logging to state-changing operations.
11. Add tests for critical business rules.
12. Do not trust client-side calculations.
13. Do not expose sensitive fields.
14. Keep controllers thin.
15. Keep business logic inside services.
16. Return consistent error responses.
17. Do not silently swallow payment/reconciliation errors.
18. Preserve idempotency.

---

# 49. API Implementation Priority

Implement APIs in this order:

```text
1. Authentication
2. Packages
3. Package tiers
4. Booking
5. Pilgrims
6. Installments
7. Payments
8. Webhooks
9. Cancellation
10. Refund
11. Admin dashboard
12. Reports
13. Reconciliation
14. Vendors
15. Inventory
16. Audit
```

---

# 50. Critical End-to-End API Flow

```text
POST /auth/register
        ↓
POST /auth/login
        ↓
GET /packages
        ↓
GET /packages/:id
        ↓
POST /bookings
        ↓
POST /payments
        ↓
POST /webhooks/bkash
        ↓
GET /bookings/:id
        ↓
GET /bookings/:id/installments
```

Admin:

```text
POST /admin/packages
        ↓
POST /admin/packages/:id/tiers
        ↓
GET /admin/bookings
        ↓
GET /admin/payments
        ↓
GET /admin/reconciliation
        ↓
GET /admin/reports/overview
        ↓
GET /admin/audit-logs
```
