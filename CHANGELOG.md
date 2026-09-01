# Changelog

All notable changes to the **CantonSyndex** syndicated loan platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-01

### 🚀 Milestone Release — Production-Ready Client Deployment

#### 📜 Core DAML 2.9.4 Smart Contracts (12 Templates)
- **`MasterFacility`:** Multi-party facility governance with aggregated limits, drawdowns, and day-count conventions.
- **`TrancheParticipation`:** Sub-transaction privacy enforcing bilateral commitment allocations and margin spreads.
- **`DrawdownExecution`:** Pro-rata mathematically weighted disbursements with immutable audit trails.
- **`RepaymentReceipt`:** Principal and interest settlement records with ledger timestamps.
- **`InterestAccrual`:** Daily accrual engine supporting Actual/365, Actual/360, and 30/360 interest day-counts.
- **`InterestPaymentReceipt`:** Bilateral lender interest collection audit proofs.
- **`CommitmentFeeAccrual`:** Fee calculations on undrawn commitment bases.
- **`CommitmentFeeReceipt`:** Periodic commitment fee payment records.
- **`FacilityCovenants`:** Automated 4-metric ratio monitoring (Leverage, DSCR, LTV, Minimum Liquidity).
- **`CovenantBreachNotice`:** On-ledger breach notification and loan acceleration governance.
- **`FacilityAmendmentProposal`:** Multi-lender consent voting protocol with unanimous/majority rules.
- **`FacilityAmendmentRecord`:** Executed facility term amendments.

#### 🧪 Verification & DAML Script Test Suites (12 Suites)
- Lifecycle and multi-party privacy isolation tests.
- Mathematical precision and day-count basis calculation tests.
- Covenant breach, waiver workflow, and acceleration tests.
- Commitment fee accrual and mid-period drawdown tests.
- Amendment unanimous/majority voting threshold and expiration tests.

#### 🌉 TypeScript Bridge & REST Server
- **`SyndexLedgerBridge`:** 15 type-safe ledger integration methods over gRPC and HTTP JSON API.
- **REST API Bridge Server:** 14 endpoints serving facility state, tranches, drawdowns, covenants, and amendments.
- **WebSocket Notification Hub (`ws://localhost:3001/ws/notifications`):** RFC 6455 real-time push hub with party filtering, targeted broadcasts, and heartbeat pings.
- **DAML Error Translator:** 12-pattern assertion parser translating raw contract aborts into user-friendly diagnostic guidance.

#### 🎨 Enterprise Operations Dashboard
- **White & Royal Blue Theme:** Clean `#f0f4f9` canvas, `#ffffff` cards, royal blue `#0052cc` brand accents, slate borders, and crisp typography.
- **Real-World Financial Institutions:**
  - Lead Arranger / Facility Agent: **Goldman Sachs (`GS`)**
  - Obligor / Syndicate Borrower: **Amazon Capital (`AC`)**
  - Senior Tranche A Lender (US): **JPMorgan Chase (`JPM`)**
  - Senior Tranche B Lender (EU): **Deutsche Bank (`DB`)**
  - Supervisory Observer: **Federal Reserve (`FED`)**
  - Syndicate Participant Option: **BNP Paribas (`BNP`)**
- **JWT Per-Party Login Overlay:** Dedicated session manager with multi-role authentication.
- **Real-Time ACS Streaming:** Adaptive 8s/30s Active Contract Set synchronization.
- **9 Core Operational Tabs:** Overview, Tranches, Drawdown, Interest Accrual, Commitment Fees, Covenants, Amendments, Settlement, and Regulatory Audit Log.

#### 🛡️ On-Chain Cryptographic Proof & Verification Engine
- Interactive **Canton On-Chain Proof Inspector** modal.
- Transaction Update ID (SHA-256 commit hash), Canton Multi-Hash Contract ID (`#1220...`), Ledger Offset, and Sequencer Domain verification.
- Authorizing Ed25519 multi-party witness digital signature breakdown.
- Sub-transaction privacy tree & blinding factor isolation proofs.
- Live client-side SHA-256 recalculation engine powered by Web Crypto API.
- 1-click JSON cryptographic proof export.

#### 🐳 Canton LocalNet Infrastructure & Tooling
- 4-node `docker-compose.yml` (Canton Synchronizer + 3 Participant Nodes).
- `scripts/wait-for-canton.sh` dynamic port and health probe checker.
- `scripts/deploy.sh` automated DAR build, upload, and multi-party provisioning.
- `scripts/test-e2e.sh` automated 8-stage end-to-end smoke test suite.
- Comprehensive `Makefile` with 20+ automated targets (`make start`, `make deploy`, `make test`, `make demo`, `make status`).
- Institutional documentation: `README.md`, `API_REFERENCE.md`, `ARCHITECTURE.md`, `DEMO_PROTOCOL.md`, `CLIENT_DEMO_GUIDE.md`.
