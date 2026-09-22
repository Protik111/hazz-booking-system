# Gap Analysis — Assessment vs. Implementation

Date: 2026-09-22
Scope: comparison of the assessment brief requirements against what is
actually committed under `backend/`, `frontend/`, `docs/` and the project
root.

Legend for severity:

- **P0 — must ship.** The brief explicitly demands this and reviewers will mark
  the submission down if it is missing.
- **P1 — should ship.** Either the spec docs demand it or it is needed for the
  brief to make sense.
- **P2 — nice to have.** Optional in the brief or only matters if you choose to
  demo a particular scaling path.

---

## 1. Verdict at a glance

The implementation is **functionally close to complete**. The core domain —
auth, packages, tiers, bookings with seat concurrency, pilgrims, installments,
payments, webhooks, cancellations, refunds, reconciliation, vendors, inventory,
reports, audit, scheduler — is all in place under `backend/src/` and the
corresponding pages exist under `frontend/app/`. The transactional seat
reservation uses `SELECT ... FOR UPDATE` (`pessimistic_write`), webhook
idempotency is wired through `payment_webhook_events.event_id`, and ownership
checks are enforced.

What is **missing or weak** is almost entirely on the **Part 2 — System Design
Deliverables** side of the brief, plus a couple of polish items in the README.
Those are exactly the things the reviewer will skim first after running the
app, so they carry outsized weight.

| Area                                        | Status      | Severity |
| ------------------------------------------- | ----------- | -------- |
| High-Level System Diagram (Part 2)          | missing     | **P0**   |
| Database ERD (Part 2)                       | missing     | **P0**   |
| README answers to 3 design questions        | missing     | **P0**   |
| Assumptions & trade-offs section in README  | missing     | P1       |
| Setup prerequisites (Node version, ports)   | partial     | P1       |
| Sample `.env.example` files                 | not checked | P1       |
| Postman / curl collection                  | missing     | P2       |
| Mermaid diagram source vs. PNG              | both fine   | —        |
| Seeded demo data summary                    | present     | done     |

---

## 2. Part 1 — Application Requirements

### 2.1 Pilgrim interface

> Browse packages and submit a booking through a form, choosing full payment
> or an installment plan.

| Item                                                              | Where it lives                                                                                                         | Status |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| Public package list + details                                     | `frontend/app/packages/page.tsx`, `frontend/app/packages/[id]/page.tsx`, `GET /packages`                              | done   |
| Booking form (full vs. installment)                               | `frontend/app/dashboard/bookings/new/page.tsx`, `POST /bookings`                                                       | done   |
| Multi-pilgrim passport capture                                    | `frontend/app/dashboard/bookings/new/page.tsx`, `POST /bookings/:id/pilgrims`                                         | done   |
| My bookings list + detail                                         | `frontend/app/dashboard/bookings/page.tsx`, `frontend/app/dashboard/bookings/[id]/page.tsx`                           | done   |
| Initiate payment (bKash / Nagad / VISA)                           | `frontend/app/dashboard/payments/new/page.tsx`, `POST /payments`                                                       | done   |
| Mock-payment success/fail page                                    | `frontend/app/dashboard/mock-payment/[paymentId]/page.tsx`                                                            | done   |

### 2.2 Data validation & sanitization

DTO validation in NestJS (`class-validator`) is present throughout
(`backend/src/*/dto/*.ts`). `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true,
transform: true })` is wired in `main.ts`. `helmet`, `compression`, CORS with an
allowlist, rate limiting and CSRF where appropriate are present.

No gaps detected here.

### 2.3 Security

| Requirement                                            | Where                                                                            | Status |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | ------ |
| Authentication (register/login/logout/me)              | `backend/src/auth/*`, `frontend/app/login`, `frontend/app/register`               | done   |
| Role-based access (USER, ADMIN)                        | `JwtAuthGuard`, `RolesGuard` in `backend/src/common`                              | done   |
| Users only see their own bookings                      | ownership check inside `BookingsService.findOne`                                  | done   |
| Admin dashboard only for admins                        | role guard on `/admin/**` pages and `/admin/**` endpoints                         | done   |
| Auditable state-changing actions                       | `AuditService.log()` called from booking, payment, cancellation, refund, etc.     | done   |

### 2.4 Reporting

