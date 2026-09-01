# CantonSyndex — Step-by-Step User Testing Guide

> **Live Application URL:** [https://cantonsyndex.vercel.app](https://cantonsyndex.vercel.app)  
> **Local Server URL:** `http://localhost:3001/`  
> **Version:** `v0.1.0`  
> **Target Audience:** Product Managers, Financial Operations Testers, Credit Risk Officers, QA Engineers, and Enterprise Architects.

---

## 📑 Table of Contents
1. [Overview & Access](#1-overview--access)
2. [Institutional Actor Matrix & Privacy Model](#2-institutional-actor-matrix--privacy-model)
3. [Step-by-Step Test Scenarios](#3-step-by-step-test-scenarios)
   - [Scenario 1: Institutional Authentication & Session Switching](#scenario-1-institutional-authentication--session-switching)
   - [Scenario 2: Facility Headroom & Sub-Transaction Privacy Verification](#scenario-2-facility-headroom--sub-transaction-privacy-verification)
   - [Scenario 3: Pro-Rata Drawdown Request & Atomic Distribution](#scenario-3-pro-rata-drawdown-request--atomic-distribution)
   - [Scenario 4: Bilateral Interest Accrual & Day-Count Conventions](#scenario-4-bilateral-interest-accrual--day-count-conventions)
   - [Scenario 5: Undrawn Commitment Fee Invoicing](#scenario-5-undrawn-commitment-fee-invoicing)
   - [Scenario 6: Real-Time Financial Covenant Compliance Testing](#scenario-6-real-time-financial-covenant-compliance-testing)
   - [Scenario 7: Covenant Breach, Default Notice & Agent Waiver Governance](#scenario-7-covenant-breach-default-notice--agent-waiver-governance)
   - [Scenario 8: Multi-Party Facility Amendment Voting Protocol](#scenario-8-multi-party-facility-amendment-voting-protocol)
   - [Scenario 9: Principal & Interest Repayment Settlement](#scenario-9-principal--interest-repayment-settlement)
   - [Scenario 10: On-Chain Cryptographic Proof & Live SHA-256 Recalculation](#scenario-10-on-chain-cryptographic-proof--live-sha-256-recalculation)
4. [Comprehensive QA Verification Checklist](#4-comprehensive-qa-verification-checklist)
5. [Troubleshooting & FAQs](#5-troubleshooting--faqs)

---

## 1. Overview & Access

**CantonSyndex** is a decentralized syndicated loan lifecycle execution platform. It coordinates multi-party credit facilities across major institutional banks while cryptographically isolating confidential bilateral loan terms.

### 🌐 Access Methods
- **Production Web App:** [https://cantonsyndex.vercel.app](https://cantonsyndex.vercel.app)
- **Local Dev Server:** `http://localhost:3001/` (Run `npm run server` from repo root)

---

## 2. Institutional Actor Matrix & Privacy Model

The application models a **$100,000,000 USD** Syndicated Revolving Credit Facility among 5 real-world financial entities:

| Institution | Role | Badge | Tranche Allocation | Margin Spread | Permissions & Actions |
|---|---|:---:|:---:|:---:|---|
| **Goldman Sachs** | Lead Arranger / Facility Agent | `GS` | Arranger / Agent | N/A | Coordinate disbursements, execute amendments, grant covenant waivers, trigger facility deactivation |
| **Amazon Capital** | Obligor / Syndicate Borrower | `AC` | Obligor ($100M Limit) | N/A | Request drawdowns, settle repayments, submit quarterly compliance certificates, propose facility amendments |
| **JPMorgan Chase** | Senior Tranche A Lender (US) | `JPM` | $60,000,000 USD (60%) | SOFR + 150 bps (1.50%) | Inspect Tranche A, collect interest/fees, vote on amendment proposals |
| **Deutsche Bank** | Senior Tranche B Lender (EU) | `DB` | $40,000,000 USD (40%) | EURIBOR + 175 bps (1.75%) | Inspect Tranche B, collect interest/fees, vote on amendment proposals |
| **Federal Reserve** | Regulatory Observer / Auditor | `FED` | Observer | N/A | Supervise immutable regulatory audit stream and monitor covenant compliance |

---

## 3. Step-by-Step Test Scenarios

---

### Scenario 1: Institutional Authentication & Session Switching

**Objective:** Verify per-party JWT authentication, session persistence, and dynamic UI theme rendering.

1. Open **[https://cantonsyndex.vercel.app](https://cantonsyndex.vercel.app)** in your browser.
2. The **Select Participant Institution** overlay will appear.
3. Observe the dropdown options:
   - `Goldman Sachs (Lead Arranger / Facility Agent)` *(Selected by default)*
   - `Amazon Capital (Obligor / Borrower)`
   - `JPMorgan Chase (Senior Lender US)`
   - `Deutsche Bank (Senior Lender EU)`
   - `Federal Reserve (Auditor / Observer)`
4. Leave the token as `local-dev-jwt` and Network Mode as `Interactive Sandbox`.
5. Click **Authenticate & Enter Dashboard**.
6. **Expected Results:**
   - The login modal smoothly transitions away.
   - The top navigation bar displays the active institution badge **`GS`** and name **`Goldman Sachs (Lead Arranger / Agent)`**.
   - The **Overview** tab is displayed by default.
   - The network status pill indicates **`⚡ Interactive Sandbox`**.

---

### Scenario 2: Facility Headroom & Sub-Transaction Privacy Verification

**Objective:** Verify that aggregate facility headroom is accurately tracked while individual lender margins remain confidential.

1. While logged in as **Goldman Sachs (`GS`)**, inspect the **Overview** tab:
   - **Total Facility Limit:** `$100,000,000 USD`
   - **Drawn Principal:** `$20,000,000 USD` (20% Utilization)
   - **Available Headroom:** `$80,000,000 USD`
2. Inspect the **Privacy Topology Grid**:
   - Verify that Goldman Sachs and Amazon Capital maintain full visibility over the facility envelope.
   - Verify that JPMorgan Chase and Deutsche Bank maintain isolated bilateral visibility.
3. Navigate to the **Tranches** tab:
   - Notice that as Facility Agent, Goldman Sachs sees both **JPMorgan Chase ($60M @ 150 bps)** and **Deutsche Bank ($40M @ 175 bps)**.
4. Now, switch perspective to **`JPMorgan Chase`** using the party dropdown in the top header:
   - Navigate to the **Tranches** tab.
   - Notice that JPMorgan Chase only views its own Tranche A ($60M commitment).
5. Switch perspective to **`Deutsche Bank`**:
   - Notice that Deutsche Bank only views its own Tranche B ($40M commitment).

---

### Scenario 3: Pro-Rata Drawdown Request & Atomic Distribution

**Objective:** Test borrower drawdown requests and verify automated mathematical pro-rata allocation across syndicate lenders.

1. Switch active perspective to **`Amazon Capital`** (`AC`) or **`Goldman Sachs`** (`GS`).
2. Click the **Drawdown** tab in the top navigation.
3. In the **Execute Syndicate Drawdown** form, fill in:
   - **Drawdown Amount (USD):** `10000000` ($10,000,000 USD)
   - **Notice Reference:** `DRAW-2026-002`
   - **Execution Date:** Today's date (pre-filled)
4. Click **Request & Execute Drawdown**.
5. **Expected Results:**
   - A green success toast notification appears: `Drawdown DRAW-2026-002 executed successfully!`.
   - The **Total Facility Drawn** increases from `$20,000,000` to `$30,000,000` (Utilization increases to 30%).
   - **Pro-Rata Allocation Verified:**
     - **JPMorgan Chase (60%):** Drawn amount increases from `$12,000,000` to `$18,000,000` (+$6,000,000).
     - **Deutsche Bank (40%):** Drawn amount increases from `$8,000,000` to `$12,000,000` (+$4,000,000).
   - A new event card for `DRAW-2026-002 · $10,000,000 USD` appears in the **Recent Drawdown Events** list with a `[ 🛡️ Proof ]` button.

---

### Scenario 4: Bilateral Interest Accrual & Day-Count Conventions

**Objective:** Validate multi-convention interest calculation engine over reference base rates and margin spreads.

1. Navigate to the **Interest** tab.
2. Review the active bilateral interest accrual cards:
   - **JPMorgan Chase Tranche A:** SOFR (5.30%) + 150 bps = **6.80% p.a.** on drawn balance.
   - **Deutsche Bank Tranche B:** SOFR (5.30%) + 175 bps = **7.05% p.a.** on drawn balance.
3. In the **Trigger Interest Accrual Cycle** form:
   - **Select Tranche:** `JPMorgan Chase — Tranche A ($60M @ 150 bps)`
   - **Calculation Date:** Today's date
   - **Day-Count Convention:** Select `Actual/365 Fixed`, `Actual/360`, or `30/360`.
4. Click **Trigger Daily Accrual**.
5. **Expected Results:**
   - Success toast appears indicating accrued interest computed.
   - The **Cumulative Accrued Interest** KPI updates.
   - A timestamped payment collection receipt is appended to the **Interest Accrual History** stream.

---

### Scenario 5: Undrawn Commitment Fee Invoicing

**Objective:** Verify automated fee accrual on undrawn liquidity capacity.

1. Navigate to the **Commitment Fees** tab.
2. Review the undrawn liquidity metrics:
   - **JPMorgan Chase Undrawn:** `$42,000,000 USD` ($60M - $18M drawn) @ 25 bps.
   - **Deutsche Bank Undrawn:** `$28,000,000 USD` ($40M - $12M drawn) @ 30 bps.
3. In the **Accrue & Invoice Commitment Fee** form:
   - **Select Lender:** `JPMorgan Chase`
   - **Billing Period Days:** `90` (Quarterly)
4. Click **Accrue Commitment Fee**.
5. **Expected Results:**
   - Success notification confirms fee invoice generation.
   - A new fee receipt card appears under **Fee Collection Receipts**.

---

### Scenario 6: Real-Time Financial Covenant Compliance Testing

**Objective:** Test the 4 core financial ratios against borrower compliance certificates.

1. Navigate to the **Covenants** tab.
2. Inspect the live ratio cards:
   - **Leverage Ratio:** `3.80x` (Limit: Max `4.50x`) ➔ Status: `OK`
   - **Debt Service Coverage (DSCR):** `1.45x` (Limit: Min `1.25x`) ➔ Status: `OK`
   - **Loan-to-Value (LTV):** `62.0%` (Limit: Max `75.0%`) ➔ Status: `OK`
   - **Minimum Liquidity:** `$7,200,000 USD` (Limit: Min `$5,000,000 USD`) ➔ Status: `OK`
3. Under **Execute Quarterly Covenant Test (Agent Controller)**, input passing metrics:
   - **Leverage Ratio:** `3.90`
   - **DSCR:** `1.50`
   - **LTV:** `60.0`
   - **Min Liquidity:** `8000000`
4. Click **Run Compliance Test**.
5. **Expected Results:**
   - Status badge remains green `COMPLIANT`.
   - All 4 cards show green progress bars and `OK` status.

---

### Scenario 7: Covenant Breach, Default Notice & Agent Waiver Governance

**Objective:** Test covenant breach detection, automated default notice acceleration, and formal agent waiver governance.

1. On the **Covenants** tab, submit stressed/breaching financial metrics:
   - **Leverage Ratio:** `5.20` *(Exceeds max 4.50x)*
   - **DSCR:** `1.10` *(Below min 1.25x)*
   - **LTV:** `78.0` *(Exceeds max 75.0%)*
   - **Min Liquidity:** `3000000` *(Below min $5.0M)*
2. Click **Run Compliance Test**.
3. **Expected Results:**
   - Global status banner turns red: **`BREACHED`**.
   - Breached ratio cards turn crimson with warning badges.
   - An on-ledger alert box displays: **`🚨 ON-LEDGER DEFAULT & ACCELERATION NOTICE`**.
4. Now, test the remediation workflow: Click **Waive Breach (Agent Remedy)**.
5. **Expected Results:**
   - Status transitions to amber **`WaivedByAgent`**.
   - Success toast confirms formal waiver recording on the Canton ledger.

---

### Scenario 8: Multi-Party Facility Amendment Voting Protocol

**Objective:** Execute a multi-lender credit limit expansion from $100M to $150M USD using decentralized voting.

1. Navigate to the **Amendments** tab.
2. Review pending proposal `AMEND-2026-001` (Expansion to $150,000,000 USD).
3. Observe the vote tally:
   - **JPMorgan Chase:** `Yes` (Accepted)
   - **Deutsche Bank:** `Pending`
   - Overall Status: `Voting In Progress` (Consent threshold not yet met).
4. Switch perspective to **`Deutsche Bank`** (`DB`) using the header dropdown.
5. On the proposal card, click **Accept Proposal**.
6. **Expected Results:**
   - Deutsche Bank's vote updates to `Deutsche Bank (Yes)`.
   - Proposal badge updates to green **`Consent Reached`**.
7. Switch perspective back to **`Goldman Sachs`** (`GS`):
   - The **Execute Amendment (Unanimous)** button is now enabled.
8. Click **Execute Amendment**.
9. **Expected Results:**
   - Proposal status updates to **`Executed`**.
   - Navigate to the **Overview** tab: The **Master Facility Total Limit** is now updated to **`$150,000,000 USD`**!

---

### Scenario 9: Principal & Interest Repayment Settlement

**Objective:** Settle principal and interest payments and verify headroom restoration.

1. Switch perspective to **`Amazon Capital`** (`AC`) or **`Goldman Sachs`** (`GS`).
2. Navigate to the **Settlement** tab.
3. In the **Settle Facility Repayment** form:
   - **Select Tranche:** `JPMorgan Chase — Tranche A`
   - **Principal Repayment (USD):** `5000000` ($5,000,000 USD)
   - **Interest Payment (USD):** `250000` ($250,000 USD)
4. Click **Execute Settlement & Clear Funds**.
5. **Expected Results:**
   - Green success toast confirms fund clearance.
   - Drawn principal on Tranche A decreases by $5M, restoring $5M of facility headroom.
   - An immutable receipt appears under **Settlement Receipts** with a `[ 🛡️ Proof ]` button.

---

### Scenario 10: On-Chain Cryptographic Proof & Live SHA-256 Recalculation

**Objective:** Inspect Canton blockchain primitives, digital signatures, and execute live client-side hash validation.

1. Navigate to the **Audit Log** tab.
2. Click the **`🛡️ Verify Proof`** button on the first event (**`MasterFacility Created`**).
3. **Inspect the Canton On-Chain Proof Modal:**
   - **Transaction Update ID (Tx Hash):** 64-character hex hash (e.g. `0x8e92f1b4...`)
   - **Contract ID (Canton Multi-Hash):** Formatted as `#12204a9d7e31...:0`
   - **Sequencer Domain:** `canton-sync-domain-main::1220af8...`
   - **Signatures List:** Ed25519 signatures for Goldman Sachs and Amazon Capital with `✓ VERIFIED` badges.
   - **Sub-Transaction Privacy & Blinding Factor:** Confirms privacy isolation for non-stakeholders.
4. Click the **Recalculate & Verify Hash** button.
5. **Expected Results:**
   - A brief calculation spinner appears (`⏳ Computing SHA-256 Digest...`).
   - The badge turns green: **`✓ 100% Verified Valid`**.
   - A success notification confirms: `Canton blockchain cryptographic proof validated with 0 errors.`.
6. Click **Copy Full Proof (JSON)**:
   - Confirms full cryptographic proof JSON is copied to your clipboard.
7. Press the **Escape (`Esc`)** key or click the **`×`** button to dismiss the modal.

---

## 4. Comprehensive QA Verification Checklist

Use this checklist during institutional acceptance testing:

- [ ] **Authentication:** Login modal renders cleanly with 5 real institutional roles.
- [ ] **Header Badge:** Active party chip accurately displays institutional avatar (`GS`, `AC`, `JPM`, `DB`, `FED`).
- [ ] **Overview Headroom:** Dynamic SVG arc gauge updates accurately upon drawdowns and repayments.
- [ ] **Privacy Isolation:** Senior Lenders (JPM, DB) cannot view competing lender commitment cards.
- [ ] **Pro-Rata Calculation:** Drawdowns distribute 60% to JPMorgan Chase and 40% to Deutsche Bank.
- [ ] **Interest Engine:** Daily accrual functions across Actual/365, Actual/360, and 30/360 conventions.
- [ ] **Commitment Fees:** Accrues fees on unused commitment headroom.
- [ ] **Covenant Compliance:** Live ratio cards reflect passing vs breach states with colored alert badges.
- [ ] **Waiver Governance:** Agent waiver transitions breached facility to compliant standing.
- [ ] **Amendment Voting:** Unanimous voting threshold unlocks facility limit expansion to $150M.
- [ ] **Settlement Receipts:** Repayments restore drawn headroom and generate audit receipts.
- [ ] **Proof Modal:** Displays Tx Hash, Contract ID, Ed25519 signatures, and blinding factor.
- [ ] **Live Hash Recalculator:** Web Crypto SHA-256 recalculation passes with zero discrepancies.
- [ ] **Responsive Design:** Dashboard renders cleanly across desktop and laptop viewports.

---

## 5. Troubleshooting & FAQs

### Q: Why do I see fewer tranches when logged in as JPMorgan Chase?
**A:** This is intentional and represents Canton Network's **Sub-Transaction Privacy**. In a syndicated facility, competing lenders must not see each other's margin spreads or bilateral terms. Only the Borrower (Amazon Capital) and Facility Agent (Goldman Sachs) see all tranches.

### Q: Can I run this against a local Canton multi-node cluster?
**A:** Yes! Run `make start` in your terminal to spin up the 4-node Canton Docker cluster, run `make deploy`, and switch the network mode on the dashboard to **Canton LocalNet (Live)**.

### Q: How is the on-chain proof verified?
**A:** The verification engine uses the browser's native **Web Crypto API** (`crypto.subtle.digest('SHA-256', ...)`) to hash the contract identifier, offset, and sequencer timestamp against the Canton synchronizer root.
