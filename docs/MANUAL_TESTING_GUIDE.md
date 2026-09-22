# Manual UI Testing Guide — Hajj & Umrah Booking System

A step-by-step walkthrough of the application's UI flows. Follow the sequence top-to-bottom.
Each section lists **what to do**, **what to expect**, and **what to verify** so nothing is
silently skipped.

---

## 0. Pre-flight (do once)

1. **Boot the stack**
   ```bash
   # from project root
   docker compose up -d --build
   ```
   Wait until `docker compose ps` shows all four services (`postgres`, `redis`, `backend`,
   `frontend`) as healthy.
2. **Seed accounts** (idempotent — safe to re-run)
   ```bash
   docker compose exec backend npm run seed:prod
   ```
   Expect:
   ```
   + Created Admin: admin@hajj.gov.bd (password: Admin123!)
   + Created Pilgrim User: pilgrim@example.com (password: User123!)
   ```
   > The `seed:prod` variant runs the compiled `dist/database/seeds/seed.js` and is what
   > the production `runner` stage can execute. The plain `npm run seed` (which uses
   > `ts-node`) is for local host or the dev Docker stage only.
3. **Open the app**: <http://localhost:3000>

### Test accounts

| Role    | Email                  | Password   | Lands on          |
|---------|------------------------|------------|-------------------|
| Pilgrim | `pilgrim@example.com`  | `User123!` | `/dashboard`      |
| Admin   | `admin@hajj.gov.bd`    | `Admin123!`| `/admin`          |

> Use **two browser profiles** (or two browsers) — sign in as the Pilgrim in one, the Admin
> in the other — so you can validate the end-to-end flow without logging in/out constantly.

---

## 1. Public site (no auth)

### 1.1 Landing page
- **URL**: `/`
- **Action**: Visit <http://localhost:3000> while logged out.
- **Verify**:
  - Hero section renders with package branding.
  - "Sign in" / "Register" CTAs visible.
  - "Browse packages" link works.

### 1.2 Public package listing
- **URL**: `/packages`
- **Action**: Click *Browse Packages*.
- **Verify**:
  - At least one package is listed (the seeder should produce a few).
  - Type chip (HAJJ / RAMADAN_UMRAH / OFF_SEASON_UMRAH / ZIYARAH) shows.
  - Departure/return dates and starting price display.
  - Clicking a card opens the package detail page.

### 1.3 Public package detail
- **URL**: `/packages/[id]`
- **Action**: Click any package card.
- **Verify**:
  - Package summary, dates, and pricing tiers show.
  - "Book now" / "Sign in to book" CTA visible (logged-out users should be prompted to log in).

### 1.4 Registration
- **URL**: `/register`
- **Action**: Click *Register* → fill in name, email, password.
- **Verify**:
  - Form rejects weak passwords and duplicate emails with an inline message.
  - On success, you are redirected to `/dashboard` (or to login depending on flow).
  - The new account can sign in via `/login`.

### 1.5 Login (negative)
- **URL**: `/login`
- **Action**: Enter wrong credentials.
- **Verify**: Generic error message (does not leak whether the email exists).

---

## 2. Pilgrim flow (`pilgrim@example.com` / `User123!`)

### 2.1 Sign in
- **URL**: `/login`
- **Action**: Sign in as the pilgrim.
- **Verify**: Redirects to `/dashboard`. Top nav now shows `Dashboard`, `Packages`,
  `Bookings`, `Payments`, and a Sign out button. No admin nav.

### 2.2 Dashboard landing
- **URL**: `/dashboard`
- **Verify**: Greeting, summary cards (bookings count, outstanding due, etc.), and a
  recent-activity block.

### 2.3 Browse packages
- **URL**: `/packages`
- **Verify**: Same listing as logged-out view (no difference expected). Each package
  card now offers a "Book" CTA.

### 2.4 Package detail & tier selection
- **URL**: `/packages/[id]`
- **Action**: Pick a package; select a tier (Economy / Standard / VIP).
- **Verify**:
  - Tier seats remaining shows correctly.
  - If a tier is sold out, the "Book" CTA is disabled / shows "Sold out".
  - "Book this tier" goes to the booking wizard.