`backend/src/report/*` and `frontend/app/admin/reports/page.tsx` implement
the overview dashboard plus the bookings/payments/installments/refunds/seat-quota
reports described in the brief.

### 2.5 Documentation

This is where the gap is largest. See section 4 below.

---

## 3. Part 2 — System Design Deliverables

### 3.1 High-Level System Diagram — **MISSING (P0)**

The brief says explicitly:

> High-Level System Diagram representing an optimal solution at the scale
> described above.

Nothing of the sort exists in the repo today. **Action:** add a Mermaid
high-level architecture diagram in `docs/ARCHITECTURE.md` (see that file for
content). Mermaid is chosen because it renders inline on GitHub, is plain text
(no binary diffs), and the reviewer does not need any tool installed.

### 3.2 Database ERD — **MISSING (P0)**

The brief says:

> Database Entity-Relationship Diagram (ERD) illustrating the database
> structure.

No ERD existed in the repo at the time this gap analysis was written.
**Action taken:** `docs/ERD.md` was added with a Mermaid `erDiagram` covering
every entity in `backend/src/<module>/entities/*.entity.ts` (users, packages,
package_tiers, bookings, pilgrims, installments, payments, payment_allocations,
payment_webhook_events, reconciliation_records, cancellation_requests,
refunds, vendors, vendor_expenses, inventory_items, inventory_transactions,
audit_logs, booking_status_history). A high-resolution PlantUML rendering
(`docs/ERD.puml` → `docs/erd.png`/`docs/erd.svg`) was also added.

### 3.3 README design Q&A — **MISSING (P0)**

The brief explicitly says the README must answer:

1. How do you prevent overselling a seat under concurrent bookings?
2. How do you handle a duplicate or out-of-order payment webhook?
3. How would you keep reporting fast at 5 million users?

None of these are in `README.md`. **Action:** add a "Design answers"
section near the bottom of `README.md` with short (3–6 line) answers for
each, and link to `docs/ARCHITECTURE.md` for the full explanation.

---

## 4. Documentation gaps

| Item                                                         | Status | Severity | Notes |
| ------------------------------------------------------------ | ------ | -------- | ----- |
| Setup prerequisites (Node 20+, Docker, ports)                | partial | P1      | Mention in `README.md` only mentions Docker and `npm install`; no explicit Node version or which ports must be free. |
| Sample `.env.example` for backend and frontend               | check  | P1      | `backend/.env.docker` exists but there is no `.env.example` checked into git to show reviewers what to set if they run without Docker. |
| Assumptions and trade-offs                                   | missing | P1      | No prior business-rules brief survives in the repo. Add a short "Assumptions & trade-offs" block in `README.md`. |
| Postman / curl collection                                   | missing | P2      | Helpful but not required. Optional deliverable. |
| "How to run individual modules" walkthrough                  | missing | P2      | The `MANUAL_TESTING_GUIDE.md` already exists for this; verify it is referenced from README. |

---

## 5. Functional / business-rule spot-checks

These were verified by reading the code, not by running it. Each row is a
specific assertion the reviewer is likely to make.

| Rule from the brief                                                                       | Where to confirm                                              | Status |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| Quota cannot go below committed seats                                                     | `PATCH /admin/tiers/:id/quota` in `tiers.service.ts`          | done   |
| Price is frozen once booking is confirmed                                                 | `unit_price` copied at booking creation                       | done   |
| Seats held on booking, released after payment window                                       | `hold_expires_at` + `expire-seat-holds` cron                  | done   |
| Soft delete only on financial records                                                     | `deleted_at` columns + reports still query them               | done   |
| Installment schedule fixed at creation, oldest unpaid first, overpayment carries forward | `InstallmentsService.allocate`                                | done   |
| Overdue installments trigger reminders, then default after grace                          | `scheduler.service.ts`                                        | done   |
| Gateway webhooks: idempotent, late, duplicated, out-of-order                              | `payment_webhook_events.event_id` UNIQUE + state transitions  | done   |
| Payment confirmation verified server-side, not from redirect                               | Webhook flow + `Payment.status` only set by webhook handler   | done   |
| Manual branch payments recorded + approved by different users                              | `creator_id` vs `approver_id` check in `manual-payments` flow | done   |
| Settlement mismatches tracked, never silently auto-corrected                               | `reconciliation_records.status = MISMATCH → RESOLVED`         | done   |
| Cancellation charge = f(days remaining, vendor costs)                                     | `cancellation.service.ts`                                     | done   |
| Refunds ≤ amount received                                                                 | invariant in `refunds.service.ts`                             | done   |
| Partial cancellation supported                                                            | `POST /bookings/:id/pilgrims/:pilgrimId/cancel`               | done   |
| Vendor expenses keep original currency + FX rate (SAR → BDT)                              | `vendor_expenses` row stores both                             | done   |
| Inventory purchase / issue / return / adjustment                                           | `inventory_transactions.type` enum                             | done   |
| Audit logs on every state change                                                          | `AuditService.log()` called from mutating endpoints           | done   |

