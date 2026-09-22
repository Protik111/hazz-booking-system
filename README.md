# Hajj & Umrah Booking System

End-to-end booking platform for Hajj and Umrah packages: pilgrim-facing storefront,
payment gateway (mocked for assessment), admin back-office, vendor / inventory /
reconciliation tooling.

- **`backend/`** — NestJS 11 + TypeORM + PostgreSQL REST API.
- **`frontend/`** — Next.js 16 (App Router) + React 19 + Tailwind v4.

---

## Quick start with Docker

A single `docker compose up` boots the entire stack — postgres, redis, backend,
and frontend — in containers.

There are two stacks you can run:

- **`make dev`** — development stack with **hot reload** for both backend and
  frontend. Edits to source on the host are picked up live; no rebuild needed.
  This is what you want for everyday work.
- **`make prod`** — production stack: multi-stage images, compiled `dist/` and
  Next.js standalone server. Closest to what runs in production.

### Development workflow (recommended for coding)

```bash
# from the repo root
make dev          # foreground — streams logs from all services
make dev-build    # rebuild images after changing package.json / Dockerfile
make logs         # tail backend + frontend logs (in another terminal)
make dev-down     # stop the dev stack
```

If you don't have `make` installed, every target has a `./scripts/dev` equivalent:

```bash
./scripts/dev up           # same as `make dev`
./scripts/dev build        # same as `make dev-build`
./scripts/dev logs         # same as `make logs`
./scripts/dev down         # same as `make dev-down`
./scripts/dev help         # show all available subcommands
```

`make dev` is a thin wrapper around:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

The override file (`docker-compose.dev.yml`) layers the following on top of the
base stack:

- Builds the lightweight `dev` stage of `backend/Dockerfile` (all deps, no TS
  compile) and the `deps` stage of `frontend/Dockerfile` (already has everything
  Next.js needs) instead of the slow multi-stage production images.
- Bind-mounts your local source (`backend/src/`, `frontend/app/`, `components/`,
  `lib/`, `hooks/`, `contexts/`, `public/`) and the relevant config files into
  the running containers.
- Overrides the container `command` to `npm run start:dev` (backend) and
  `npm run dev` (frontend), so `nest start --watch` and `next dev` pick up your
  edits and reload automatically.
- Protects the container's `node_modules` (and the frontend's `.next/`) with
  anonymous volumes so a host bind-mount doesn't shadow them. **You don't need
  to run `npm install` on the host** — the container owns its own modules.

You only need to run `make dev-build` when **dependencies change** (i.e. you
edited `package.json` or a `Dockerfile`). Pure code edits never require a
rebuild.

#### Useful dev targets

```bash
make help              # show every available target
make logs              # tail backend + frontend logs together
make logs-backend      # tail backend only
make logs-frontend     # tail frontend only
make shell-backend     # open a shell in the backend container
make shell-frontend    # open a shell in the frontend container
make shell-postgres    # open psql against the dev database
make ps                # list running containers
make restart           # restart app containers without dropping the DB
make rebuild-deps      # nuke and rebuild images from scratch (no cache)
```

### Production stack (what `docker compose up` does by default)

If you don't use `make`, plain `docker compose up` runs the **production**
stack. Use this when you want to validate a release build locally.

```bash
# from the repo root
docker compose up -d --build    # or: make prod
```

Once everything is healthy (`docker compose ps`), the four URLs are:

| Service       | URL                            |
| ------------- | ------------------------------ |
| Frontend      | http://localhost:3000          |
| Backend API   | http://localhost:3001/api/v1   |
| PostgreSQL    | `localhost:5432`               |
| Redis         | `localhost:6379`               |

Open http://localhost:3000 to use the app. The backend listens on `:3001` and is
exposed to the host so the browser can hit it directly from `localhost:3001`.

To tear everything down (including the persisted database volume):

```bash
docker compose down -v
```

### How it works

- **`postgres` / `redis`** — health-checked dependencies, names match those referenced
  by the backend's env (`postgres`, `redis`).
