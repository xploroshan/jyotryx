#!/bin/bash
set -e

echo "=== Jyotryx Deployment Script ==="
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install it first."; exit 1; }
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }

# Build and start all services
echo "1. Building and starting services..."
docker compose up -d --build

# Wait for postgres to be ready
echo "2. Waiting for database..."
sleep 5

# Run database migrations
echo "3. Running database migrations..."
docker compose exec api npx prisma migrate deploy

# Seed database (only on first deploy)
if [ "$1" = "--seed" ]; then
  echo "4. Seeding database..."
  docker compose exec api npx ts-node prisma/seed.ts
fi

echo ""
echo "=== Deployment Complete ==="
echo "Web:    http://localhost:3000"
echo "API:    http://localhost:4000"
echo "PgAdmin: http://localhost:5050"
echo ""
echo "For Cloudflare Tunnel setup:"
echo "  1. cloudflared tunnel login"
echo "  2. cloudflared tunnel create jyotryx"
echo "  3. Update cloudflare-tunnel.yml with your tunnel ID"
echo "  4. cloudflared tunnel route dns jyotryx www.jyotryx.com"
echo "  5. cloudflared tunnel route dns jyotryx api.jyotryx.com"
echo "  6. cloudflared tunnel --config cloudflare-tunnel.yml run jyotryx"
