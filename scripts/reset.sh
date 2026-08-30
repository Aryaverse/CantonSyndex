#!/usr/bin/env bash
# CantonSyndex — Reset LocalNet (wipe all data, restart fresh)
# WARNING: destroys all ledger state including allocated parties and contracts

set -euo pipefail

echo "⚠  This will destroy all Canton LocalNet data and restart from scratch."
read -p "   Type 'RESET' to confirm: " confirm

if [ "$confirm" != "RESET" ]; then
  echo "Cancelled."
  exit 0
fi

echo "==> Stopping all Canton containers..."
docker-compose -f infra/docker-compose.yml down -v --remove-orphans

echo "==> Removing generated .env..."
rm -f infra/.env

echo "==> Restarting Canton LocalNet..."
docker-compose -f infra/docker-compose.yml up -d

echo "==> Waiting 30s for nodes to initialize..."
sleep 30

echo "==> Re-deploying DAR and parties..."
./scripts/deploy.sh --verify

echo "Reset complete."
