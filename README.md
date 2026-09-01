# CantonSyndex

**Privacy-Preserving Syndicated Loan & Tranche Lifecycle Engine on Canton Network**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-cantonsyndex.vercel.app-0052cc?style=for-the-badge&logo=vercel)](https://cantonsyndex.vercel.app)
[![DAML](https://img.shields.io/badge/DAML-2.9.4-0284c7?style=for-the-badge&logo=daml)](https://docs.daml.com)
[![Canton Network](https://img.shields.io/badge/Canton-Network-003d99?style=for-the-badge)](https://canton.network)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-Apache%202.0-059669?style=for-the-badge)](LICENSE)

---

## 🌐 Live Production Deployment

The **CantonSyndex** enterprise dashboard is deployed and globally accessible on Vercel:

| Environment | URL | Status |
|---|---|:---:|
| **Production Web Application** | **[https://cantonsyndex.vercel.app](https://cantonsyndex.vercel.app)** | 🟢 **Live** |
| **Direct Vercel Deployment** | **[https://cantonsyndex-53cvpggu3-pankajchaudhary.vercel.app](https://cantonsyndex-53cvpggu3-pankajchaudhary.vercel.app)** | 🟢 **Ready** |
| **Vercel Project Dashboard** | **[https://vercel.com/pankajchaudhary/cantonsyndex](https://vercel.com/pankajchaudhary/cantonsyndex)** | 🟢 **Active** |

---

## 📖 User Guide: Operating the Deployed Application

### 1. Authenticating as an Institutional Participant
1. Navigate to **[https://cantonsyndex.vercel.app](https://cantonsyndex.vercel.app)**.
2. In the **Select Participant Institution** modal, choose your operational role:
   - **`Goldman Sachs (Lead Arranger / Facility Agent)`** — Coordinates drawdowns, waivers, and amendment execution.
   - **`Amazon Capital (Obligor / Borrower)`** — Requests drawdowns, submits quarterly certificates, proposes amendments.
   - **`JPMorgan Chase (Senior Lender US)`** — Senior Tranche A lender ($60M commitment @ SOFR + 150 bps).
   - **`Deutsche Bank (Senior Lender EU)`** — Senior Tranche B lender ($40M commitment @ EURIBOR + 175 bps).
   - **`Federal Reserve (Auditor / Observer)`** — Real-time supervisory observer and regulatory auditor.
3. Select your network mode (**Interactive Sandbox** for instant simulation, or **Canton LocalNet** when connecting to live nodes).
4. Click **Authenticate & Enter Dashboard**.
5. Your active session is shown in the top-right header with your institution's badge (`GS`, `AC`, `JPM`, `DB`, `FED`).

---

### 2. Exploring the 9 Operational Dashboard Tabs

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ Overview ] [ Tranches ] [ Drawdown ] [ Interest ] [ Fees ] [ Covenants ] [ Amendments ] [ Settlement ]│
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 📊 1. Overview Tab
- **Facility Capacity Hero:** Visualizes total facility limit ($100M USD), drawn principal ($20M USD), and available headroom ($80M USD) with dynamic SVG arc gauges.
- **Privacy Topology Grid:** Demonstrates Canton's multi-party stakeholder model, highlighting who can view each contract segment.
- **Global Key Metrics:** Live summary of total tranches, active covenants, and execution status.

#### 🏦 2. Tranches Tab (Sub-Transaction Privacy)
- Displays syndicated tranche allocations, commitments, drawn amounts, and margin spreads.
- **Privacy Guarantee:** When logged in as **JPMorgan Chase**, you see only your $60M Tranche A. When logged in as **Deutsche Bank**, you see only your $40M Tranche B.
- Click **`🛡️ Proof`** next to any tranche to view the on-chain contract record.

#### 💸 3. Drawdown Tab (Pro-Rata Disbursements)
- Form to request new credit facility drawdowns with notice reference numbers.
- **Automated Pro-Rata Distribution:** Drawdown amounts are mathematically split according to lender commitment weightings (e.g., 60% JPMorgan Chase / 40% Deutsche Bank).
- Live execution event stream with individual on-chain proof buttons.

#### 📈 4. Interest Accrual Tab
- Accrues daily interest across **Actual/365 Fixed**, **Actual/360**, and **30/360** day-count conventions.
- Bilateral rate calculations: Reference base rate + lender margin spread.
- Interactive **Trigger Daily Accrual** action generating timestamped payment receipts.

#### 💰 5. Commitment Fees Tab
- Automatically calculates and collects quarterly facility fees on unused liquidity headroom (undrawn basis).
- Generates bilateral fee collection receipts for syndicate lenders.

#### 🛡️ 6. Covenants & Compliance Engine
- Real-time monitoring of 4 core financial covenants:
  - **Leverage Ratio:** Maximum 4.50x
  - **Debt Service Coverage (DSCR):** Minimum 1.25x
  - **Loan-to-Value (LTV):** Maximum 75.0%
  - **Minimum Liquidity:** Minimum $5,000,000 USD
- **Quarterly Compliance Test Form:** Submit borrower quarterly metrics to trigger instant on-ledger evaluation.
- **Breach & Default Governance:** Breached ratios turn crimson and post an on-chain default acceleration notice. Facility Agents can execute structured **Waive Breach** actions.

#### 🗳️ 7. Facility Amendments Tab
- Decentralized governance for syndicate modifications (e.g., credit expansion or maturity extension).
- Multi-party voting protocol:
  - **Lenders (JPM, DB):** Cast **Accept** or **Reject** votes.
  - **Agent (GS):** Executes amendment once the voting threshold (Unanimous or Majority) is satisfied.
- Executed amendments update the Master Facility limit on-chain.

#### 💳 8. Settlement & Receipts Tab
- Process principal repayments and interest clearances per lender tranche.
- Generates immutable on-ledger settlement receipts with Canton multi-hash references.

#### 📜 9. Regulatory Audit Log Tab
- Immutable, time-ordered Canton ledger event stream cryptographically signed by controlling parties.
- Every event includes a **`🛡️ Verify Proof`** button.

---

### 3. On-Chain Cryptographic Proof Inspector & Verification

Every transaction in CantonSyndex is backed by cryptographic primitives that can be inspected directly in the UI:

1. Click **`🛡️ Verify Proof`** on any audit log event or receipt.
2. The **Canton On-Chain Proof Inspector** modal opens, displaying:
   - **Transaction Update ID (Tx Hash):** 256-bit commit hash (`0x8e92f1b4...`).
   - **Canton Contract ID (`ContractId<T>`):** Canton multi-hash standard (`#12204a9d7e31...:0`).
   - **DAML Template Type & Ledger Offset:** Monotonic ledger sequencing and template identifier.
   - **Sequencer Synchronizer Domain:** BFT consensus finalized domain reference.
   - **Authorizing Signatures (Ed25519):** Public key fingerprints and digital signature verifications from Goldman Sachs, Amazon Capital, etc.
   - **Sub-Transaction Privacy & Blinding Factor:** Demonstrates how non-stakeholders cannot decrypt private view trees.
3. Click **Recalculate & Verify Hash**:
   - The browser computes a live SHA-256 digest using the **Web Crypto API** to verify integrity with **0 discrepancies**.
4. Click **Copy Full Proof (JSON)** to export raw audit data for regulatory filing.

---

## 🏛️ Smart Contract & Privacy Topology

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
        │    Goldman Sachs    │ │   JPMorgan Chase    │ │    Deutsche Bank    │
        │       (Agent)       │ │     (Lender A)      │ │     (Lender B)      │
        ├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
        │ • MasterFacility    │ │ • TranchePart (US)  │ │ • TranchePart (EU)  │
        │ • DrawdownExecution │ │ • IntAccrual (US)   │ │ • IntAccrual (EU)   │
        │ • FacilityCovenants │ │ • FeeAccrual (US)   │ │ • FeeAccrual (EU)   │
        │ • AmendmentProposal │ │ • Receipts (US only)│ │ • Receipts (EU only)│
        └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

| Smart Contract | Signatories | Observers | Privacy Guarantee |
|---|---|---|---|
| `MasterFacility` | `borrower`, `agent` | `[regulator]` | Global facility cap; lenders cannot see competitor terms |
| `TrancheParticipation` | `agent`, `lender` | None | Strict bilateral contract; zero competitor visibility |
| `InterestAccrual` | `agent`, `lender` | None | Private interest rate calculations and balances |
| `CommitmentFeeAccrual`| `agent`, `lender` | None | Private fee accrual on undrawn balances |
| `FacilityCovenants` | `borrower`, `agent` | `lenders`, `regulator` | Authoritative quarterly compliance verified by all |
| `CovenantBreachNotice`| `agent` | `borrower`, `lenders`, `regulator` | Permanent acceleration record broadcast upon default |
| `FacilityAmendmentProposal`| `borrower`, `agent` | `lenders` | Syndicate voting on proposed facility modifications |
| `DrawdownExecution` | `borrower`, `agent` | None | Immutable record of atomic capital utilization |
| `RepaymentReceipt` | `agent` | `lender` | Bilateral repayment and principal audit receipt |

---

## 💻 Local Development & Canton LocalNet Setup

### Prerequisites
- **DAML SDK 2.9.4** (`curl -sSL https://get.daml.com/ | sh -s 2.9.4`)
- **Node.js 18+** & **npm**
- **Docker & Docker Compose** (for running Canton multi-node LocalNet)

### Quick Start Commands
```bash
# 1. Install dependencies & build TypeScript bridge
npm install
npm run build

# 2. Run all 12 DAML Script test suites
make test
# or: daml test --all

# 3. Launch Canton LocalNet 4-node cluster with auto-readiness wait
make start

# 4. Build DAR, upload to nodes, and provision participant parties
make deploy

# 5. Launch full-stack REST API bridge & WebSocket server locally
npm run server
```

- 🖥️ **Local Dashboard:** [http://localhost:3001/](http://localhost:3001/)
- 🔌 **REST API Health:** [http://localhost:3001/api/health](http://localhost:3001/api/health)
- 📡 **WebSocket Hub:** `ws://localhost:3001/ws/notifications`

---

## 🛠️ Developer Makefile Commands

```bash
make help        # Show all available developer targets
make start       # Launch 4-node Canton LocalNet via Docker Compose (with health probe)
make wait-canton # Probe Canton nodes until all are healthy
make deploy      # Build DAR, upload to nodes, and provision parties
make dashboard   # Open operations dashboard in browser
make demo        # Full automated demo: start LocalNet -> deploy -> open UI
make status      # Check health status of all Canton participant nodes
make stop        # Stop LocalNet containers (preserves ledger state)
make clean       # Wipe all ledger state and reset environment
```

---

## 🚀 Deploying Updates to Vercel

```bash
# Deploy to Vercel production
vercel --prod --yes --scope pankajchaudhary
```

---

## 📜 Documentation Index
- 📘 **[Client Demonstration Guide](docs/CLIENT_DEMO_GUIDE.md):** 7-step institutional executive runbook.
- 📐 **[Architecture Specification](docs/ARCHITECTURE.md):** Deep-dive into Canton sub-transaction privacy and synchronizer topologies.
- 🔌 **[API Reference](docs/API_REFERENCE.md):** Complete TypeScript bridge and REST API endpoint reference.
- 📝 **[Changelog](CHANGELOG.md):** Full release history adhering to Keep a Changelog.
- 📊 **[Development Progress Sheet](PROGRESS.md):** Complete 40-commit milestone breakdown.

---

## 📜 License

Licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) for details.
