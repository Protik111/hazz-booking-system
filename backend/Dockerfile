# ─────────────────────────────────────────────────────────────
# Stage 1 – deps: install only production dependencies
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────
# Stage 1.5 – dev: install ALL dependencies (incl. dev) for local dev
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Source is bind-mounted at runtime by docker-compose.dev.yml, so we
# deliberately do NOT COPY . . here.

# ─────────────────────────────────────────────────────────────
# Stage 2 – builder: compile TypeScript
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3 – runner: lean production image
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY package*.json ./

USER nestjs

EXPOSE 3001

CMD ["node", "dist/main"]