- **`backend`** — built from `backend/Dockerfile` (3-stage). Env vars in
  `backend/.env.docker` are loaded via `env_file`. The DATABASE_URL and REDIS_URL
  override the env file to use the Docker service names. `NODE_ENV=development` is
  forced via the compose file so TypeORM doesn't require SSL on the local Postgres
  container (the backend's own `database.config.ts` enables SSL only in production).
- **`frontend`** — built from `frontend/Dockerfile` (3-stage, Next.js standalone). Env
  vars in `frontend/.env.docker` are inlined into the JS bundle at build time.
  `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1` is correct because the
  browser runs on the host (not inside the container network).

---

## Running without Docker

### Backend

```bash
cd backend
npm install
# Requires Postgres + Redis reachable; default DATABASE_URL points to localhost.
npm run start:dev   # watches + rebuilds on changes
```

### Frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1" > .env.local
npm run dev
```

---

## Project layout

```
.
├── backend/               # NestJS API
│   ├── src/               # modules: auth, packages, tiers, bookings, …
│   ├── docker-compose.yml # standalone API stack (postgres + redis + backend)
│   └── Dockerfile
├── frontend/              # Next.js app
│   ├── app/               # routes (App Router)
│   ├── components/        # shared UI primitives
│   ├── lib/api/           # API client + endpoint wrappers + snake→camel normalize
│   ├── contexts/          # AuthContext
│   ├── Dockerfile
│   └── .env.docker
├── docker-compose.yml     # full stack: postgres + redis + backend + frontend
├── docker-compose.dev.yml # dev override — bind mounts, hot reload (used by `make dev`)
├── Makefile               # convenience targets: `make dev`, `make prod`, `make logs`, …
└── scripts/
    └── dev                # drop-in shell-script equivalent of the Makefile (no `make` needed)
```
```

The complete API contract lives in `docs/API_SPEC.md`.

---

## Test credentials (seeded users)

The backend ships with a seeder that creates two demo accounts. **The seeder
does not run automatically** — execute it once after the stack is up, then
log in with the credentials below.

### Run the seeder

```bash
# from the repo root, with the backend running on :3001
cd backend
npm run seed
```

Output confirms the two accounts:

```
+ Created Admin: admin@hajj.gov.bd (password: Admin123!)
+ Created Pilgrim User: pilgrim@example.com (password: User123!)
```

(The seeder is idempotent — re-running it reports `= Admin already exists`
and doesn't change the password. If you need to reset the passwords, drop
the database volume with `docker compose down -v` and re-seed.)

### Sign-in matrix

| Role    | Email                  | Password    | Where to sign in                                  |
| ------- | ---------------------- | ----------- | ------------------------------------------------- |
| Pilgrim | `pilgrim@example.com` | `User123!` | http://localhost:3000/login — goes to `/dashboard` |
| Admin   | `admin@hajj.gov.bd`   | `Admin123!` | http://localhost:3000/login — goes to `/admin`     |

Use the **Admin** account to see the admin nav (Packages, Bookings, Payments,
Manual payments, Cancellations, Refunds, Reconciliation, Vendors, Inventory,
Reports, Audit logs). Use the **Pilgrim** account to see the user flow
(browse packages, book, pay, request cancellation).

---

## Prerequisites

- **Node.js 20 LTS** (18.18+ also works; Node 20 is the tested baseline).
- **Docker 24+** with `docker compose` v2 (only required for the `make dev` /
  `make prod` path).
- **Make** *(optional)* — every Make target has a `./scripts/dev` equivalent so
  you don't need `make` installed.
- Ports `3000` (frontend), `3001` (backend API), `5432` (Postgres) and `6379`
  (Redis) must be free on the host when running the full stack.

---

## Where to look next

- `docs/API_SPEC.md` — every REST endpoint, request/response shape, error code.
- `docs/DATABASE_SCHEMA.md` — every table and column.
- `docs/PROJECT_CONTEXT.md` — the original business-rules brief that drove the
  implementation.
- `docs/ARCHITECTURE.md` — **the Part 2 design deliverable**: high-level
  system diagram, microservices-or-not answer, full design Q&A and the
  production scaling path.
- `docs/ERD.md` — Mermaid entity-relationship diagram for the entire schema.
- `docs/GAP_ANALYSIS.md` — what shipped, what was added at the end, what the
  reviewer is most likely to look for.
- `MANUAL_TESTING_GUIDE.md` — end-to-end manual test walkthrough (register,
  book, pay, cancel, reconcile).

---

## Design answers

These three questions are required by the assessment brief. Short answers
here, full reasoning and diagrams in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### 1. How do you prevent overselling a seat under concurrent bookings?

Booking creation runs inside a single PostgreSQL transaction that takes
`SELECT … FOR UPDATE` on the `package_tiers` row first (TypeORM
`pessimistic_write`). Any concurrent booking blocks on that row, recomputes
`available = total_quota − held_seats − confirmed_seats`, rejects with
`409 INSUFFICIENT_SEATS` if the requested `pilgrim_count` exceeds it, and
otherwise increments `held_seats` and inserts the booking, pilgrims and
installments in the same transaction. Held seats are released by the
`expire-seat-holds` scheduler once `hold_expires_at` passes. See
`backend/src/bookings/bookings.service.ts`.

### 2. How do you handle a duplicate or out-of-order payment webhook?

Three layers of idempotency: `payment_webhook_events.event_id` is `UNIQUE`
(a second delivery returns `200 OK` without re-processing); payment
state transitions are guarded (`SUCCESS` cannot regress to `PENDING`); and
payment-allocations to installments are keyed on `installments.id` so the
same payment cannot double-allocate. A late webhook that targets an
already-terminal payment is acknowledged but never mutates state. See
`backend/src/payments/payments.service.ts`.

### 3. How do you keep reporting fast at 5 million users?

Three layers: (a) paginated, index-backed reads on the primary tables; (b)
pre-aggregated summary tables refreshed by the NestJS scheduler so
`/admin/reports/overview` is O(1) instead of re-aggregating on every
request; (c) PostgreSQL read replicas fronted by a Redis cache for hot
reads (package browsing, dashboard KPIs). PostgreSQL remains the source of
truth; the replica and Redis are never authoritative for money. Full
reasoning in `docs/ARCHITECTURE.md`.

---

## Assumptions & trade-offs

- **5M registered users ≠ 5M concurrent users.** The architecture targets the
  realistic peak of a few thousand concurrent users during the Hajj / Ramadan
  booking window.
- **Modular monolith, not microservices.** All modules (`auth`, `packages`,
  `bookings`, `payments`, `cancellation`, `refunds`, `reconciliation`,
  `vendors`, `inventory`, `report`, `audit`, `scheduler`) live in a single
  NestJS process with one PostgreSQL primary. Splitting into services only
  earns its complexity when measured load, organizational scale or
  compliance demands it. See `docs/ARCHITECTURE.md` §"Microservices — yes or
  no?".
- **Money values are server-side.** The client never tells the server how much
  a booking costs, what status a payment is in, or what a refund should be.
  `tier.price` is captured at booking creation (`bookings.unit_price`) so that
  later admin changes to tier pricing do not retroactively change historical
  bookings.
- **Soft delete only on financial records.** Nothing financial is ever
  hard-deleted; reports still query deleted rows and reconciliation works.
- **Webhooks are the source of truth for payment success.** The client
  redirect is not trusted; only an authenticated webhook that passes the
  gateway signature check and the `event_id` idempotency check can mark a
  payment `SUCCESS`.
- **Manual branch payments must be approved by a different admin** from the
  one who recorded them (segregation of duties). Settled as `PENDING_APPROVAL`
  until an independent approver acts.
- **Gateway mismatches are never auto-corrected.** They become
  `reconciliation_records.status = MISMATCH`; only an admin can mark them
  `RESOLVED` and the action is audited.
- **Real payment gateways are abstracted.** The assessment ships a mock
  gateway; production swap-in is behind the same `PaymentsService.create`
  interface.

