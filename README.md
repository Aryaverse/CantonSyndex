# CantonSyndex

**Privacy-Preserving Syndicated Loan & Tranche Lifecycle Engine on Canton Network**

[![DAML](https://img.shields.io/badge/DAML-2.9.4-blue?logo=daml)](https://docs.daml.com)
[![Canton Network](https://img.shields.io/badge/Canton-Network-purple)](https://canton.network)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](LICENSE)

---

## Overview

CantonSyndex implements the full lifecycle of a **syndicated loan facility** on the Canton Network, delivering:

- ✅ **Sub-transaction Privacy** — Participant banks cannot view each other's allocation, margin spreads, or fees
- ✅ **Atomic Multi-party Drawdowns** — Instantaneous balance updates with sub-second finality and zero reconciliation
- ✅ **Regulatory Compliance** — Optional regulator observer on facility-level contracts for systemic oversight
- ✅ **Canton Ledger API Integration** — TypeScript bridge for enterprise core banking system connectivity

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Canton Synchronizer                    │
│              (Shared Distributed State Machine)          │
└────────┬──────────────────────┬──────────────────────────┘
         │                      │
┌────────▼─────────┐  ┌────────▼─────────┐  ┌─────────────────┐
│  Lead Agent Node │  │  Bank A Node     │  │  Bank B Node    │
│  GlobalLeadBank  │  │  AlphaBank       │  │  BetaBank       │
│                  │  │                  │  │                  │
│  MasterFacility  │  │  TranchePartA    │  │  TranchePartB   │
│  DrawdownExec.   │  │  RepaymentRcpt   │  │  RepaymentRcpt  │
│  All Receipts    │  │  (Own only)      │  │  (Own only)     │
└──────────────────┘  └──────────────────┘  └─────────────────┘
```

**Privacy Guarantee**: Bank A has **zero mathematical visibility** into Bank B's allocation, margin spread, or fees. This is enforced at the Canton cryptographic protocol level — not application layer access control.

---

## Privacy Topology

| Contract Entity | Signatories | Observers | Confidentiality |
|---|---|---|---|
| `MasterFacility` | borrower, agent | [regulator] | Global cap only; lenders cannot see each other |
| `TrancheParticipation` | agent, lender | None | Strict bilateral. Bank B has zero visibility into Bank A's terms |
| `DrawdownExecution` | borrower, agent | None | Governs atomic draw against aggregate headroom |
| `RepaymentReceipt` | agent | lender (specific) | Pro-rata interest/principal audit for designated lender |

---

## Project Structure

```
CantonSyndex/
├── daml/
│   └── CantonSyndex/
│       ├── Core.daml          # Smart contract templates
│       ├── Types.daml         # Shared types and aliases
│       └── Test.daml          # DAML Script lifecycle tests
├── src/
│   └── bridge/
│       ├── SyndexLedgerBridge.ts  # Canton gRPC Ledger API bridge
│       ├── types.ts               # TypeScript contract interfaces
│       └── index.ts               # Re-exports
├── frontend/
│   ├── index.html             # Canton dashboard
│   ├── index.css              # Styling
│   └── main.js                # Dashboard logic
├── docs/
│   ├── ARCHITECTURE.md        # Full architecture docs
│   ├── DEMO_PROTOCOL.md       # Enterprise demo runbook
│   └── API_REFERENCE.md       # DAML template reference
├── .github/
│   └── workflows/
│       └── daml-build.yml     # CI/CD pipeline
├── daml.yaml                  # DAML project manifest
└── README.md
```

---

## Quick Start

### Prerequisites

```bash
# Install DAML SDK
curl -sSL https://get.daml.com/ | sh -s 2.9.4

# Verify installation
daml version
```

### Build & Test

```bash
# Build the DAML project
daml build

# Run all lifecycle tests (includes privacy isolation assertion)
daml test

# Start local Canton Sandbox
daml sandbox

# Run DAML Navigator UI (open http://localhost:7500)
daml navigator server
```

### TypeScript Bridge

```bash
npm install
npm run build
npm run start
```

---

## Demo Flow (Enterprise Presentation)

### Stage 1 — Multi-Node Provisioning
Spin up three Canton Participant Nodes (Lead Agent, Bank A, Bank B) connected to a shared LocalNet synchronizer. No central database or cleartext shared ledger.

### Stage 2 — Bilateral Isolation Demonstration
```
Agent: Create MasterFacility ($100M)
Agent: SyndicateTranche → Bank A ($60M @ 150 bps)
Agent: SyndicateTranche → Bank B ($40M @ 175 bps)

[Authenticate as Bank A]
→ Bank A sees: only $60M commitment
→ Bank A query for Bank B contracts: EMPTY (zero knowledge)
```

### Stage 3 — Atomic Drawdown & Finality
```
Borrower: RequestDrawdown $20M
Agent: ApplyTrancheDrawdown Bank A → $12M (60%)
Agent: ApplyTrancheDrawdown Bank B →  $8M (40%)
→ Sub-second atomic finality, zero reconciliation discrepancy
```

---

## Contract Invariants

- `totalLimit > 0` — Facility must have a positive limit
- `drawnAmount >= 0` — Cannot have negative drawn amount
- `drawnAmount <= totalLimit` — Cannot over-draw the facility
- `commitmentAmount > 0` — Tranche must have a positive commitment
- `drawnAmount <= commitmentAmount` — Cannot exceed tranche quota

---

## License

Apache 2.0 — See [LICENSE](LICENSE)

---

*Built on [Digital Asset DAML](https://daml.com) and [Canton Network](https://canton.network)*
