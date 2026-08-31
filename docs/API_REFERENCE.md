# CantonSyndex — Complete API & Smart Contract Reference

This document provides complete technical specifications for all 12 DAML smart contracts, data structures, and REST API endpoints within the CantonSyndex ecosystem.

---

## 1. DAML Smart Contracts (`CantonSyndex.Core`)

### `MasterFacility`
Global facility contract governing the aggregate syndicated loan.
- **Signatories:** `borrower`, `agent`
- **Observers:** `optionalToList regulator`
- **Fields:** `facilityId: Text`, `borrower: Party`, `agent: Party`, `currency: Text`, `totalLimit: Decimal`, `drawnAmount: Decimal`, `isActive: Bool`, `regulator: Optional Party`
- **Choices:**
  - `SyndicateTranche` (nonconsuming, `agent`): Provisions bilateral `TrancheParticipation`.
  - `RequestDrawdown` (`borrower`): Increments aggregate `drawnAmount` and creates `DrawdownExecution`.
  - `DeactivateFacility` (`agent`): Archives active contract and sets `isActive = False`.

---

### `TrancheParticipation`
Strict bilateral agreement between Lead Agent and a single participant lender.
- **Signatories:** `agent`, `lender`
- **Observers:** None (Enforces Canton sub-transaction privacy).
- **Fields:** `facilityId: Text`, `agent: Party`, `borrower: Party`, `lender: Party`, `commitmentAmount: Decimal`, `drawnAmount: Decimal`, `marginSpreadBps: Decimal`, `isActive: Bool`
- **Choices:**
  - `ApplyTrancheDrawdown` (`agent`): Increases `drawnAmount`.
  - `SettleRepayment` (`agent`): Decreases `drawnAmount` and creates `RepaymentReceipt`.
  - `SuspendTranche` (`agent`): Suspends tranche operations.

---

### `InterestAccrual`
Tracks period interest accumulation across different day-count conventions.
- **Signatories:** `agent`, `lender`
- **Fields:** `facilityId: Text`, `trancheId: Text`, `agent: Party`, `lender: Party`, `principalBalance: Decimal`, `marginSpreadBps: Decimal`, `baseRateBps: Decimal`, `periodStartDate: Date`, `periodEndDate: Date`, `dayCountConvention: DayCountConvention`, `accruedInterest: Decimal`, `isSettled: Bool`
- **Choices:**
  - `AccrueInterest` (`agent`): Calculates interest up to `accrualDate` via `Actual365Fixed`, `Actual360`, or `Thirty360`.
  - `CollectInterest` (`agent`): Settles interest and creates `InterestPaymentReceipt`.
  - `AdjustPrincipal` (`agent`): Updates principal balance following mid-period drawdowns/repayments.

---

### `InterestPaymentReceipt`
Immutable audit record of an interest settlement.
- **Signatory:** `agent`
- **Observer:** `lender`
- **Fields:** `facilityId`, `trancheId`, `agent`, `lender`, `principalBalance`, `accruedInterest`, `marginSpreadBps`, `baseRateBps`, `dayCountConvention`, `periodStartDate`, `periodEndDate`, `settlementDate`

---

### `CommitmentFeeAccrual`
Calculates fees owed to lenders on the undrawn portion of their credit commitments.
- **Signatories:** `agent`, `lender`
- **Fields:** `facilityId: Text`, `trancheId: Text`, `agent: Party`, `lender: Party`, `commitmentAmount: Decimal`, `drawnAmount: Decimal`, `feeBps: Decimal`, `periodStartDate: Date`, `periodEndDate: Date`, `accruedFee: Decimal`, `isSettled: Bool`
- **Choices:**
  - `AccrueCommitmentFee` (`agent`): Computes fee on `(commitmentAmount - drawnAmount)`.
  - `AdjustDrawnAmount` (`agent`): Resets accrual timer on mid-period draw/repay.
  - `CollectCommitmentFee` (`agent`): Generates `CommitmentFeeReceipt`.

---

### `CommitmentFeeReceipt`
Immutable record of paid commitment fees.
- **Signatory:** `agent`
- **Observer:** `lender`
- **Fields:** `facilityId`, `trancheId`, `agent`, `lender`, `commitmentAmount`, `averageUndrawnAmount`, `feeBps`, `accruedFee`, `periodStartDate`, `periodEndDate`, `settlementDate`

---

### `FacilityCovenants`
Authoritative on-ledger financial covenant monitoring engine.
- **Signatories:** `borrower`, `agent`
- **Observers:** `lenders ++ optionalToList regulator`
- **Fields:** `facilityId`, `borrower`, `agent`, `lenders: [Party]`, `regulator: Optional Party`, `maxLeverageRatio: Decimal`, `minDSCR: Decimal`, `maxLTV: Decimal`, `minLiquidity: Decimal`, `lastTestDate: Date`, `leverageActual: Decimal`, `dscrActual: Decimal`, `ltvActual: Decimal`, `liquidityActual: Decimal`, `breachStatus: CovenantBreachStatus`, `curePeriodDays: Int`
- **Choices:**
  - `TestCovenant` (`agent`): Evaluates all 4 ratios atomically; sets `Compliant` or `Breached`.
  - `WaiveCovenantBreach` (`agent`): Grants formal waiver, setting status to `WaivedByAgent`.
  - `AccelerateOnBreach` (`agent`): Declares loan default and creates `CovenantBreachNotice`.

