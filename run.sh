#!/usr/bin/env bash
# One command to run the WC26 Continental Chaos Board for manual testing.
# Installs web dependencies on first run, then starts the dev server.
set -e
cd "$(dirname "$0")"

if [ ! -d apps/web/node_modules ]; then
  echo "→ First run: installing web dependencies…"
  npm --prefix apps/web install
fi

echo "→ Starting the WC26 Continental Chaos Board"
echo "  open http://localhost:3000   (Ctrl+C to stop)"
echo "  tip: copy apps/web/.env.example to apps/web/.env.local to wire real data (else it uses mocks)"
exec npm --prefix apps/web run dev
