FROM node:20-alpine AS base
WORKDIR /app

# Install all dependencies (needed for build).
# `apps/api` is a workspace in the monorepo — the authoritative lockfile lives
# at the repo root, not here. Railway / any single-service build that uses this
# Dockerfile only ships `apps/api/` as the build context, so there is no
# lockfile to `npm ci` against. `npm install` works in both cases: it honours
# a local lockfile when present and generates one otherwise.
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production dependencies only
FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
# Note: tracing.ts is imported at the top of main.ts, so no -r flag needed
