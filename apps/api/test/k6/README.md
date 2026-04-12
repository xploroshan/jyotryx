# k6 Load Tests

Synthetic load tests targeting Jyotryx API at up to 10k requests per second.

## Prerequisites

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/):

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - <test/k6/chat-message.js
```

## Generate an auth token

The load tests require a valid JWT. Generate one via the OTP flow:

```bash
# 1. Send OTP (dev/staging with OTP_EXPOSE_IN_RESPONSE=true)
curl -s -X POST http://localhost:4000/api/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210"}' | jq .

# 2. Verify OTP and extract token
curl -s -X POST http://localhost:4000/api/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210","otp":"<otp>"}' | jq -r .tokens.accessToken
```

## Run individual tests

```bash
# Chat endpoint
AUTH_TOKEN=<jwt> k6 run test/k6/chat-message.js

# Kundli endpoint
AUTH_TOKEN=<jwt> k6 run test/k6/astrology-kundli.js

# Palmistry endpoint
AUTH_TOKEN=<jwt> k6 run test/k6/palmistry-analyze.js
```

## Run the full suite (10k RPS combined)

```bash
AUTH_TOKEN=<jwt> k6 run test/k6/full-suite.js
```

## Target a remote environment

```bash
AUTH_TOKEN=<jwt> API_URL=https://api.jyotron.com/api k6 run test/k6/full-suite.js
```

## Output to JSON (for Grafana dashboards)

```bash
AUTH_TOKEN=<jwt> k6 run --out json=results.k6.json test/k6/full-suite.js
```

## Notes

- **LLM costs**: At 10k RPS, chat/kundli hit LLM APIs. For cost-safe testing,
  use a mock LLM backend or set `LLM_MOCK_URL` to bypass real providers.
- **Rate limiting**: The API enforces 60 req/min per IP via ThrottlerModule.
  Disable or increase limits for load testing environments.
- **Single machine limits**: Generating 10k RPS may require multiple k6
  instances or k6 Cloud. A single machine typically maxes out around 5-8k RPS.