### 2.5 Create a booking — happy path (FULL payment)
- **URL**: `/dashboard/bookings/new` (or the wizard launched from the package detail).
- **Action**:
  1. **Step 1 — Tier**: Confirm the tier.
  2. **Step 2 — Plan**: Pick `FULL_PAYMENT`.
  3. **Step 3 — Pilgrims**: Add 1+ pilgrims with full passport info
     (full name, DOB, gender, nationality, passport number).
  4. **Step 4 — Review**: Confirm total.
  5. Submit.
- **Verify**:
  - Redirects to a booking detail page (e.g. `/dashboard/bookings/[id]`).
  - Booking status starts as `PENDING` / `HELD` with seats reserved.
  - Outstanding amount equals the tier price × number of pilgrims.

### 2.6 Booking with INSTALLMENT plan
- **Action**: Repeat 2.5 but pick `INSTALLMENT` at Step 2.
- **Verify**:
  - Installment schedule is generated and visible on the booking detail page
    (down-payment + remaining installments).
  - Outstanding amount equals total; partially-paid installments show 0 received.

### 2.7 Multi-pilgrim booking
- **Action**: In Step 3, add 2–3 pilgrims.
- **Verify**:
  - Total = tier price × pilgrim count.
  - Each pilgrim appears in the booking's pilgrim list with their passport number.

### 2.8 Concurrency / sold-out edge case
- **Action**: In a second browser/tab (or have the Admin reduce the tier quota to 0),
  try to book a sold-out tier.
- **Verify**: Server rejects with a friendly "no seats" error — never oversells.

### 2.9 Booking detail — add/edit/cancel a pilgrim
- **URL**: `/dashboard/bookings/[id]`
- **Action**: Add, edit, and (if allowed) cancel an individual pilgrim.
- **Verify**:
  - Adding a pilgrim re-prices the booking if tier rules require it.
  - Edit reflects immediately.
  - Per-pilgrim cancel decreases the outstanding amount proportionally where allowed.

### 2.10 Make a payment (gateway: bKash)
- **URL**: `/dashboard/payments/new`
- **Action**:
  1. Pick the unpaid booking.
  2. Enter an amount (auto-filled to the outstanding balance — leave it).
  3. Pick `bKash`, submit.
- **Verify**:
  - You land on `/dashboard/mock-payment/[paymentId]` (this is the **mock gateway**).
  - The mock page has "Pay" / "Cancel" actions.
- **Action**: Click **Pay**.
- **Verify**:
  - Webhook fires server-side; payment status flips to `PAID` (or `PROCESSING` → `PAID`).
  - You return to the booking detail; outstanding decreased by the paid amount.
  - For FULL payment, booking now shows `CONFIRMED` and price is frozen.

### 2.11 Payment via Nagad / Visa
- Repeat 2.10 with `Nagad` then `Visa`.
- **Verify**: Same behaviour; each gateway produces a successful payment entry.

### 2.12 Payment via Manual branch deposit
- **Action**: Pick `MANUAL_BRANCH`, submit.
- **Verify**:
  - Payment is created in `AWAITING_ADMIN_APPROVAL` state.
  - Booking is **not** confirmed until admin approves (do this in §3.4).
  - No redirect to mock-payment page.

### 2.13 Pay an installment
- **URL**: `/dashboard/bookings/[id]` (installment installment schedule at the bottom).
- **Action**: Click a specific installment to pay.
- **Verify**:
  - Only that installment is marked paid; others remain unpaid.
  - Paid amount is allocated to the oldest unpaid installment first (per business rule).
  - Overpayment, if entered, carries forward as credit visible on the booking.

### 2.14 Idempotent retries
- **Action**: From the payment page, double-click submit / refresh during processing.
- **Verify**: No duplicate payments. Backend should enforce an idempotency key.

### 2.15 Webhook idempotency (admin side, see §3.6)
- **Verify** (after §3.6): the same gateway callback fired twice → only one payment created.

### 2.16 View payments list
- **URL**: `/dashboard/payments`
- **Verify**: All your payments listed with status, method, amount, and gateway txn id.

