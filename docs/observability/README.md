# Observability — payments & platform

This app exposes Prometheus metrics, ships errors to Sentry, and surfaces a
payments-health view inside the admin panel. This doc covers how to wire the
external monitoring (Prometheus/Grafana) and the alerts worth setting.

## Metrics endpoint

`GET /api/metrics` returns Prometheus text format.

- **Guard it in production.** Set `METRICS_TOKEN`; the scraper must then send
  `Authorization: Bearer <METRICS_TOKEN>`. With `METRICS_TOKEN` unset the
  endpoint is publicly readable (a warning is logged at boot).
- Defined in `apps/api/src/metrics/metrics.service.ts`.

### Exposed series

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status_code` | All HTTP requests |
| `http_request_duration_seconds` | histogram | `method`, `route` | Request latency |
| `llm_requests_total` | counter | `provider`, `model`, `feature` | LLM API calls |
| `llm_cost_usd_total` | counter | `provider`, `model` | Cumulative LLM spend |
| `cashfree_webhook_total` | counter | `outcome` | Cashfree webhook deliveries by outcome |

`outcome` ∈ `ok`, `bad_signature`, `missing_signature`, `missing_timestamp`,
`invalid_timestamp`, `stale_timestamp`, `not_configured`, `body_unavailable`,
`processing_error`. Anything but `ok` means a misconfiguration or a forging
attempt — that is the signal to alert on.

## Prometheus scrape config (sample)

```yaml
scrape_configs:
  - job_name: myastro360-api
    metrics_path: /api/metrics
    scheme: https
    authorization:
      type: Bearer
      credentials: ${METRICS_TOKEN}      # same value as the API's METRICS_TOKEN
    static_configs:
      - targets: ["api.myastro360.com"]
```

## Useful PromQL

```promql
# Webhook failure rate (per second) over 5m — should be ~0
sum(rate(cashfree_webhook_total{outcome!="ok"}[5m]))

# Webhook success ratio over 1h
sum(rate(cashfree_webhook_total{outcome="ok"}[1h]))
  / sum(rate(cashfree_webhook_total[1h]))

# API 5xx rate over 5m
sum(rate(http_requests_total{status_code=~"5.."}[5m]))

# p95 request latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# LLM spend rate ($/hr)
sum(rate(llm_cost_usd_total[1h])) * 3600
```

## Alert rules (sample)

```yaml
groups:
  - name: payments
    rules:
      - alert: CashfreeWebhookFailures
        expr: sum(rate(cashfree_webhook_total{outcome!="ok"}[10m])) > 0
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Cashfree webhooks are being rejected"
          description: "Non-ok webhook outcomes for 10m — check CASHFREE_WEBHOOK_SECRET / the webhook URL, or a possible forging attempt."

      - alert: CashfreeWebhookSecretMisconfigured
        expr: sum(increase(cashfree_webhook_total{outcome="not_configured"}[5m])) > 0
        for: 0m
        labels: { severity: critical }
        annotations:
          summary: "Webhook secret not configured — payments will not auto-credit"

      - alert: ApiHighErrorRate
        expr: sum(rate(http_requests_total{status_code=~"5.."}[5m])) > 0.5
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Elevated 5xx rate on the API"
```

## Sentry

- Backend: `Sentry.init` in `apps/api/src/main.ts`; 5xx are auto-captured by
  `HttpExceptionFilter`, and webhook signature/timestamp rejections (4xx, which
  the filter would otherwise miss) raise a rate-limited `captureMessage` from
  `payment.service.ts:recordWebhookOutcome`.
- Frontend: `apps/web/sentry.client.config.ts` (session replay on error in prod).
- Set `SENTRY_DSN` (api) and `NEXT_PUBLIC_SENTRY_DSN` (web).

## In-app payments observability (no external tooling needed)

The admin **Payments** tab (`/admin → Payments`) shows, live from the DB:
- **Stuck payments** — `PENDING` rows older than 15 min (the reconcile cron's
  targets); a non-zero value usually means webhooks aren't arriving.
- **24h success / fail / refund** counts and success rate.
- Revenue (today/7d/30d/gross), revenue by product type, success & refund rates.
- A filterable/searchable payments list with a **Refund** action.

Backed by `GET /api/admin/payments/metrics`, `GET /api/admin/payments/health`,
and `GET /api/admin/payments` (`growth-analytics.service.ts` / `admin.service.ts`).

## Health checks

- `GET /api/health/live` — liveness (always 200 if the process is up).
- `GET /api/health/ready` — readiness (DB required; Redis soft-fail). Use this as
  the platform healthcheck (Railway/k8s).