No rule from the brief was found to be obviously missing.

---

## 6. What to do next — prioritized checklist

### P0 (do before submitting)

1. **Add `docs/ARCHITECTURE.md`** with:
   - High-Level System Diagram (Mermaid).
   - "Do I need microservices?" answer (short, explicit NO with reasoning).
   - Full answers to the three README design questions.
   - Read-side scaling plan for 5M users.
2. **Add `docs/ERD.md`** with the Mermaid `erDiagram`.
3. **Add the "Design answers" section to `README.md`** (3–6 lines each).

### P1 (do during the next session)

4. Add an "Assumptions & trade-offs" block in `README.md`.
5. Confirm there is a `backend/.env.example` checked in; if not, create one.
6. Make sure the README has an explicit Node version (recommend **Node 20 LTS**
   because both NestJS 11 and Next.js 16 require ≥ 18.18, and 20 is the safe
   baseline).
7. Reference `MANUAL_TESTING_GUIDE.md` and `docs/ARCHITECTURE.md` from
   `README.md` so reviewers don't have to hunt for them.

### P2 (only if time)

8. Add a Postman collection under `docs/postman/` covering the critical
   end-to-end flow (register → login → browse → book → add pilgrims → pay →
   webhook → confirm).
9. Add a `docs/RUNBOOK.md` for the production-ish deploy path (Postgres
   read replica, Redis cache, scheduler worker).

---

## 7. Direct answer to your question

> In the context part it explicitly mentioned that it should support
> approximately 5 million users across package types. My question is do I need
> to introduce the microservice architecture? If not then how do I show them
> and make it?

**No, you do not need microservices for this brief.** The full reasoning lives
in `docs/ARCHITECTURE.md` §"Microservices — yes or no?", but the short version
is:

1. **5 million registered users ≠ 5 million concurrent users.** Even a healthy
   Hajj season for a mid-sized Bangladeshi operator is on the order of tens of
   thousands of concurrent pilgrims, with short bursts during Ramadan and the
   Hajj booking window. A single NestJS instance backed by PostgreSQL can
   comfortably handle that on commodity hardware if the schema and queries are
   correct.
2. **The most painful operations in this system are inherently transactional.**
   Seat reservation, payment confirmation, refund processing and reconciliation
   are *the* things that benefit from a single, strongly consistent database
   and a single deployable. Splitting them into services pushes you toward
   sagas, distributed transactions and eventual consistency at exactly the
   moments you can least afford inconsistency.
3. **The dominant scaling axis for a booking system is reads, not writes.**
   Browsing packages and loading dashboards is where the load lives; writes
   per booking are tiny and bursty. That is solved by:
   - PostgreSQL read replicas,
   - Redis cache for hot reads (package list, dashboard aggregates),
   - Pre-aggregated reporting tables refreshed by the scheduler,
   - CDN in front of Next.js (with ISR for public pages),
   - Horizontal scaling of stateless Next.js and NestJS pods behind a load
     balancer.
4. **You have already built the right shape.** The NestJS backend is a
   *modular monolith* — `auth`, `packages`, `bookings`, `payments`,
   `cancellation`, `refunds`, `reconciliation`, `vendors`, `inventory`,
   `report`, `audit`, `scheduler`. Each module is its own folder and could be
   lifted into a separate service later without rewriting business logic. That
   is exactly the path most teams take when they outgrow a monolith; you do
   not pay the microservices tax up front, and the seam is already drawn.

What the reviewer wants to see is **not** "I split it into 12 services",
it is "I can describe how this scales to 5M users, where the bottlenecks
will appear, and what I would do about them". `docs/ARCHITECTURE.md` answers
that explicitly with diagrams and the same three design questions the brief
asks for.