### 2.17 Request a cancellation
- **URL**: `/dashboard/bookings/[id]`
- **Action**: Click *Request cancellation*, provide a reason.
- **Verify**:
  - Cancellation shows status `REQUESTED`.
  - Booking status moves to `CANCELLATION_PENDING`.
  - See §3.7 for admin approval.

### 2.18 Sign out
- **URL**: top-right user menu → Sign out.
- **Verify**: Redirects to `/` or `/login`; protected routes redirect back when revisited.

---

## 3. Admin flow (`admin@hajj.gov.bd` / `Admin123!`)

> Run the admin steps in **parallel** with §2 to verify the Pilgrim's actions show up
> in the back-office.

### 3.1 Sign in & admin home
- **URL**: `/login` → use admin credentials.
- **Verify**: Redirects to `/admin`. Admin nav visible: **Packages, Bookings, Payments,
  Manual payments, Cancellations, Refunds, Reconciliation, Vendors, Inventory, Reports,
  Audit logs**.

### 3.2 Admin dashboard overview
- **URL**: `/admin`
- **Verify**: Summary widgets (bookings today, revenue, pending cancellations, etc.) match
  the pilgrim activity in §2.

### 3.3 Packages & tiers
- **URL**: `/admin/packages`
- **Actions**:
  - **Create**: `/admin/packages/new` — pick a type, set dates, add ≥1 tier with quota.
  - **Edit**: `/admin/packages/[id]` — change dates or description.
  - **Quota**: edit a tier's quota via `PATCH /admin/tiers/:id/quota` UI (or whatever the page exposes).
  - **Delete**: try to delete a package that has confirmed bookings.
- **Verify**:
  - Newly created packages appear on `/packages` for pilgrims.
  - Tier price changes **don't** change the price on existing confirmed bookings (price freeze).
  - Deleting a package with committed seats is either blocked or shows a warning.

### 3.4 Manual payment approval
- **URL**: `/admin/manual-payments`
- **Action**: Approve the manual payment created in §2.12.
- **Verify**:
  - Payment status flips to `PAID`.
  - Booking updates (outstanding decreases, schedule marks the installment accordingly).

### 3.4b — Reject a manual payment (positive test)
- **Action**: Create another `MANUAL_BRANCH` payment from the Pilgrim side, then **Reject**
  it as admin with a reason.
- **Verify**:
  - Payment status becomes `REJECTED`; no money applied; reason visible.

### 3.5 Bookings & seat inventory
- **URL**: `/admin/bookings`
- **Action**: Filter / open the pilgrim's booking from §2.5.
- **Verify**:
  - Listing shows all pilgrims, payment progress, and tier used.
  - Drill-down at `/admin/bookings/[id]` matches the pilgrim's view exactly.

### 3.6 Reconciliation (mock gateway)
- **URL**: `/admin/reconciliation`
- **Action**:
  - Import a settlement file (or click *Import* — whatever UI exists).
  - Resolve any `MISMATCH` rows.
- **Verify**:
  - `MATCHED` rows auto-pair with internal payments.
  - `MISMATCH` rows show the delta (gateway vs. internal) and can be annotated + resolved.
  - Resolving never silently edits a payment — only logs the disposition.

### 3.7 Cancellation approval
- **URL**: `/admin/cancellations`
- **Action**: Approve the cancellation requested in §2.17.
- **Verify**:
  - Cancellation moves through `APPROVED → PROCESSING → COMPLETED`.
  - A refund record is created (`/admin/refunds`).

### 3.8 Refund processing
- **URL**: `/admin/refunds`
- **Action**: Approve, then **Process** the refund.
- **Verify**:
  - Refund amount ≤ amount actually received (invariant).
  - Booking is closed/cancelled and seats released back to the tier.
  - Total refunded never exceeds total received.

### 3.9 Vendors & expenses
- **URL**: `/admin/vendors`
- **Action**: Create a vendor (HOTEL/AIRLINE/TRANSPORT/VISA/OTHER), then log an expense in
  a foreign currency (e.g. SAR 1000) with an exchange rate.
