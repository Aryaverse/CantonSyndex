# CantonSyndex

**Privacy-Preserving Syndicated Loan & Tranche Lifecycle Engine on Canton Network**

[![DAML](https://img.shields.io/badge/DAML-2.9.4-blue?logo=daml)](https://docs.daml.com)
[![Canton Network](https://img.shields.io/badge/Canton-Network-purple)](https://canton.network)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Apache%202.0-green)](LICENSE)

---

## 🚀 Overview

CantonSyndex is an enterprise-grade capital markets execution engine for syndicated loans built natively on DAML and the Canton Network. It replaces manual spreadsheets, bilateral emails, and multi-day reconciliation with atomic, cryptographically verified smart contract execution.

### Key Capabilities
- 🔒 **Sub-Transaction Privacy** — Participant banks have zero mathematical visibility into competing banks' commitment shares, margin spreads, or fee structures.
- ⚡ **Atomic Pro-Rata Drawdowns** — Borrower drawdowns update aggregate facility headroom and distribute bilateral commitments simultaneously in sub-second finality.
- 📈 **Multi-Convention Interest Accrual** — Built-in engine supporting **Actual/365 Fixed**, **Actual/360**, and **30/360** day-count conventions over reference base rates (SOFR + margin).
- 💰 **Undrawn Commitment Fee Engine** — Automated calculation and collection of fees owed to lenders on unused liquidity capacity.
- 🛡️ **Real-Time Covenant Monitoring & Acceleration** — Authoritative quarterly verification of financial ratios (Leverage, DSCR, LTV, Liquidity) with automated breach alerts, formal waiver governance, and on-ledger default acceleration.
- 🗳️ **Multi-Party Facility Amendments** — Decentralized governance workflow for credit limit expansions (unanimous consent) and maturity extensions (supermajority/simple majority).
- 🌐 **Full-Stack Dashboard & REST API** — Interactive operations dashboard with party perspective switching and a complete REST API bridge for core banking integration.

---

## 🏛️ Architecture & Privacy Topology

```
                              ┌────────────────────────┐
                              │  Canton Synchronizer   │
                              │ (Transaction Ordering) │
                              └───────────┬────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │                       │                       │
        ┌─────────▼───────────┐ ┌─────────▼───────────┐ ┌─────────▼───────────┐
        │  Participant Node   │ │  Participant Node   │ │  Participant Node   │
        │   GlobalLeadBank    │ │      AlphaBank      │ │      BetaBank       │
        │      (Agent)        │ │     (Lender A)      │ │     (Lender B)      │
        ├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
        │ • MasterFacility    │ │ • TranchePart (A)   │ │ • TranchePart (B)   │
        │ • DrawdownExecution │ │ • IntAccrual (A)    │ │ • IntAccrual (B)    │
        │ • FacilityCovenants │ │ • FeeAccrual (A)    │ │ • FeeAccrual (B)    │
        │ • AmendmentProposal │ │ • Receipts (A only) │ │ • Receipts (B only) │
        └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

| Smart Contract | Signatories | Observers | Privacy Guarantee |
|---|---|---|---|
| `MasterFacility` | `borrower`, `agent` | `[regulator]` | Global facility cap; lenders cannot see each other |
| `TrancheParticipation` | `agent`, `lender` | None | Strict bilateral contract; zero competitor visibility |
| `InterestAccrual` | `agent`, `lender` | None | Private interest rate calculations and balances |
| `CommitmentFeeAccrual`| `agent`, `lender` | None | Private fee accrual on undrawn balances |
| `FacilityCovenants` | `borrower`, `agent` | `lenders`, `regulator` | Authoritative quarterly compliance verified by all |
| `CovenantBreachNotice`| `agent` | `borrower`, `lenders`, `regulator` | Permanent acceleration record broadcast upon default |
| `FacilityAmendmentProposal`| `borrower`, `agent` | `lenders` | Syndicate voting on proposed facility modifications |
| `DrawdownExecution` | `borrower`, `agent` | None | Immutable record of atomic capital utilization |
| `RepaymentReceipt` | `agent` | `lender` | Bilateral repayment and principal audit receipt |

---

## ⚡ 5-Step Quickstart

### 1. Prerequisites
- **DAML SDK 2.9.4+** (`curl -sSL https://get.daml.com/ | sh -s 2.9.4`)
- **Node.js 18+** & **npm**
- **Docker & Docker Compose** (Optional, for running Canton LocalNet)

### 2. Build Smart Contracts & TypeScript Bridge
```bash
# Build DAML DAR
make build-daml
# Or directly: daml build

# Compile TypeScript Bridge & Server
npm install
npm run build
```

### 3. Run Automated Tests
```bash
# Run all 12 DAML Script test suites
make test
# Or directly: daml test --all
```

### 4. Launch the Web Application & REST Server
```bash
# Start the full-stack server (Dashboard + REST API)
npm run server
```
- 🖥️ **Dashboard UI:** [http://localhost:3000/](http://localhost:3000/)
- 🔌 **REST API Health:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 5. Run End-to-End API Smoke Tests
```bash
# Run automated integration smoke test suite
./scripts/test-e2e.sh
```

---

## 🛠️ Developer Makefile Commands

```bash
make help        # Show all available developer targets
make start       # Launch 4-node Canton LocalNet via Docker Compose
make deploy      # Build DAR, upload to nodes, and provision parties
make dashboard   # Open operations dashboard in browser
make demo        # Full automated demo: start LocalNet -> deploy -> open UI
make status      # Check health status of all Canton participant nodes
make stop        # Stop LocalNet containers (preserves ledger state)
make clean       # Wipe all ledger state and reset environment
```

---

## 📂 Project Structure

```
CantonSyndex/
├── daml/
│   └── CantonSyndex/
│       ├── Core.daml           # All 12 smart contract templates
│       ├── Types.daml          # Financial types, helpers & aliases
│       └── Test.daml           # Comprehensive test suite (12 scripts)
├── src/
│   ├── bridge/
│   │   ├── SyndexLedgerBridge.ts # Type-safe Canton Ledger API client
│   │   ├── types.ts              # TypeScript payload definitions
│   │   └── index.ts              # Exports
│   └── server/
│       └── index.ts            # Standalone REST API & static web server
├── frontend/
│   ├── index.html              # Multi-tab operations dashboard
│   ├── index.css               # Glassmorphism dark theme styling
│   └── main.js                 # Reactive controller & Canton API client
├── infra/
│   ├── docker-compose.yml      # Canton Synchronizer + 3 Participant nodes
│   └── canton/                 # Node configuration files
├── scripts/
│   ├── deploy.sh               # DAR upload and party provisioning
│   ├── init-ledger.canton      # Canton Console initialization
│   ├── reset.sh                # Safe ledger wipe and rebuild
│   └── test-e2e.sh             # E2E integration test suite
├── docs/
│   ├── ARCHITECTURE.md         # Detailed Canton network architecture
│   ├── API_REFERENCE.md        # Complete smart contract & API reference
│   └── DEMO_PROTOCOL.md        # Client demonstration runbook
├── Makefile                    # Developer workflow automation
├── daml.yaml                   # DAML manifest (SDK 2.9.4)
└── package.json                # Node.js project manifest
```

---

## 📜 License

Licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.
