#!/usr/bin/env bash
# =============================================================================
# CantonSyndex — End-to-End API & Integration Smoke Test Suite
#
# Validates the complete REST API and DAML contract workflows against
# the CantonSyndex bridge server.
#
# Usage:
#   ./scripts/test-e2e.sh [API_BASE_URL]
#   e.g. ./scripts/test-e2e.sh http://localhost:3000
# =============================================================================

set -euo pipefail

API_URL="${1:-http://localhost:3000}"
PASS_COUNT=0
FAIL_COUNT=0

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_test() { echo -e "\n${BLUE}TEST [${1}]:${NC} ${2}"; }
assert_ok() {
  if [ "$1" -eq 0 ]; then
    echo -e "  ${GREEN}✓ PASS:${NC} $2"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗ FAIL:${NC} $2"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          CantonSyndex E2E Smoke Test Suite                   ║"
echo "║   Target: ${API_URL}                             ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# ---------------------------------------------------------------------------
# 1. Health Endpoint
# ---------------------------------------------------------------------------
log_test "1" "Check REST Bridge Health (/api/health)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/health" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  assert_ok 0 "Bridge server is UP (HTTP 200)"
else
  assert_ok 1 "Bridge server returned HTTP ${HTTP_CODE}"
fi

# ---------------------------------------------------------------------------
# 2. Master Facility Query
# ---------------------------------------------------------------------------
log_test "2" "Query Master Facility (/api/facility?facilityId=FAC-2026-USD-100M)"
RES=$(curl -sf "${API_URL}/api/facility?facilityId=FAC-2026-USD-100M" || echo "{}")
if echo "$RES" | grep -q "facilityId"; then
  assert_ok 0 "Master Facility schema returned successfully"
else
  assert_ok 1 "Master Facility query failed"
fi

# ---------------------------------------------------------------------------
# 3. Tranches List Query
# ---------------------------------------------------------------------------
log_test "3" "Query Syndicate Tranches (/api/tranches)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/tranches" || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  assert_ok 0 "Tranches endpoint returned HTTP 200"
else
  assert_ok 1 "Tranches query returned HTTP ${HTTP_CODE}"
fi

# ---------------------------------------------------------------------------
# 4. Request Drawdown
# ---------------------------------------------------------------------------
log_test "4" "Execute Drawdown Command (/api/drawdown)"
DRAW_RES=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"facilityCid": "#1:0", "borrowerParty": "BorrowerCorp", "amount": 10000000, "drawdownId": "DRAW-TEST-001"}' \
  "${API_URL}/api/drawdown" || echo "{}")
if echo "$DRAW_RES" | grep -q "success"; then
  assert_ok 0 "Drawdown command executed successfully"
else
  assert_ok 1 "Drawdown command failed"
fi

# ---------------------------------------------------------------------------
# 5. Interest Accrual
# ---------------------------------------------------------------------------
log_test "5" "Execute Interest Accrual (/api/interest/accrue)"
INT_RES=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"accrualCid": "#2:0", "accrualDate": "2026-08-31"}' \
  "${API_URL}/api/interest/accrue" || echo "{}")
if echo "$INT_RES" | grep -q "success"; then
  assert_ok 0 "Interest accrual choice executed"
else
  assert_ok 1 "Interest accrual failed"
fi

# ---------------------------------------------------------------------------
# 6. Commitment Fee Accrual
# ---------------------------------------------------------------------------
log_test "6" "Execute Commitment Fee Accrual (/api/fees/accrue)"
FEE_RES=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"feeCid": "#3:0", "accrualDate": "2026-08-31"}' \
  "${API_URL}/api/fees/accrue" || echo "{}")
if echo "$FEE_RES" | grep -q "success"; then
  assert_ok 0 "Commitment fee accrual executed"
else
  assert_ok 1 "Commitment fee accrual failed"
fi

# ---------------------------------------------------------------------------
# 7. Covenant Compliance Test
# ---------------------------------------------------------------------------
log_test "7" "Execute Quarterly Covenant Compliance Test (/api/covenants/test)"
COV_RES=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"covenantCid": "#4:0", "testDate": "2026-08-31", "newLeverage": 3.8, "newDSCR": 1.45, "newLTV": 0.62, "newLiquidity": 7200000}' \
  "${API_URL}/api/covenants/test" || echo "{}")
if echo "$COV_RES" | grep -q "success"; then
  assert_ok 0 "Covenant test submitted and verified"
else
  assert_ok 1 "Covenant test failed"
fi

# ---------------------------------------------------------------------------
# 8. Facility Amendment Vote
# ---------------------------------------------------------------------------
log_test "8" "Cast Amendment Vote (/api/amendments/vote)"
VOTE_RES=$(curl -sf -X POST -H "Content-Type: application/json" \
  -d '{"proposalCid": "#5:0", "lenderParty": "AlphaBank"}' \
  "${API_URL}/api/amendments/vote" || echo "{}")
if echo "$VOTE_RES" | grep -q "success"; then
  assert_ok 0 "Lender amendment vote recorded"
else
  assert_ok 1 "Amendment vote failed"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "══════════════════════════════════════════════════════════════"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "${GREEN}✓ ALL ${PASS_COUNT} E2E TESTS PASSED SUCCESSFULLY!${NC}"
  echo "══════════════════════════════════════════════════════════════"
  exit 0
else
  echo -e "${RED}✗ ${FAIL_COUNT} TESTS FAILED (${PASS_COUNT} passed)${NC}"
  echo "══════════════════════════════════════════════════════════════"
  exit 1
fi
