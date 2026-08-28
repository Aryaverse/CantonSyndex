# CantonSyndex Enterprise Demo Protocol

## Overview

This document defines the three-stage validation demonstration protocol
for pitching CantonSyndex to Tier-1/Tier-2 capital markets and treasury
stakeholders. Execute these steps in sequence to showcase:

1. Privacy-preserving multi-node syndication
2. Bilateral isolation guarantee (cryptographic proof)
3. Atomic drawdown with sub-second finality

---

## Prerequisites

```bash
# Install DAML SDK
curl -sSL https://get.daml.com/ | sh -s 2.9.4

# Clone the repo
git clone https://github.com/Aryaverse/CantonSyndex.git
cd CantonSyndex

# Build the DAR
daml build
```

---

## Stage 1 — Multi-Node Provisioning

### Goal
Demonstrate that no central database or cleartext shared ledger exists.
Three distinct Canton Participant Nodes communicate via a shared Synchronizer.

### Local Canton Sandbox Setup

```bash
# Start Canton Sandbox (single-node mode for quick demo)
daml sandbox

# In a separate terminal, start Navigator
daml navigator server
# Open http://localhost:7500
```

### Multi-Node Canton LocalNet (Advanced / Enterprise)

For a true three-node demonstration with Docker:

```yaml
# docker-compose.canton.yml (excerpt)
services:
  synchronizer:
    image: digitalasset/canton-enterprise:2.9.4
    command: ["daemon", "--config", "/canton/synchronizer.conf"]

  participant-agent:
    image: digitalasset/canton-enterprise:2.9.4
    command: ["daemon", "--config", "/canton/participant-agent.conf"]

  participant-banka:
    image: digitalasset/canton-enterprise:2.9.4
    command: ["daemon", "--config", "/canton/participant-banka.conf"]

  participant-bankb:
    image: digitalasset/canton-enterprise:2.9.4
    command: ["daemon", "--config", "/canton/participant-bankb.conf"]
```

```bash
docker-compose -f docker-compose.canton.yml up -d
```

**Key talking point**: Each `participant-*` container has its own PostgreSQL
database. The synchronizer never stores decrypted contract payloads.

---

## Stage 2 — Bilateral Isolation Demonstration

### Run the Lifecycle Script

```bash
daml script \
  --dar .daml/dist/CantonSyndex-0.1.0.dar \
  --script-name CantonSyndex.Test:testSyndicatedLoanLifecycle \
  --ledger-host localhost \
  --ledger-port 6865
```

### Expected Output

```
Allocating parties...
  ✓ BorrowerCorp  [BORROWER]
  ✓ GlobalLeadBank [AGENT]
  ✓ AlphaBank     [BANK_A]
  ✓ BetaBank      [BANK_B]
  ✓ CentralBank   [REGULATOR]

Creating MasterFacility $100M...
  ✓ FAC-2026-USD-100M created

Syndicating tranches...
  ✓ AlphaBank: $60,000,000 @ 150 bps
  ✓ BetaBank:  $40,000,000 @ 175 bps

PRIVACY CHECK: Bank A querying Bank B contracts...
  ✓ bankAVisibleBTranches = []  (EMPTY — privacy enforced)
  ✓ bankBVisibleATranches = []  (EMPTY — privacy enforced)

Borrower RequestDrawdown $20M...
  ✓ DRAW-001 executed

Agent distributing pro-rata...
  ✓ AlphaBank: $12,000,000 (60%)
  ✓ BetaBank:   $8,000,000 (40%)

SettleRepayment for AlphaBank...
  ✓ Principal: $5,000,000 · Interest: $25,000
  ✓ RepaymentReceipt created (AlphaBank observer)
  ✓ Bank B cannot see Bank A receipt — CONFIRMED

DeactivateFacility...
  ✓ isActive = False

All assertions passed.
```

### Key Demo Points for Stakeholders

> **"Notice Bank A's query for Bank B's contract returns zero results."**
> 
> This is NOT application-level access control that could be bypassed by
> a compromised admin. This is enforced by the Canton cryptographic protocol.
> BetaBank's participant node never receives the encryption key required
> to decrypt AlphaBank's TrancheParticipation. Period.

### Navigator Privacy Inspection

1. Open http://localhost:7500
2. Login as **AlphaBank** (BANK_A)
3. Go to **Contracts** → Filter by `TrancheParticipation`
4. Show: Only 1 contract visible (AlphaBank's own)
5. Login as **BetaBank** (BANK_B)
6. Show: Only 1 contract visible (BetaBank's own — different margin, different amount)

**Talking point**: AlphaBank's 150bps margin vs BetaBank's 175bps margin
are bilaterally negotiated. Neither bank can discover the other's terms,
preventing competitive intelligence leakage.

---

## Stage 3 — Atomic Drawdown & Finality

### Live Dashboard Demo

```bash
# Serve the frontend dashboard
cd frontend
python3 -m http.server 8080
# Open http://localhost:8080
```

### Demo Flow

1. **Select party: BorrowerCorp**
   - Navigate to "Drawdown" tab
   - Enter: `DRAW-002`, `$15,000,000`
   - Click "Submit RequestDrawdown"
   - Show: Headroom updates to $65M instantaneously

2. **Select party: GlobalLeadBank (Agent)**
   - Navigate to "Tranches" tab
   - Show: AlphaBank drawn = $21M (60% of new drawdown = $9M added)
   - Show: BetaBank drawn = $14M (40% of new drawdown = $6M added)

3. **Select party: AlphaBank (Bank A)**
   - Navigate to "Tranches" tab
   - Show: AlphaBank sees ONLY its own tranche (privacy enforced)
   - No BetaBank data visible in the UI

4. **Select party: BetaBank (Bank B)**
   - Navigate to "Tranches" tab
   - Show: BetaBank sees ONLY its own tranche (different terms!)

5. **Navigate to "Audit Log" tab (any party)**
   - Show: Immutable, time-stamped event trail
   - All events cryptographically signed by controllers

### Key Finality Points

- **Sub-second finality**: Canton's atomic commit protocol ensures all
  participant nodes update simultaneously, with no reconciliation lag
- **Zero settlement discrepancy**: The DAML invariant `drawnAmount <= totalLimit`
  is mathematically guaranteed — over-commitment is impossible by construction
- **Regulatory auditability**: CentralBank observer can verify aggregate
  exposure (the $100M cap) without accessing bilateral commercial terms

---

## Competitive Differentiation

| Feature | Traditional (SWIFT/Syndtrak) | CantonSyndex |
|---|---|---|
| Reconciliation | T+1 to T+3 bilateral | Sub-second atomic |
| Privacy | Shared portal (trust-based) | Cryptographic (protocol-level) |
| Auditability | Email archives | Immutable ledger |
| Margin privacy | Third-party sees all | Bilateral — zero leakage |
| Settlement discrepancy | 3-5% error rate | Mathematically impossible |
| Infrastructure | Centralized DB + SWIFT | Decentralized Canton nodes |

---

## Troubleshooting

### DAML build fails
```bash
daml version   # Should show 2.9.4
daml build --verbosity 2
```

### Script fails on privacy assertion
Ensure you're running against a Canton sandbox (not an external ledger
that might have different party allocations). The privacy assertion
`null bankAVisibleBTranches` tests Canton's local party query semantics.

### Navigator not loading contracts
```bash
# Reload Navigator with explicit DAR
daml navigator server --port 7500 .daml/dist/CantonSyndex-0.1.0.dar
```