- **Verify**:
  - Expense shows both the original SAR and the converted BDT.
  - Changing the rate now does **not** retroactively change the historical expense row.

### 3.10 Inventory
- **URL**: `/admin/inventory`
- **Action**: Create an item (e.g. *Ihram*), then record `purchase`, `issue`, `return`,
  and `adjustment` transactions.
- **Verify**: Running stock = purchases − issues + returns ± adjustments. Tracks against
  booking reference when issued.

### 3.11 Reports
- **URL**: `/admin/reports`
- **Action**: Switch between the report tabs (overview / bookings / payments / installments /
  refunds / seat-quota).
- **Verify**:
  - Numbers tie to what's visible on the corresponding list pages.
  - Seat-quota report shows `held + confirmed ≤ quota` for every tier.

### 3.12 Audit logs
- **URL**: `/admin/audit-logs`
- **Action**: Filter by entity (e.g. `booking`) or by actor.
- **Verify**:
  - Every state-changing action above (booking create, payment received, quota change,
    cancellation approval, refund processed, manual payment approval, reconciliation
    resolution) has a corresponding log entry.
  - Open `/admin/audit-logs/[id]` and confirm old → new values are shown.

---

## 4. Cross-cutting checks

Run these once at the end to catch regressions.

### 4.1 Authorization / IDOR
- While logged in as **Pilgrim A**, attempt to fetch another pilgrim's booking via direct URL
  (`/dashboard/bookings/[someone-elses-id]`).
- **Verify**: 403/404; never leaks data.

### 4.2 Role escalation
- Logged in as **Pilgrim**, try to navigate to `/admin/*`.
- **Verify**: Redirected or shown a "forbidden" page. API calls to admin endpoints return 403.

### 4.3 Time invariants
- Set system/clock forward to after a booking's hold period (or wait), then re-check the booking.
- **Verify**: Hold expires, seats are released back to the tier, booking is `EXPIRED`.

### 4.4 Currency & formatting
- Money displays as BDT (৳) with consistent decimal places everywhere.
- Dates use a single locale consistently.

### 4.5 Mobile / responsive sanity
- Resize the window to ~375px wide.
- **Verify**: Tables reflow, forms are usable, primary actions remain reachable.

### 4.6 Error & empty states
- Filter `/admin/bookings` with no matches; `/dashboard/payments` when there are none.
- **Verify**: Empty-state messages, not blank pages or crashes.

---

## 5. Suggested test order (single session)

For the most efficient single-pass run, follow this order so each step's data is consumed by
the next:

1. Boot, seed, open the app (§0).
2. Pilgrim §2.1 → §2.6 (create the **first** booking with FULL payment).
3. Admin §3.5 — see the new booking appear.
4. Pilgrim §2.10 (pay via bKash) + §2.11 (Nagad) + §2.12 (Manual branch).
5. Admin §3.4 / §3.4b — approve / reject the manual payment.
6. Admin §3.6 reconciliation — import the day's settlements.
7. Pilgrim §2.13 — pay an installment on a second booking created with INSTALLMENT.
8. Pilgrim §2.17 — request a cancellation.
9. Admin §3.7 + §3.8 — approve cancellation, then approve + process refund.
10. Admin §3.3 — create a new package + tier (used in §2.8).
11. Admin §3.9, §3.10 — vendor + inventory side trip.
12. Admin §3.11, §3.12 — reports + audit logs reconcile against everything above.
13. Cross-cutting §4.1–§4.6.
14. Pilgrim §2.18 — sign out.

If anything regresses, you can reset state cleanly with:

```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend npm run seed:prod
```

---

## 6. Quick smoke (5-minute version)

If you only have a few minutes, hit the core happy path:

1. Pilgrim signs in → `/packages` → open a package → book FULL_PAYMENT for 1 pilgrim.
2. Pilgrim pays via **bKash** on the mock gateway → booking becomes `CONFIRMED`.
3. Admin signs in → `/admin/bookings` sees the new booking → `/admin/audit-logs` sees the
   create + pay events.

If those three work end-to-end, the foundational integration is healthy.
