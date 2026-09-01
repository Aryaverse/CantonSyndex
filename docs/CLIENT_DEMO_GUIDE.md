# CantonSyndex — Institutional Client Demonstration Guide

> **Target Audience:** Chief Operating Officers, Heads of Syndicated Lending, Credit Risk Officers, and Enterprise Blockchain Architects at Major Financial Institutions.
> **Participants:** Goldman Sachs (Lead Arranger / Agent), JPMorgan Chase (US Senior Lender), Deutsche Bank (EU Senior Lender), Amazon Capital (Obligor / Borrower), Federal Reserve (Auditor / Observer).

---

## 🏛️ Executive Summary

**CantonSyndex** is a production-grade syndicated lending operations platform built on **Canton Network** and **DAML 2.9.4**. It automates the complete multi-institution lifecycle of multi-currency, multi-tranche credit facilities while enforcing **sub-transaction cryptographic privacy**.

Unlike public blockchains where financial commitments and interest margins are visible to all nodes, Canton ensures that:
- **JPMorgan Chase** can only inspect Tranche A ($60M @ 150 bps) and its own interest accrual.
- **Deutsche Bank** can only inspect Tranche B ($40M @ 175 bps) and its own interest accrual.
- **Amazon Capital** sees the aggregated facility utilization ($100M total limit, $20M drawn) without leaking bilateral lender margins.
- **Goldman Sachs (Agent)** coordinates pro-rata disbursements and quarterly covenant attestations.
- **Federal Reserve** exercises real-time audit supervision without manual reporting delays.

---

## 🚀 5-Minute Live Interactive Demo Protocol

### Step 1: Institutional Authentication & Session Selection
1. Open the operations dashboard at **`http://localhost:3001/`**.
2. Select **`Goldman Sachs (Lead Arranger / Agent)`** from the institutional dropdown.
3. Click **Authenticate & Enter Dashboard**.
4. Notice the active session chip in the top-right header displaying the **`GS`** institutional badge.

### Step 2: Facility Overview & Sub-Transaction Privacy Topology
1. On the **Overview** tab, review the **$100,000,000 USD** Master Credit Facility.
2. Inspect the **Privacy Topology Grid**:
   - Verify that Goldman Sachs and Amazon Capital maintain full facility stakeholder status.
   - Verify that JPMorgan Chase and Deutsche Bank maintain strict bilateral privacy boundaries.
3. Switch the top party selector to **`JPMorgan Chase (Senior Lender US)`**:
   - Observe how the dashboard view instantly recalibrates to JPMorgan's visible contracts.

### Step 3: Pro-Rata Drawdown Execution
1. Switch back to **`Goldman Sachs`** or **`Amazon Capital`**.
2. Navigate to the **Drawdown** tab.
3. Enter a new drawdown request for **`$10,000,000 USD`** with Notice Reference `DRAW-2026-002`.
4. Click **Request & Execute Drawdown**.
5. Observe the automated mathematical pro-rata distribution:
   - **JPMorgan Chase (60%):** Receives `$6,000,000` tranche allocation.
   - **Deutsche Bank (40%):** Receives `$4,000,000` tranche allocation.
6. A success alert is triggered with the ledger transaction hash.

### Step 4: Bilateral Interest Accrual & Day-Count Conventions
1. Navigate to the **Interest** tab.
2. Review the bilateral contracts:
   - **JPMorgan Chase:** SOFR + 150 bps (6.80% p.a.) on $18,000,000 drawn basis.
   - **Deutsche Bank:** EURIBOR/SOFR + 175 bps (7.05% p.a.) on $12,000,000 drawn basis.
3. Select an accrual calculation date and click **Trigger Daily Accrual**.
4. Review the generated payment receipts.

### Step 5: Real-Time Covenant Engine & Breach Governance
1. Navigate to the **Covenants** tab.
2. Review the 4 core institutional financial covenants:
   - **Leverage Ratio:** Current `3.80x` (Maximum `4.50x`) ➔ `OK`
   - **Debt Service Coverage (DSCR):** Current `1.45x` (Minimum `1.25x`) ➔ `OK`
   - **Loan-to-Value (LTV):** Current `62.0%` (Maximum `75.0%`) ➔ `OK`
   - **Minimum Liquidity:** Current `$7,200,000` (Minimum `$5,000,000`) ➔ `OK`
3. Execute a simulated covenant test with stress metrics (e.g. Leverage: `4.90x`):
   - The ratio card turns crimson with an instant `BREACH` badge.
   - An immutable on-ledger Default Notice is triggered to all stakeholders.
4. Click **Waive Breach (Agent Remedy)** to demonstrate structured multi-party remediation governance.

### Step 6: Multi-Party Facility Amendment Voting Protocol
1. Navigate to the **Amendments** tab.
2. Review the pending amendment `AMEND-2026-001` ($50M Credit Expansion for European Renewable Projects).
3. Switch active perspective to **`Deutsche Bank`** (`DB`).
4. Click **Accept Proposal** to cast Deutsche Bank's consenting vote.
5. Switch back to **`Goldman Sachs`** (`GS`):
   - Once unanimous/majority consent is reached, the **Execute Amendment** button becomes active.
   - Executing the amendment updates the Master Facility limit on-chain to **`$150,000,000 USD`**.

### Step 7: Cryptographic Proof & Ledger Verification
1. Navigate to the **Audit Log** tab.
2. Click the **`🛡️ Verify Proof`** button on any event.
3. The **Canton On-Chain Proof Inspector** opens:
   - Inspect the **Transaction Update ID (Tx Hash)** and **Canton Contract ID (`#1220...`)**.
   - Review the Ed25519 digital signatures from Goldman Sachs and Amazon Capital.
   - Inspect the **Sub-Transaction Privacy & Blinding Factor Proof**.
4. Click **Recalculate & Verify Hash**:
   - The browser computes a live SHA-256 digest validating cryptographic integrity against the ledger synchronizer root with **0 discrepancies**.
5. Click **Copy Full Proof (JSON)** to export audit data for compliance records.

---

## 🛠️ Verification Commands

```bash
# Run all DAML smart contract test suites
daml test --all

# Launch Canton LocalNet 4-node cluster with automated health checks
make start

# Build DAR, upload to participant nodes, and provision parties
make deploy

# Launch TypeScript REST Bridge & WebSocket Server
npm run server

# Run end-to-end smoke test suite
./scripts/test-e2e.sh
```
