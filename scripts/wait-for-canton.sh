#!/usr/bin/env bash
# =============================================================================
# CantonSyndex — Canton Node Health & Readiness Probe
#
# Probes Canton Synchronizer and all Participant nodes until healthy or timeout.
#
# Usage:
#   ./scripts/wait-for-canton.sh [--timeout 60]
# =============================================================================

set -euo pipefail

TIMEOUT=60
INTERVAL=2
ELAPSED=0

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

while [[ $# -gt 0 ]]; do
  case $1 in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
done

printf "${BLUE}==> Probing Canton LocalNet nodes (Timeout: ${TIMEOUT}s)...${NC}\n"

check_port() {
  local host="$1"
  local port="$2"
  nc -z "$host" "$port" >/dev/null 2>&1 || (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1
}

check_http() {
  local url="$1"
  curl -sf "$url" >/dev/null 2>&1
}

NODES=(
  "Synchronizer (Admin)|localhost|9019|http://localhost:9019/health"
  "Goldman Sachs Node (Admin)|localhost|10012|http://localhost:10012/health"
  "JPMorgan Chase Node (Admin)|localhost|10022|http://localhost:10022/health"
  "Deutsche Bank Node (Admin)|localhost|10032|http://localhost:10032/health"
)

all_healthy=false

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  healthy_count=0

  for entry in "${NODES[@]}"; do
    IFS="|" read -r name host port url <<< "$entry"
    if check_port "$host" "$port" || check_http "$url"; then
      ((healthy_count++))
    fi
  done

  if [ "$healthy_count" -eq "${#NODES[@]}" ]; then
    all_healthy=true
    break
  fi

  printf "  [${ELAPSED}s/${TIMEOUT}s] Waiting for nodes (${healthy_count}/${#NODES[@]} ready)...\r"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo ""

if [ "$all_healthy" = true ]; then
  printf "${GREEN}✓ All ${#NODES[@]} Canton nodes are healthy and responding!${NC}\n"
  for entry in "${NODES[@]}"; do
    IFS="|" read -r name host port url <<< "$entry"
    printf "  ${GREEN}✓${NC} %-32s (port %s)\n" "$name" "$port"
  done
  exit 0
else
  printf "${YELLOW}⚠ Warning: Canton nodes did not all become ready within ${TIMEOUT}s.${NC}\n"
  printf "  Run 'make logs' or 'docker-compose -f infra/docker-compose.yml logs' to inspect node status.\n"
  exit 0
fi
