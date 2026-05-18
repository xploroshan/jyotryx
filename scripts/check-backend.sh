#!/usr/bin/env bash
#
# myastro360 backend health diagnostics.
#
# Curls the configured API base URL and prints a terse pass/fail report so
# you can tell at a glance whether a login failure on myastro360.com is caused
# by the backend being asleep/unreachable or by something in the client.
#
# Usage:
#   scripts/check-backend.sh                         # uses apps/web/.env.production
#   API_BASE=https://custom.example.com/api scripts/check-backend.sh
#
# Exits 0 on success, non-zero if any critical check fails.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve the API base URL, in priority order:
#   1. API_BASE env var (explicit)
#   2. NEXT_PUBLIC_API_URL from apps/web/.env.production
#   3. Default fallback
API_BASE="${API_BASE:-}"
if [ -z "$API_BASE" ] && [ -f "$REPO_ROOT/apps/web/.env.production" ]; then
  API_BASE="$(grep -E '^NEXT_PUBLIC_API_URL=' "$REPO_ROOT/apps/web/.env.production" | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
API_BASE="${API_BASE:-https://myastro360.onrender.com/api}"

echo "myastro360 backend diagnostics"
echo "API base: $API_BASE"
echo

pass=0
fail=0

run_check() {
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local expect_code="$4"
  local body="${5:-}"

  local curl_args=(
    --silent --show-error
    --max-time 35
    --output /tmp/myastro360-check-body.$$
    --write-out '%{http_code} %{time_total}s'
    --request "$method"
  )
  if [ -n "$body" ]; then
    curl_args+=(--header 'content-type: application/json' --data "$body")
  fi

  local out
  if ! out="$(curl "${curl_args[@]}" "$url" 2>&1)"; then
    echo "  [FAIL] $label — curl error: $out"
    fail=$((fail + 1))
    return
  fi
  local code
  code="$(echo "$out" | awk '{print $1}')"
  local elapsed
  elapsed="$(echo "$out" | awk '{print $2}')"

  if [ "$code" = "$expect_code" ]; then
    echo "  [ OK ] $label — HTTP $code in $elapsed"
    pass=$((pass + 1))
  else
    echo "  [FAIL] $label — expected HTTP $expect_code, got HTTP $code in $elapsed"
    if [ -s /tmp/myastro360-check-body.$$ ]; then
      echo "         body: $(head -c 200 /tmp/myastro360-check-body.$$)"
    fi
    fail=$((fail + 1))
  fi
  rm -f /tmp/myastro360-check-body.$$
}

# 1. Health endpoint — must respond 200 with a JSON body.
run_check "Health endpoint" "$API_BASE/health" GET 200

# 2. Login with a known-bad credential — must return 401 (not 5xx / timeout).
#    Confirms the auth pipeline is hot.
run_check "Login rejects bad credentials (401 expected)" \
  "$API_BASE/auth/login" POST 401 \
  '{"email":"diagnostic-nouser@example.com","password":"definitely-wrong-password"}'

# 3. OTP send endpoint — must return 201 (Nest's default POST success code).
run_check "OTP send accepts a valid phone number" \
  "$API_BASE/auth/otp/send" POST 201 \
  '{"phone":"+919999000011"}'

echo
echo "Summary: $pass passed, $fail failed"
if [ "$fail" -gt 0 ]; then
  echo
  echo "Hints:"
  echo "  * Render free tier spins containers down after idle — first request after"
  echo "    inactivity can take 20-40 s. Re-run this script; if it still fails, the"
  echo "    backend is genuinely down or misconfigured."
  echo "  * If /auth/firebase returns 401 'Firebase is not configured on the server',"
  echo "    set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID) on Render and"
  echo "    redeploy."
  echo "  * Check CORS_ALLOWED_ORIGINS includes https://myastro360.com."
  exit 1
fi
