FROM node:20-alpine AS base
WORKDIR /app

# Install all dependencies (needed for build)
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production dependencies only
FROM base AS prod-deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
