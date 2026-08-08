#!/usr/bin/env bash
# Serve MFA builds with an /api reverse proxy so login works.
# Container UI: http://localhost:3000
# Workflow remoteEntry: http://localhost:3001/assets/remoteEntry.js
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="${MFE_TOOLS_DIR:-/tmp/mfe-serve-tools/node_modules/.bin}"

if [[ ! -x "$TOOLS/serve" ]]; then
  echo "Installing local serve tools into /tmp/mfe-serve-tools ..."
  mkdir -p /tmp/mfe-serve-tools
  (
    cd /tmp/mfe-serve-tools
    npm init -y >/dev/null 2>&1
    npm install serve concurrently --no-fund --no-audit
  )
fi

if [[ ! -d "$ROOT/container/dist" || ! -d "$ROOT/workflow/dist" ]]; then
  echo "Missing dist folders. Build first:"
  echo "  (cd container && npm run build)"
  echo "  (cd workflow && npx vite build)"
  exit 1
fi

# Free ports we need
for port in 3000 3001 3010; do
  pid="$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pid}" ]]; then
    kill $pid 2>/dev/null || true
  fi
done
sleep 1

nohup "$TOOLS/serve" -s "$ROOT/container/dist" -l 3010 --cors > /tmp/mfe-container-serve.log 2>&1 &
nohup "$TOOLS/serve" -s "$ROOT/workflow/dist" -l 3001 --cors > /tmp/mfe-workflow-serve.log 2>&1 &
nohup node "$ROOT/scripts/local-proxy.mjs" > /tmp/mfe-proxy.log 2>&1 &

sleep 1
echo "Container (via proxy): http://localhost:3000"
echo "Workflow remote:       http://localhost:3001"
echo "Logs: /tmp/mfe-proxy.log /tmp/mfe-container-serve.log /tmp/mfe-workflow-serve.log"
echo "Servers started in background (nohup)."
