FROM node:20-alpine AS base
WORKDIR /app

# Native-addon build toolchain. `swisseph` (Swiss Ephemeris, C++) and `bcrypt`
# are compiled from source by node-gyp at `npm install` time, which requires
# Python + a C/C++ compiler. `node:20-alpine` ships neither. We install these
# only in the stages that run `npm install`; the final `production` stage
# inherits a clean `node:20-alpine` and copies the already-compiled
# `node_modules` from `prod-deps`, so the runtime image stays slim.

# Install all dependencies (needed for build).
# `apps/api` is a workspace in the monorepo — the authoritative lockfile lives
# at the repo root, not here. Railway / any single-service build that uses this
# Dockerfile only ships `apps/api/` as the build context, so there is no
# lockfile to `npm ci` against. `npm install` works in both cases: it honours
# a local lockfile when present and generates one otherwise.
FROM base AS deps
# `py3-setuptools` ships a `distutils` compatibility shim. Alpine 3.19+ installs
# Python 3.12, where `distutils` was removed from the stdlib. The `swisseph`
# package transitively pins `node-gyp@8.4.1`, which still imports
# `distutils.version.StrictVersion` — without the shim the native-addon build
# fails with `ModuleNotFoundError: No module named 'distutils'`.
RUN apk add --no-cache python3 py3-setuptools make g++
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
RUN apk add --no-cache python3 py3-setuptools make g++
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Production
FROM base AS production
ENV NODE_ENV=production
# Prisma's query/schema engine dynamically links against libssl at runtime.
# `node:20-alpine` doesn't ship OpenSSL, so without this the container
# crashes on `prisma migrate deploy` with:
#   "Please manually install OpenSSL and try installing Prisma again."
# `libc6-compat` is Alpine's glibc shim — Prisma's prebuilt binaries expect it.
RUN apk add --no-cache openssl libc6-compat
COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

# Regenerate the Prisma client against the prod-deps node_modules. The `build`
# stage ran `prisma generate` against its own dev+prod install, but we ship the
# leaner `prod-deps` node_modules — which has `@prisma/client` installed but no
# generated client at `node_modules/.prisma/client`. Without this, the app
# boots to "@prisma/client did not initialize yet. Please run 'prisma generate'".
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
# Note: tracing.ts is imported at the top of main.ts, so no -r flag needed
