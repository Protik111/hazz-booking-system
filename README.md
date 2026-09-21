# Hajj & Umrah Booking System

End-to-end booking platform for Hajj and Umrah packages: pilgrim-facing storefront,
payment gateway (mocked for assessment), admin back-office, vendor / inventory /
reconciliation tooling.

- **`backend/`** — NestJS 11 + TypeORM + PostgreSQL REST API.
- **`frontend/`** — Next.js 16 (App Router) + React 19 + Tailwind v4.

---

## Quick start with Docker (recommended)

A single `docker compose up` boots the entire stack — postgres, redis, backend, and
frontend — in containers.

```bash
# from the repo root
docker compose up -d --build
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
└── docker-compose.yml     # full stack: postgres + redis + backend + frontend
```

The complete API contract lives in `docs/API_SPEC.md`.
