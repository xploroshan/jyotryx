# myastro360 Deployment Guide — Scaling to 200K Users

## Table of Contents

**▶ Operating the live system — start here during an incident:**
- [Production Topology at a Glance](#production-topology-at-a-glance) — what runs where, and which dashboard to open
- [Incident Runbook & Troubleshooting](#incident-runbook--troubleshooting) — "site down / can't log in" triage

**Setup & scaling guides:**
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Phase 1: Railway (API) + Vercel (Web) + Managed DB](#2-phase-1-railway--vercel--managed-db)
3. [Phase 2: Kubernetes on DigitalOcean](#3-phase-2-kubernetes-on-digitalocean)
4. [Phase 3: Cloudflare CDN + Edge Optimization](#4-phase-3-cloudflare-cdn--edge)
5. [LLM Provider Setup](#5-llm-provider-setup)
6. [Monitoring & Observability](#6-monitoring--observability)
7. [Cost Summary](#7-cost-summary)

---

## Production Topology at a Glance

> **This is the map. During an incident, open the dashboard for the failing component — don't guess.**
> All secrets and identifiers (project refs, team IDs, tokens) live in the provider dashboards and `apps/api/.env` — never in this repo.

| # | Component | Provider | What it does | Where to look | Most common failure |
|---|---|---|---|---|---|
| 1 | **Web** | **Vercel** (project `jyotryx-web`) | Serves the Next.js app at `www.myastro360.com`; auto-deploys `main`. | Vercel → Deployments / Runtime Logs | Build/deploy failed (last good stays live); bad `NEXT_PUBLIC_*` env |
| 2 | **API** | **Railway** | NestJS backend at `api.myastro360.com` — handles auth/login and all data. Builds `apps/api/Dockerfile`; healthcheck `/api/health/ready`. | Railway → service → Deployments + Logs + **Billing** | **Service suspended on a pending/failed payment**; crash-loop; failed migration |
| 3 | **Postgres** | **Supabase** (`ap-south-1`) | Primary DB + pgvector. Pooler `:6543` at runtime, direct `:5432` for migrations. | Supabase → project status; Logs → Postgres | Project **paused** (inactivity); connection limit; wrong `DATABASE_URL` |
| 4 | **Redis** | **Upstash** (`ap-south-1`) | Cache, BullMQ queues, OTP store, login rate-limit/lockout. `rediss://`, `noeviction`. | Upstash → usage/metrics | Daily quota exhausted → queues/OTP degrade (login still works — soft dep) |
| 5 | **DNS / TLS / CDN** | **Cloudflare** | `www` proxied (CDN); `api` **DNS-only** so Railway terminates TLS. | Cloudflare → DNS, SSL/TLS | Wrong/un-proxied record; SSL mode mismatch (521/523/525) |
| 6 | **Object storage** | **Cloudflare R2** | Palm uploads, PDF reports at `uploads.myastro360.com`. | Cloudflare → R2 | Bucket/key/CORS misconfig |
| 7 | **LLM** | OpenAI · Gemini · Anthropic | Reading generation, failover chain (order in `site_settings`). | Provider dashboards; API logs | Spend cap hit / key revoked → failover or feature errors |
| 8 | **Errors** | Sentry | Exception tracking (API + web). | Sentry dashboard | — |

**The login request path is only three of these:** browser → **Web (Vercel)** loads the page → it POSTs to **API (Railway)** `/api/auth/login` → API reads **Postgres (Supabase)**. So *"the site loads but I can't log in"* almost always means **#2 (Railway API)** or **#3 (Supabase DB)** — not the web app itself.

---

## Incident Runbook & Troubleshooting

### 0. First 60 seconds — run these three checks

```bash
# Is the web shell up? (Vercel)
curl -I https://www.myastro360.com
# → HTTP 200/308 = web OK.  Connection/DNS/TLS error = jump to §DNS (Cloudflare) or §Web (Vercel)

# Is the API process up? (Railway) — liveness has NO dependencies
curl -i https://api.myastro360.com/api/health/live
# → {"status":"ok"} = process alive.  502/503/timeout/"Application failed to respond" = jump to §API (Railway)

# Can the API reach its data stores? (DB hard-required, Redis soft)
curl -s https://api.myastro360.com/api/health/ready
# → 200 with database:"up" = DB reachable.  503 with database:"down" = jump to §Database (Supabase)
```

**Symptom → component:**

| Symptom | Most likely | Section |
|---|---|---|
| Whole site unreachable; browser TLS/DNS error (Cloudflare 1016 / 521 / 523) | DNS/CDN | §DNS |
| Site loads, but **login + everything data-driven fails** | **API (Railway)** | §API |
| `…/api/health/live` returns 502 / "Application failed to respond" | **API (Railway)** | §API |
| `…/api/health/ready` is 503 with `database: down` | Postgres (Supabase) | §Database |
| Login works, but OTP / queued jobs / reports are stuck | Redis (Upstash) / worker | §Redis |
| The web URL itself errors while the API is healthy | Web (Vercel) | §Web |

### §API — API down (Railway) · the most common cause

**Symptoms:** `www.myastro360.com` loads but login and all authenticated/data calls fail; `…/api/health/live` returns 502/503/timeout or *"Application failed to respond"*; Supabase shows `ACTIVE_HEALTHY` **but nearly idle** (because requests never reach it).

**Check these in order:**

1. **Billing — check this first.** Railway **suspends the service when a payment is pending or a card fails**, and the API simply stops responding. Railway → your project shows a *"payment required" / resource-limited* banner. **This was the root cause of the 2026-06-23 login outage** — settling the pending Railway payment restored service.
   - **Fix:** settle the outstanding invoice / update the payment method. The service resumes automatically; if it doesn't, redeploy (Railway → Deployments → Redeploy).
   - **Prevent:** enable Railway billing/usage alerts and keep a valid backup card on file (see [Prevention](#prevention--make-the-next-incident-loud-and-early)).
2. **Deploy status / logs.** Railway → service → Deployments. Is the latest deploy *crashed* or *crash-looping*? Open its logs. Boot failures we've seen: a bad/missing env var, `npx prisma migrate deploy` failing against the DB, or an unhandled exception at startup.
   - **Fix:** redeploy the last green build or roll back; correct the offending variable (Variables tab) and redeploy.
3. **Resource limits.** Out-of-memory or hitting the plan's usage cap can also kill/suspend the service (same banner area).

**Confirm recovery:** `curl -i https://api.myastro360.com/api/health/live` → `{"status":"ok"}`, then `…/api/health/ready` → 200.

### §Database — DB unreachable (Supabase)

**Symptoms:** API logs show DB connection errors; `…/api/health/ready` → **503** with `database: { status: "down" }`; login throws 500s.

**Checks:**
- Supabase → project **status**: `ACTIVE_HEALTHY` or **paused**? (Inactive projects can auto-pause — a classic "everything's down" cause.)
- Connections vs. limit, and Logs → Postgres for `too many clients` / `FATAL`.
- `DATABASE_URL` correct? Runtime uses the **pooler URL (`:6543`, `?pgbouncer=true`)**; migrations use the **direct URL (`:5432`)**.

**Fixes:** resume a paused project; correct the connection string in Railway Variables; raise compute / pool size if connection-exhausted.

> If Supabase is `ACTIVE_HEALTHY` but almost idle while users report an outage, the DB is fine — traffic isn't reaching it. Look **upstream at the API (§API)**.

### §Redis — Redis degraded (Upstash)

Login is intentionally resilient to Redis: `auth.service.ts` treats the rate-limit/lockout store as best-effort, and `/api/health/ready` keeps Redis **soft** (`REDIS_HEALTH_REQUIRED=false` default), so a Redis blip reports `degraded` but readiness stays green and **login keeps working**. What *does* break: OTP send/verify, BullMQ jobs (reports/PDFs), and rate-limiting. Check the Upstash console for daily-quota exhaustion; raise the plan/quota.

### §Web — Web down (Vercel)

If `www.myastro360.com` itself errors while the API is healthy: Vercel → `jyotryx-web` → Deployments (is the latest **production** deploy `READY`?) and Runtime Logs. Fix by redeploying or rolling back to the last `READY` production deployment. (Dependabot/PR-branch deploys are *preview* targets and don't affect production.)

### §DNS — DNS / TLS / CDN (Cloudflare)

**Symptoms:** total unreachability, browser TLS errors, Cloudflare 1016/521/523/525.

**Checks:** Cloudflare → DNS —
- `www` → CNAME `cname.vercel-dns.com`, **proxied (orange)**.
- `api` → the target Railway gives you, **DNS-only (gray)** so Railway can terminate TLS.
- SSL/TLS mode = **Full (strict)**.

### Prevention — make the next incident loud and early

- **Billing alerts on every paid provider** — Railway, Vercel, Supabase, Upstash. The 2026-06-23 outage was a *billing* failure with no infra fault; an alert would have caught it before users did. Keep a valid backup payment method on Railway.
- **External uptime monitoring** hitting `https://api.myastro360.com/api/health/ready` every 1–5 min with alerting (UptimeRobot, BetterStack, or Cloudflare Health Checks). This pages you on any of §API / §Database / §DNS before a user complains.
- **Sentry alerts** for API error-rate spikes.

---

## 1. Current Architecture Overview

```
   Browser
      │  HTTPS
      ▼
┌──────────────┐  POST /api/*  ┌──────────────────┐   SQL   ┌─────────────────────────┐
│ Vercel        │ ────────────▶ │ Railway           │ ──────▶ │ Supabase Postgres 16     │
│ Next.js web   │               │ NestJS API        │         │ + pgvector (ap-south-1)  │
│ www.myastro…  │               │ api.myastro…      │         └─────────────────────────┘
└──────────────┘               └────────┬─────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │ Upstash Redis     │
                               │ cache · BullMQ ·  │
                               │ OTP · rate-limit  │
                               └──────────────────┘

Cloudflare: DNS + TLS + CDN (www proxied · api DNS-only) · R2 storage (uploads.myastro…)
```

**Services your app needs:**
- PostgreSQL 16 with pgvector extension (embeddings)
- Redis 7 (caching, sessions, BullMQ job queues)
- Node.js 20 runtime for API
- Next.js hosting for web frontend
- Object storage (Cloudflare R2 — already configured)
- LLM API keys (OpenAI, Gemini, Anthropic)

**Key endpoints** (everything is behind the global `/api` prefix):
- `GET /api/health/live` — liveness; returns `{"status":"ok"}` with **no dependencies**
- `GET /api/health/ready` — readiness; **DB is hard-required** (HTTP 503 if down), **Redis is soft by default** (reports `degraded` but stays green unless `REDIS_HEALTH_REQUIRED=true`)
- `GET /api/docs` — Swagger docs (dev only)
- `GET /api/metrics` — Prometheus metrics

---

## 2. Phase 1: Railway (API) + Vercel (Web) + Managed DB

This is the recommended immediate step. You move off Render while keeping Vercel.

### 2.1 Database: Set Up Supabase PostgreSQL

Supabase provides managed PostgreSQL with pgvector, PgBouncer built-in, and a Mumbai region.

**Step 1: Create Supabase project**
1. Go to https://supabase.com/dashboard → New Project
2. Select region: **South Asia (Mumbai)**
3. Set a strong database password
4. Wait for the project to provision (~2 minutes)

**Step 2: Enable pgvector**
1. Go to SQL Editor in Supabase dashboard
2. Run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**Step 3: Get your connection strings**
1. Go to Project Settings → Database
2. Copy the **Connection string (URI)** — this is your `DATABASE_URL`
3. It will look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
4. For direct connections (migrations), use port 5432:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```

**Step 4: Run initial migration**
```bash
# From your local machine, set the direct connection URL
export DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

cd apps/api
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

### 2.2 Redis: Set Up Upstash

**Step 1: Create Upstash Redis**
1. Go to https://console.upstash.com → Create Database
2. Select region: **ap-south-1 (Mumbai)**
3. Select type: **Regional** (not Global, for lower latency)
4. Enable **TLS** (recommended for production)

**Step 2: Get credentials**
1. Copy the **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**
2. Copy the **Redis URL** (ioredis format):
   ```
   rediss://default:[password]@[endpoint].upstash.io:6379
   ```
   Note: `rediss://` (with two 's') for TLS

**Step 3: Verify BullMQ compatibility**
- Upstash supports BullMQ natively
- The `maxmemory-policy` must be `noeviction` (Upstash sets this by default)

### 2.3 Backend API: Deploy to Railway

**Step 1: Create Railway project**
1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Select `xploroshan/myastro360`
3. Railway will auto-detect the monorepo

**Step 2: Configure the API service**
1. Click "New Service" → "GitHub Repo"
2. Set the **Root Directory** to `apps/api`
3. Railway will detect the Dockerfile at `apps/api/Dockerfile`
4. Set **Builder** to "Dockerfile"

**Step 3: Set environment variables**
In Railway's service settings → Variables, add:

```env
# Database (use the Supabase pooler URL)
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Redis (use the Upstash URL)
REDIS_URL=rediss://default:[pass]@[endpoint].upstash.io:6379
REDIS_HOST=[endpoint].upstash.io
REDIS_PORT=6379

# Server
PORT=4000
NODE_ENV=production
CORS_ORIGIN=https://www.myastro360.com
FRONTEND_URL=https://www.myastro360.com

# JWT (generate strong secrets)
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# LLM Providers
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
LLM_FAILOVER_ENABLED=true
GEMINI_MODEL=gemini-2.0-flash
GEMINI_MODEL_VISION=gemini-2.0-flash

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=myastro360-uploads
R2_PUBLIC_URL=https://uploads.myastro360.com

# Observability
SENTRY_DSN=https://...@sentry.io/...

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
```

**Step 4: Configure health checks**
In Railway service settings:
- Health check path: `/api/health/ready` (note the global `/api` prefix — `/health/ready` will 404)
- Health check port: `4000`

**Step 5: Set up custom domain**
1. Railway Settings → Networking → Custom Domain
2. Add `api.myastro360.com`
3. Railway gives you a CNAME value
4. In Cloudflare DNS, add: `api CNAME [railway-value]` (proxy OFF for Railway)

**Step 6: Configure the start command**
Railway will use the Dockerfile CMD by default:
```
npx prisma migrate deploy && node dist/main
```
This is defined in your `apps/api/Dockerfile` line 31.

Alternatively, to use the startup script that handles seed data:
- Override the start command to: `node scripts/startup.js`

### 2.4 Frontend: Stay on Vercel (Update Config)

**Step 1: Update environment variables in Vercel**
Go to your Vercel project → Settings → Environment Variables:

```env
NEXT_PUBLIC_API_URL=https://api.myastro360.com/api
NEXT_PUBLIC_WS_URL=wss://api.myastro360.com
NEXT_PUBLIC_APP_URL=https://www.myastro360.com
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

**Step 2: Set the root directory**
In Vercel project settings:
- Root Directory: `apps/web`
- Build Command: `npm run build`
- Install Command: `cd ../.. && npm install --ignore-scripts` (already in vercel.json)
- Framework: Next.js (auto-detected)

**Step 3: Configure domain**
1. Vercel Settings → Domains → Add `www.myastro360.com`
2. In Cloudflare DNS, add: `www CNAME cname.vercel-dns.com` (proxy ON)

### 2.5 Verify Phase 1 Deployment

```bash
# 1. Check API health
curl https://api.myastro360.com/api/health/live
# Expected: {"status":"ok"}

curl https://api.myastro360.com/api/health/ready
# Expected: {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}

# 2. Check web frontend
curl -I https://www.myastro360.com
# Expected: HTTP/2 200

# 3. Check CORS
curl -H "Origin: https://www.myastro360.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://api.myastro360.com/api/auth/login
# Expected: access-control-allow-origin: https://www.myastro360.com

# 4. Run k6 load test against production
cd apps/api
MYASTRO360_BASE_URL=https://api.myastro360.com npm run test:k6:all
```

---

## 3. Phase 2: Kubernetes on DigitalOcean

When to move: Railway costs exceed ~$300/mo, or you need separate worker pods.

### 3.1 Create DigitalOcean Kubernetes Cluster

**Step 1: Create the cluster**
1. Go to https://cloud.digitalocean.com → Kubernetes → Create Cluster
2. Select region: **Bangalore (BLR1)**
3. Kubernetes version: **1.29+**
4. Node pool:
   - Name: `worker-pool`
   - Size: **s-2vcpu-4gb** ($24/mo each)
   - Count: **3 nodes** (minimum for HA)
   - Enable autoscaling: min 3, max 6
5. Create cluster (~5 minutes)

**Step 2: Connect to the cluster**
```bash
# Install doctl CLI
brew install doctl  # macOS
# or: snap install doctl  # Linux

# Authenticate
doctl auth init

# Save kubeconfig
doctl kubernetes cluster kubeconfig save <cluster-name>

# Verify
kubectl get nodes
```

### 3.2 Set Up Managed Database

**Step 1: Create PostgreSQL cluster**
1. DigitalOcean → Databases → Create → PostgreSQL
2. Version: **16**
3. Region: **Bangalore (BLR1)**
4. Plan: **Basic** ($15/mo) to start, scale to **Professional** when needed
5. Add trusted source: your K8s cluster

**Step 2: Enable pgvector**
```bash
# Connect to your DO managed DB
psql "postgresql://doadmin:[pass]@[host]:25060/defaultdb?sslmode=require"

# Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 3: Create Managed Redis**
1. DigitalOcean → Databases → Create → Redis
2. Region: **Bangalore (BLR1)**
3. Plan: **Basic** ($15/mo)
4. Eviction policy: **noeviction** (required for BullMQ)

### 3.3 Build and Push Container Images

**Step 1: Set up GitHub Container Registry**
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u xploroshan --password-stdin
```

**Step 2: Build and push images**
```bash
# Build API image
cd apps/api
docker build -t ghcr.io/xploroshan/myastro360-api:latest .
docker push ghcr.io/xploroshan/myastro360-api:latest

# Build Web image
cd ../web
docker build -t ghcr.io/xploroshan/myastro360-web:latest .
docker push ghcr.io/xploroshan/myastro360-web:latest
```

**Step 3: Create GHCR pull secret in K8s**
```bash
kubectl create namespace myastro360

kubectl create secret docker-registry ghcr-secret \
  --namespace=myastro360 \
  --docker-server=ghcr.io \
  --docker-username=xploroshan \
  --docker-password=$GITHUB_TOKEN
```

### 3.4 Configure Kubernetes Secrets

**Step 1: Edit the secrets file**
```bash
# Copy the template
cp k8s/base/secrets.yaml k8s/base/secrets-production.yaml

# Edit with your real values (NEVER commit this file)
# Fill in all CHANGEME values with production credentials
```

**Step 2: Apply secrets** (directly, not through Kustomize for sensitive data)
```bash
kubectl apply -f k8s/base/secrets-production.yaml
```

### 3.5 Update ConfigMap for Production

Edit `k8s/base/configmap.yaml`:
```yaml
data:
  NODE_ENV: "production"
  PORT: "4000"
  CORS_ORIGIN: "https://www.myastro360.com"
  FRONTEND_URL: "https://www.myastro360.com"
  RATE_LIMIT_WINDOW_MS: "60000"
  RATE_LIMIT_MAX_REQUESTS: "60"
  NEXT_TELEMETRY_DISABLED: "1"
  LLM_FAILOVER_ENABLED: "true"
  GEMINI_MODEL: "gemini-2.0-flash"
  GEMINI_MODEL_VISION: "gemini-2.0-flash"
  DATA_RETENTION_MONTHS: "6"
```

### 3.6 Install Ingress Controller

```bash
# Install nginx-ingress via Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.publishService.enabled=true
```

### 3.7 Install cert-manager for TLS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml

# Wait for it to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s

# Create ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@myastro360.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 3.8 Deploy the Application

```bash
# Apply all resources via Kustomize
kubectl apply -k k8s/base/

# Verify deployments
kubectl get pods -n myastro360
# Expected output:
# NAME                      READY   STATUS    RESTARTS   AGE
# api-xxx-yyy               1/1     Running   0          1m
# api-xxx-zzz               1/1     Running   0          1m
# api-xxx-www               1/1     Running   0          1m
# web-xxx-yyy               1/1     Running   0          1m
# web-xxx-zzz               1/1     Running   0          1m
# worker-xxx-yyy            1/1     Running   0          1m
# worker-xxx-zzz            1/1     Running   0          1m

# Check services
kubectl get svc -n myastro360

# Check ingress
kubectl get ingress -n myastro360

# Check HPA
kubectl get hpa -n myastro360
# Expected:
# NAME     REFERENCE           TARGETS   MINPODS   MAXPODS
# api      Deployment/api      <CPU>     3         16
# web      Deployment/web      <CPU>     2         10
# worker   Deployment/worker   <CPU>     2         8
```

### 3.9 Point DNS to Kubernetes

**Step 1: Get the Load Balancer IP**
```bash
kubectl get svc -n ingress-nginx
# Note the EXTERNAL-IP of the ingress-nginx-controller service
```

**Step 2: Update Cloudflare DNS**
```
api.myastro360.com  → A record → <LB-IP> (proxy OFF or DNS only)
www.myastro360.com  → A record → <LB-IP> (proxy ON for CDN)
```

### 3.10 Verify Phase 2 Deployment

```bash
# Check pods are healthy
kubectl get pods -n myastro360 -o wide

# Check API readiness
kubectl exec -n myastro360 deploy/api -- wget -qO- http://localhost:4000/api/health/ready

# Check logs
kubectl logs -n myastro360 deploy/api --tail=50
kubectl logs -n myastro360 deploy/worker --tail=50

# Check HPA is working
kubectl describe hpa api -n myastro360

# Run load test
cd apps/api
MYASTRO360_BASE_URL=https://api.myastro360.com npm run test:k6:all
```

---

## 4. Phase 3: Cloudflare CDN + Edge

### 4.1 Activate Cloudflare Proxy

1. In Cloudflare dashboard, ensure your DNS records have **proxy enabled** (orange cloud)
2. Go to SSL/TLS → set mode to **Full (strict)**
3. Go to Caching → Caching Rules:
   - Rule 1: Cache static API responses (e.g., `/api/knowledge/*`) for 1 hour
   - Rule 2: Bypass cache for authenticated routes (`/api/chat/*`, `/api/auth/*`)

### 4.2 Cloudflare R2 Setup for Images

You already use R2 for palm images. Add a custom domain:
1. Cloudflare → R2 → Your bucket → Settings → Custom Domains
2. Add `uploads.myastro360.com`
3. This serves images via Cloudflare CDN automatically

### 4.3 Rate Limiting at the Edge

Cloudflare dashboard → Security → WAF → Rate limiting rules:
```
Rule 1: API rate limit
  - If: URI path contains "/api/"
  - Rate: 100 requests per minute per IP
  - Action: Block for 60 seconds

Rule 2: Auth brute force protection
  - If: URI path contains "/api/auth/"
  - Rate: 10 requests per minute per IP
  - Action: Challenge for 300 seconds
```

---

## 5. LLM Provider Setup

### 5.1 Get API Keys

**OpenAI (Primary)**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key with name "myastro360-production"
3. Set usage limits: $100/month hard cap to start
4. Set the key as `OPENAI_API_KEY`

**Google Gemini (Secondary — cheapest)**
1. Go to https://aistudio.google.com/apikey
2. Create an API key for your Google Cloud project
3. Enable the "Generative Language API" in Google Cloud Console
4. Set as `GEMINI_API_KEY`
5. Pricing: $0.10 / 1M input tokens — 10x cheaper than GPT-4o-mini

**Anthropic (Tertiary — failover)**
1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Set spend limit: $50/month
4. Set as `ANTHROPIC_API_KEY`

### 5.2 Install Gemini SDK

```bash
cd apps/api
npm install @google/genai
```

### 5.3 Configure Per-Feature Models via Database

The LlmService reads model config from the `site_settings` table every 30 seconds.
Set these values to optimize cost per feature:

```sql
-- Use cheap models for high-volume features
INSERT INTO site_settings (key, value) VALUES
  ('llm.default.model', 'gpt-4o-mini'),
  ('llm.default.provider', 'openai'),
  ('llm.default.temperature', '0.7'),
  ('llm.precision.model', 'gpt-4o'),
  ('llm.vision.model', 'gpt-4o-mini')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 5.4 Verify LLM Failover

Check API logs after deployment:
```bash
# Should show all 3 providers
kubectl logs -n myastro360 deploy/api | grep "LLM service ready"
# Expected: LLM service ready — primary: OpenAI, secondary: Gemini, tertiary: Anthropic, failover: true
```

---

## 6. Monitoring & Observability

### 6.1 Sentry (Error Tracking) — Already Configured

1. Create a project at https://sentry.io
2. Set `SENTRY_DSN` in your environment
3. Both API (`@sentry/node`) and Web (`@sentry/nextjs`) are already instrumented

### 6.2 Prometheus Metrics

The API exposes metrics via `prom-client`:
```bash
curl https://api.myastro360.com/api/metrics
```

For K8s, install kube-prometheus-stack:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

### 6.3 OpenTelemetry Tracing

Already configured via `apps/api/src/tracing.ts`. Set the endpoint:
```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.monitoring:4318
```

For a free hosted option, use Grafana Cloud's OTLP endpoint.

---

## 7. Cost Summary

### Phase 1 (Railway + Vercel + Managed Services)

| Service | Provider | Monthly Cost |
|---------|----------|-------------|
| Frontend | Vercel Pro | $20 |
| Backend API | Railway | $20-50 |
| Database | Supabase Pro | $25 |
| Redis | Upstash Pro | $10 |
| Object Storage | Cloudflare R2 | $5 |
| LLM APIs | OpenAI + Gemini | $50-100 |
| Monitoring | Sentry free tier | $0 |
| DNS/CDN | Cloudflare free | $0 |
| **Total** | | **~$130-210/mo** |

### Phase 2 (DigitalOcean Kubernetes)

| Service | Provider | Monthly Cost |
|---------|----------|-------------|
| K8s Cluster (3 nodes) | DigitalOcean | $72 |
| Managed PostgreSQL | DigitalOcean | $15-50 |
| Managed Redis | DigitalOcean | $15 |
| Load Balancer | DigitalOcean | $12 |
| Object Storage | Cloudflare R2 | $5 |
| LLM APIs | OpenAI + Gemini | $50-100 |
| Monitoring | Grafana Cloud free | $0 |
| DNS/CDN | Cloudflare free | $0 |
| **Total** | | **~$170-255/mo** |

### Cost-down / pause mode

The web tier is designed to survive the backend being switched off: every
server-side API call on the public pages fails safe (`server-api.ts` returns
`null`, never throws), so pages keep returning **200 with their static
content**. That means the backend can be paused **without losing search
visibility** — the indexed pages, sitemap, hreflang and JSON-LD all keep
serving from Vercel.

**Never pause the Vercel project to save money.** It is the cheapest
component and the only one holding the indexed surface; pausing it drops
pages out of Google within weeks.

**`DISABLE_LIVE_DATA=true`** (Vercel → Settings → Environment Variables →
Production, then **Redeploy**) is the switch that makes this a clean,
intentional state rather than a degraded one:

| | Switch **off** (default) | Switch **on** |
|---|---|---|
| Panchang / horoscope API calls | made on every ISR revalidation (51 cities × locales, 12 signs × 4 periods × locales) | **skipped before `fetch()`** — instant render, no timeouts, no Sentry noise |
| Live block when API is down | "…being prepared, please refresh in a moment" | section omitted entirely (no thin-content notice for crawlers) |
| Page status / SEO markup | 200, full markup | **identical** — 200, full markup |
| Pricing + share links | live | **still live** (deliberately not gated — a fallback price while checkout charges the real one would misprice the product) |

Pause ladder, cheapest effort first:

1. **Stop the daily LLM spend.** `instagram-daily.yml` runs 02:00 UTC daily
   and calls `ANTHROPIC_API_KEY`. Kill switch: repo → Settings → Secrets and
   variables → Actions → **Variables** → `SOCIAL_ENGINE_ENABLED=false`.
2. **Set `DISABLE_LIVE_DATA=true`** on Vercel and redeploy.
3. **Railway** — stop/remove the API service (image stays in GHCR).
4. **Supabase** — Pause project (data retained); downgrade Pro → Free or you
   keep paying while paused.
5. **Upstash** — usage drops to ~0 with the API off; downgrade to Free.
6. **LLM providers** — set a low hard spend cap. Do *not* revoke keys.
7. Leave **R2** (data loss) and **Vercel** (SEO) alone.

Resume: reverse the order (Supabase → Upstash → Railway → DNS `api.` record
DNS-only → `curl /api/health/ready` → re-register Cashfree / Play RTDN
webhooks if the API URL changed → unset `DISABLE_LIVE_DATA` → redeploy).

---

## Quick Reference: Commands Cheat Sheet

```bash
# ── Local Development ──
npm run dev                          # Start all services (turbo)
npm run docker:up                    # Start Postgres + Redis via Docker
npm run db:migrate                   # Run Prisma migrations
npm run db:seed                      # Seed database

# ── Railway Deployment ──
railway login                        # Authenticate
railway link                         # Link to project
railway up                           # Deploy

# ── Kubernetes Deployment ──
kubectl apply -k k8s/base/           # Deploy all resources
kubectl get pods -n myastro360          # Check pod status
kubectl logs deploy/api -n myastro360   # Check API logs
kubectl logs deploy/worker -n myastro360 # Check worker logs
kubectl top pods -n myastro360          # Resource usage
kubectl describe hpa -n myastro360      # Autoscaler status

# ── Database ──
npx prisma migrate deploy            # Run pending migrations
npx prisma studio                    # Open DB GUI

# ── Load Testing ──
npm run test:k6:all                  # Full k6 suite
npm run test:k6:chat                 # Chat load test
npm run test:k6:kundli               # Kundli load test

# ── Docker Build ──
docker build -t ghcr.io/xploroshan/myastro360-api:latest apps/api/
docker build -t ghcr.io/xploroshan/myastro360-web:latest apps/web/
docker push ghcr.io/xploroshan/myastro360-api:latest
docker push ghcr.io/xploroshan/myastro360-web:latest
```
