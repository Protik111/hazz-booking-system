# ─────────────────────────────────────────────────────────────────────
# HajjGo Docker helpers
# ─────────────────────────────────────────────────────────────────────
#
# Quick reference:
#   make dev           # start dev (hot-reload) stack
#   make dev-build     # rebuild dev images after dependency changes
#   make dev-down      # stop dev stack
#   make logs          # tail logs from both app containers
#   make logs-backend  # tail backend logs only
#   make logs-frontend # tail frontend logs only
#   make shell-backend # open a shell in the backend container
#   make shell-frontend# open a shell in the frontend container
#   make prod          # build & start production stack
#   make prod-down     # stop production stack
#   make down          # stop whatever stack is running (dev or prod)
#   make reset         # ⚠  nukes volumes (drops DB, clears .next cache)
#
# The dev stack uses docker-compose.dev.yml on top of docker-compose.yml.
# It bind-mounts source so changes show up immediately — no rebuild.
# ─────────────────────────────────────────────────────────────────────

COMPOSE_BASE = docker compose -f docker-compose.yml
COMPOSE_DEV  = $(COMPOSE_BASE) -f docker-compose.dev.yml
COMPOSE_PROD = $(COMPOSE_BASE)

.PHONY: help dev dev-build dev-down logs logs-backend logs-frontend \
        shell-backend shell-frontend shell-postgres \
        prod prod-build prod-down down restart \
        reset reset-db rebuild-deps ps

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Development ─────────────────────────────────────────────────────

dev: ## Start dev stack (hot reload for backend + frontend)
	$(COMPOSE_DEV) up

dev-build: ## Rebuild dev images (run after changing package.json)
	$(COMPOSE_DEV) build

dev-down: ## Stop dev stack
	$(COMPOSE_DEV) down

logs: ## Tail logs from both app containers
	$(COMPOSE_DEV) logs -f --tail=100 backend frontend

logs-backend: ## Tail backend logs only
	$(COMPOSE_DEV) logs -f --tail=100 backend

logs-frontend: ## Tail frontend logs only
	$(COMPOSE_DEV) logs -f --tail=100 frontend

shell-backend: ## Open a shell in the backend container
	$(COMPOSE_DEV) exec backend sh

shell-frontend: ## Open a shell in the frontend container
	$(COMPOSE_DEV) exec frontend sh

shell-postgres: ## Open psql against the dev database
	$(COMPOSE_DEV) exec postgres psql -U postgres -d hajj_booking

# ─── Production ──────────────────────────────────────────────────────

prod: ## Build and start production stack
	$(COMPOSE_PROD) up --build

prod-build: ## Build production images without starting
	$(COMPOSE_PROD) build

prod-down: ## Stop production stack
	$(COMPOSE_PROD) down

# ─── Utilities ───────────────────────────────────────────────────────

down: ## Stop whatever stack is currently running
	-$(COMPOSE_BASE) -f docker-compose.dev.yml down
	-$(COMPOSE_BASE) down

restart: ## Restart the app containers without dropping the DB
	$(COMPOSE_DEV) restart backend frontend

ps: ## List running containers
	$(COMPOSE_BASE) ps

# `docker compose build --no-cache` is the nuclear option when npm ci is
# acting up. Use sparingly.
rebuild-deps:
	$(COMPOSE_DEV) build --no-cache backend frontend

# ─── Reset (⚠ destructive) ──────────────────────────────────────────
# Drops the named volumes, which includes the Postgres data directory.
# Use when you want a clean DB / fresh .next cache.

reset: ## ⚠ Stop everything and delete volumes (drops DB)
	$(COMPOSE_BASE) -f docker-compose.dev.yml down -v
	$(COMPOSE_BASE) down -v
	docker volume rm -f hajj_postgres_data hajj_redis_data 2>/dev/null || true

reset-db: ## ⚠ Drop and recreate only the Postgres volume
	$(COMPOSE_DEV) stop backend frontend
	docker volume rm -f $$(docker volume ls -q | grep postgres_data) 2>/dev/null || true
	$(COMPOSE_DEV) up -d postgres redis
