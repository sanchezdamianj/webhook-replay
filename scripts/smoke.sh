#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://localhost:3001}"
RECEIVER_BASE_URL="${RECEIVER_BASE_URL:-http://localhost:4000}"
RECEIVER_INTERNAL_BASE_URL="${RECEIVER_INTERNAL_BASE_URL:-http://receiver:4000}"

EMAIL="${EMAIL:-smoke@example.com}"
PASSWORD="${PASSWORD:-password}"
ACCOUNT_NAME="${ACCOUNT_NAME:-Smoke}"

echo "==> Ensuring user + token"
SIGNUP="$(
  curl -sS -X POST "${API_BASE_URL}/v1/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"account_name\":\"${ACCOUNT_NAME}\"}" || true
)"

LOGIN="$(
  curl -sS -X POST "${API_BASE_URL}/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}"
)"

TOKEN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' <<<"$LOGIN")"

echo "==> Creating destination (target_url=${RECEIVER_INTERNAL_BASE_URL}/echo)"
DEST_JSON="$(
  curl -sS -X POST "${API_BASE_URL}/v1/destinations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{\"destination\":{\"name\":\"Local receiver\",\"target_url\":\"${RECEIVER_INTERNAL_BASE_URL}/echo\"}}"
)"

DEST_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$DEST_JSON")"
PUBLIC_KEY="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key"])' <<<"$DEST_JSON")"

echo "    destination_id=${DEST_ID}"
echo "    public_key=${PUBLIC_KEY}"

echo "==> Ingesting event"
INGEST_JSON="$(
  curl -sS -X POST "${GATEWAY_BASE_URL}/webhook/${PUBLIC_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"smoke":true,"ts":"'"$(date -Iseconds)"'"}'
)"

EVENT_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["event_id"])' <<<"$INGEST_JSON")"

echo "    event_id=${EVENT_ID}"

echo "==> Triggering replay"
REPLAY_JSON="$(
  curl -sS -X POST "${API_BASE_URL}/v1/events/${EVENT_ID}/replay" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "{}"
)"
ATTEMPT_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["attempt_id"])' <<<"$REPLAY_JSON")"

echo "    attempt_id=${ATTEMPT_ID}"
echo "==> Waiting briefly for replay worker..."
sleep 2

echo "==> Receiver last request"
curl -sS "${RECEIVER_BASE_URL}/last" | python3 -m json.tool

echo "==> Done"

