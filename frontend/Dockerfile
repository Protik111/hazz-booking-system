# ─────────────────────────────────────────────────────────────
# Stage 1 – deps: install all dependencies (incl. dev, needed to build)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci

# ─────────────────────────────────────────────────────────────
# Stage 2 – builder: build the Next.js app (produces .next/standalone)
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 3 – runner: lean production image running the standalone server
# ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone server bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copy static assets (Next.js standalone does NOT include these)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy public/ folder (also not bundled by standalone)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
