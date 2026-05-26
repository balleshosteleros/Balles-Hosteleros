#!/usr/bin/env bash
# Run SQL via Supabase Management API.
# Uses SUPABASE_ACCESS_TOKEN + project ref extracted from SUPABASE_URL.
# Usage: ./scripts/supabase-mgmt-query.sh "<sql>"
#        ./scripts/supabase-mgmt-query.sh -f path/to/file.sql

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env.local not found at $ENV_FILE" >&2
  exit 1
fi

extract_var() {
  local name="$1"
  grep -E "^${name}=" "$ENV_FILE" \
    | head -1 \
    | sed -E "s/^${name}=//; s/^[\"']//; s/[\"']$//" \
    | tr -d '\r\n'
}

URL="$(extract_var NEXT_PUBLIC_SUPABASE_URL)"
TOKEN="$(extract_var SUPABASE_ACCESS_TOKEN)"

if [ -z "$URL" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN" >&2
  exit 1
fi

# Extract project ref from URL (https://<ref>.supabase.co)
REF=$(printf '%s' "$URL" | sed -E 's|^https?://||; s|\.supabase\.co/?$||')
if [ -z "$REF" ] || [ "$REF" = "$URL" ]; then
  echo "ERROR: could not parse project ref from URL" >&2
  exit 1
fi

if [ "${1:-}" = "-f" ] && [ -n "${2:-}" ]; then
  SQL="$(cat "$2")"
elif [ -n "${1:-}" ]; then
  SQL="$1"
else
  echo "Usage: $0 \"<sql>\" | -f <file.sql>" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  PAYLOAD=$(jq -n --arg q "$SQL" '{query: $q}')
else
  ESCAPED=$(printf '%s' "$SQL" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')
  PAYLOAD="{\"query\":\"${ESCAPED%\\n}\"}"
fi

curl -sS -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo
