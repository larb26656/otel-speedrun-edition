#!/usr/bin/env bash
set -euo pipefail

LOKI_URL="${LOKI_URL:-http://localhost:3100}"
JOB="${JOB:-curl-direct}"
LEVEL="${LEVEL:-info}"
MESSAGE="${MESSAGE:-hello from direct curl}"

TIMESTAMP=$(date +%s%N)

PAYLOAD=$(cat <<EOF
{
  "streams": [
    {
      "stream": {
        "job": "${JOB}",
        "level": "${LEVEL}"
      },
      "values": [
        ["${TIMESTAMP}", "${MESSAGE}"]
      ]
    }
  ]
}
EOF
)

echo "Pushing to ${LOKI_URL}/loki/api/v1/push ..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "${LOKI_URL}/loki/api/v1/push" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

if [ "${HTTP_CODE}" = "204" ]; then
  echo "OK (204) — ts=${TIMESTAMP} job=${JOB} msg=\"${MESSAGE}\""
else
  echo "Failed — HTTP ${HTTP_CODE}" >&2
  exit 1
fi
