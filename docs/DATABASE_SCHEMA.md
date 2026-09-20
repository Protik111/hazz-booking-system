# 10. Database Model

PostgreSQL is the source of truth. Use Prisma ORM.

## users
- id
- name
- email
- phone
- password_hash
- role: USER | ADMIN
- status
- created_at
- updated_at
- deleted_at

## packages
Represents a Hajj/Umrah package.

- id
- name
- slug
- type: HAJJ | RAMADAN_UMRAH | OFF_SEASON_UMRAH | ZIYARAH
- description
- departure_date
- return_date
- booking_start
- booking_end
- status
- created_at
- updated_at
- deleted_at

## package_tiers
A package can have multiple tiers.

- id
- package_id → packages
- name: ECONOMY | STANDARD | VIP
- price
- currency
- total_quota
- held_seats
- confirmed_seats
- status
- created_at
- updated_at
- deleted_at

Invariant:

held_seats + confirmed_seats <= total_quota

## bookings
A booking belongs to one user, package and tier.

- id
- booking_number
- user_id → users
- package_id → packages
- package_tier_id → package_tiers
- status
- payment_plan
- unit_price
- total_amount
- amount_received
- amount_outstanding
- hold_expires_at
- confirmed_at
- created_at
- updated_at
- deleted_at

Important:
unit_price is copied when booking is created/confirmed so historical
booking price does not change when package pricing changes.

## pilgrims
A booking can contain multiple pilgrims.

- id
- booking_id → bookings
- full_name
- date_of_birth
- gender
- nationality
- passport_number
- passport_issue_date
- passport_expiry_date
- passport_document_url
- phone
- email
- status
- created_at
- updated_at

## installments
Fixed payment schedule generated at booking creation.

- id
- booking_id → bookings
- installment_number
- amount
- paid_amount
- due_date
- status
- created_at
- updated_at

## payments
Records all payments.

- id
- booking_id → bookings
- user_id → users
- amount
- currency
- method: BKASH | NAGAD | VISA | MANUAL_BRANCH
- status
- gateway_transaction_id
- gateway_reference
- payment_date
- metadata
- created_at
- updated_at

## payment_allocations
Maps payments to installments.

- id
- payment_id → payments
- installment_id → installments
- amount
- created_at

Purpose:
A single payment may pay one or multiple installments, and payments
must be allocated oldest unpaid installment first.

## payment_webhook_events
Stores gateway webhook events for idempotency.

- id
- payment_id → payments
- gateway
- event_id
- gateway_transaction_id
- event_type
- payload
- status
- received_at
- processed_at
- error_message

event_id must be unique where provided.

## reconciliation_records
Compares internal payment records with gateway settlement records.

- id
- payment_id → payments
- gateway_transaction_id
- internal_amount
- gateway_amount
- difference
- status: MATCHED | MISMATCH | RESOLVED
- settlement_date
- resolved_by
- resolved_at
- resolution_notes
- created_at
- updated_at

## cancellation_requests

- id
- booking_id → bookings
- pilgrim_id → pilgrims (nullable)
- reason
- cancellation_charge
- vendor_cost
- refund_amount
- status
- requested_by
- approved_by
- approved_at
- created_at
- updated_at

pilgrim_id = NULL means whole booking cancellation.

## refunds

- id
- booking_id → bookings
- payment_id → payments
- amount
- method
- status
- requested_at
- approved_at
- processed_at
- approved_by
- processed_by
- created_at
- updated_at

Invariant:

total_refunded <= total_received

## vendors

- id
- name
- type: HOTEL | AIRLINE | TRANSPORT | VISA | OTHER
- contact information
- status
- created_at
- updated_at
- deleted_at

## vendor_expenses

Tracks vendor costs, including foreign currency expenses.

- id
- vendor_id → vendors
- booking_id → bookings (nullable)
- package_id → packages (nullable)
- expense_type
- amount
- currency
- exchange_rate
- amount_bdt
- expense_date
- status
- notes
- created_by
- created_at
- updated_at

Important:
Store the original currency, exchange rate and converted BDT amount.
Do not overwrite historical exchange rates.

## inventory_items

- id
- name
- sku
- unit
- quantity
- minimum_stock
- status
- created_at
- updated_at
- deleted_at

Examples:
- Ihram
- Bags
- SIM cards

## inventory_transactions

Tracks inventory movement.

- id
- inventory_item_id → inventory_items
- type: PURCHASE | ISSUE | RETURN | ADJUSTMENT
- quantity
- booking_id → bookings (nullable)
- pilgrim_id → pilgrims (nullable)
- created_by
- notes
- created_at

## audit_logs

Tracks important state-changing actions.

- id
- actor_id → users
- action
- entity_type
- entity_id
- old_value
- new_value
- ip_address
- user_agent
- created_at

## booking_status_history (optional)

- id
- booking_id → bookings
- from_status
- to_status
- changed_by
- reason
- created_at