---

### `CovenantBreachNotice`
Permanent, observable acceleration audit notice for all syndicate participants.
- **Signatory:** `agent`
- **Observers:** `[borrower] ++ lenders ++ optionalToList regulator`
- **Fields:** `facilityId`, `borrower`, `agent`, `lenders`, `regulator`, `accelerationDate`, `leverageAtBreach`, `dscrAtBreach`, `ltvAtBreach`, `liquidityAtBreach`, `noticeText`

---

### `FacilityAmendmentProposal`
Multi-party governance workflow for modifying credit agreements.
- **Signatories:** `borrower`, `agent`
- **Observers:** `lenders`
- **Fields:** `facilityId`, `proposalId`, `borrower`, `agent`, `lenders: [Party]`, `amendmentType: AmendmentType`, `proposedNewLimit: Optional Decimal`, `proposedNewMaturity: Optional Date`, `newLender: Optional Party`, `removedLender: Optional Party`, `rationale: Text`, `proposalDate: Date`, `expiryDate: Date`, `acceptedBy: [Party]`, `rejectedBy: [Party]`
- **Choices:**
  - `AcceptAmendment` (`lender`): Records lender assent.
  - `RejectAmendment` (`lender`): Records lender dissent.
  - `ExecuteAmendment` (`agent`): Verifies voting threshold (unanimous for limit/currency; strict majority for others) and outputs `FacilityAmendmentRecord`.
  - `LapseProposal` (`agent`): Archives expired unapproved proposals.

---

### `FacilityAmendmentRecord`
Immutable ledger record of an approved facility amendment.
- **Signatory:** `agent`
- **Observers:** `[borrower] ++ lenders`
- **Fields:** `facilityId`, `proposalId`, `borrower`, `agent`, `lenders`, `amendmentType`, `proposedNewLimit`, `proposedNewMaturity`, `newLender`, `removedLender`, `rationale`, `proposalDate`, `executionDate`, `acceptedBy`, `rejectedBy`, `totalLenders`, `acceptedCount`

---

### `DrawdownExecution`
Immutable audit trail of loan utilization.
- **Signatories:** `borrower`, `agent`
- **Fields:** `facilityId: Text`, `drawdownId: Text`, `borrower: Party`, `agent: Party`, `amount: Decimal`, `timestamp: Text`

---

### `RepaymentReceipt`
Immutable confirmation of repayment settlement.
- **Signatory:** `agent`
- **Observer:** `lender`
- **Fields:** `facilityId: Text`, `trancheId: Text`, `agent: Party`, `lender: Party`, `principalPaid: Decimal`, `interestPaid: Decimal`, `timestamp: Text`

---

## 2. REST API Specification

| Method | Endpoint | Description | Query / Body Parameters |
|---|---|---|---|
| `GET` | `/api/health` | Service health & participant node status | None |
| `GET` | `/api/facility` | Query Master Facility details & headroom | `facilityId` (query) |
| `GET` | `/api/tranches` | Query visible tranches for active party | `facilityId` (query, optional) |
| `POST` | `/api/drawdown` | Request & execute borrower drawdown | `{ facilityCid, borrowerParty, amount, drawdownId }` |
| `POST` | `/api/repay` | Settle principal & interest for a tranche | `{ trancheCid, principalPaid, interestPaid, timestamp }` |
| `POST` | `/api/interest/accrue` | Accrue interest on a tranche contract | `{ accrualCid, accrualDate }` |
| `POST` | `/api/interest/collect` | Collect & settle accrued interest | `{ accrualCid, settlementDate }` |
| `GET` | `/api/interest/receipts`| List all interest payment receipts | `facilityId` (query, optional) |
| `GET` | `/api/covenants` | Query current facility covenant status | `facilityId` (query) |
| `POST` | `/api/covenants/test` | Submit quarterly compliance certificate | `{ covenantCid, testDate, newLeverage, newDSCR, newLTV, newLiquidity }` |
| `POST` | `/api/fees/accrue` | Accrue undrawn commitment fee | `{ feeCid, accrualDate }` |
| `POST` | `/api/fees/collect` | Settle & collect commitment fees | `{ feeCid, settlementDate }` |
| `POST` | `/api/amendments/vote` | Cast lender vote on proposed amendment | `{ proposalCid, lenderParty }` |
| `POST` | `/api/amendments/execute`| Execute amendment upon threshold met | `{ proposalCid, executionDate }` |
