# CantonSyndex API Reference

## DAML Templates

---

### `CantonSyndex.Core.MasterFacility`

Global facility contract governing the aggregate syndicated loan.

#### Fields

| Field | Type | Description |
|---|---|---|
| `facilityId` | `Text` | Unique facility reference (e.g. `"FAC-2026-USD-100M"`) |
| `borrower` | `Party` | Corporate or sovereign borrower |
| `agent` | `Party` | Lead arranger / facility agent bank |
| `currency` | `Text` | ISO 4217 currency code (e.g. `"USD"`) |
| `totalLimit` | `Decimal` | Maximum aggregate credit commitment |
| `drawnAmount` | `Decimal` | Current aggregate drawn amount |
| `isActive` | `Bool` | Whether facility is open for drawdowns |
| `regulator` | `Optional Party` | Read-only compliance observer |

#### Invariants
- `totalLimit > 0.0`
- `drawnAmount >= 0.0`
- `drawnAmount <= totalLimit`

#### Choices

##### `SyndicateTranche` (nonconsuming)
- **Controller**: `agent`
- **Args**: `lender: Party`, `commitmentAmount: Decimal`, `marginSpreadBps: Decimal`
- **Returns**: `ContractId TrancheParticipation`
- **Effect**: Creates a bilateral `TrancheParticipation` contract visible only to `agent` and `lender`

##### `RequestDrawdown`
- **Controller**: `borrower`
- **Args**: `drawdownId: Text`, `amount: Decimal`
- **Returns**: `(ContractId MasterFacility, ContractId DrawdownExecution)`
- **Effect**: Archives old facility, creates updated facility with incremented `drawnAmount`, creates `DrawdownExecution` audit record

##### `DeactivateFacility`
- **Controller**: `agent`
- **Args**: *(none)*
- **Returns**: `ContractId MasterFacility`
- **Effect**: Creates new facility with `isActive = False`

---

### `CantonSyndex.Core.TrancheParticipation`

Strict bilateral agreement between Lead Agent and a single participant lender.

#### Fields

| Field | Type | Description |
|---|---|---|
| `facilityId` | `Text` | Reference to parent MasterFacility |
| `agent` | `Party` | Lead Arranger |
| `borrower` | `Party` | Borrower (not a signatory — stored for context) |
| `lender` | `Party` | This specific participant bank |
| `commitmentAmount` | `Decimal` | Maximum this lender has agreed to fund |
| `drawnAmount` | `Decimal` | Currently drawn from this lender's commitment |
| `marginSpreadBps` | `Decimal` | Bilaterally negotiated margin in basis points |
| `isActive` | `Bool` | Whether tranche is open for drawdowns |

#### Invariants
- `commitmentAmount > 0.0`
- `drawnAmount >= 0.0`
- `drawnAmount <= commitmentAmount`

#### Choices

##### `ApplyTrancheDrawdown`
- **Controller**: `agent`
- **Args**: `drawAmount: Decimal`
- **Returns**: `ContractId TrancheParticipation`
- **Effect**: Increments `drawnAmount` by `drawAmount`

##### `SettleRepayment`
- **Controller**: `agent`
- **Args**: `principalPaid: Decimal`, `interestPaid: Decimal`, `timestamp: Text`
- **Returns**: `(ContractId TrancheParticipation, ContractId RepaymentReceipt)`
- **Effect**: Decrements `drawnAmount`, creates immutable `RepaymentReceipt`

##### `SuspendTranche`
- **Controller**: `agent`
- **Args**: *(none)*
- **Returns**: `ContractId TrancheParticipation`
- **Effect**: Sets `isActive = False`

---

### `CantonSyndex.Core.DrawdownExecution`

Immutable audit record of a borrower drawdown event.

#### Fields

| Field | Type | Description |
|---|---|---|
| `facilityId` | `Text` | Reference to parent MasterFacility |
| `drawdownId` | `Text` | Unique drawdown reference |
| `borrower` | `Party` | Borrower who triggered the drawdown |
| `agent` | `Party` | Lead Agent responsible for distribution |
| `amount` | `Decimal` | Total drawdown amount |
| `executed` | `Bool` | Whether agent has distributed to all tranches |

#### Invariants
- `amount > 0.0`

#### Choices

##### `MarkDrawdownExecuted`
- **Controller**: `agent`
- **Args**: *(none)*
- **Returns**: `ContractId DrawdownExecution`
- **Effect**: Sets `executed = True`

---

### `CantonSyndex.Core.RepaymentReceipt`

Immutable, lender-specific settlement confirmation.

#### Fields

| Field | Type | Description |
|---|---|---|
| `facilityId` | `Text` | Reference to parent MasterFacility |
| `agent` | `Party` | Lead Agent who processed the repayment |
| `lender` | `Party` | Participant lender receiving the confirmation |
| `principalPaid` | `Decimal` | Principal amount repaid |
| `interestPaid` | `Decimal` | Interest amount paid |
| `timestamp` | `Text` | ISO-8601 settlement timestamp |

#### Invariants
- `principalPaid >= 0.0`
- `interestPaid >= 0.0`

#### Signatories / Observers
- **Signatory**: `agent`
- **Observer**: `lender` (read-only — lender cannot modify)

---

## TypeScript Bridge API

### `SyndexLedgerBridge`

```typescript
const bridge = new SyndexLedgerBridge(
  participantEndpoint: string,  // Canton Participant Node URL
  authToken: string,             // Canton JWT token
  applicationId?: string         // Default: "CantonSyndex-Bridge"
);
```

#### Methods

| Method | Args | Returns | Description |
|---|---|---|---|
| `createMasterFacility` | `actAs`, `payload` | `CommandResult` | Create facility (multi-party) |
| `allocateTranche` | `cid`, `agent`, `args` | `CommandResult` | SyndicateTranche choice |
| `requestDrawdown` | `cid`, `borrower`, `args` | `CommandResult` | RequestDrawdown choice |
| `applyTrancheDrawdown` | `cid`, `agent`, `args` | `CommandResult` | ApplyTrancheDrawdown choice |
| `settleRepayment` | `cid`, `agent`, `args` | `CommandResult` | SettleRepayment choice |
| `streamPositions` | `party`, `onUpdate`, `onError?` | `() => void` | Real-time ACS stream |
| `streamRepaymentReceipts` | `party`, `onUpdate`, `onError?` | `() => void` | Receipt stream |
| `queryFacility` | `party`, `facilityId` | `ActiveContract \| null` | Query facility |
| `subscribeToEvents` | `party`, `onEvent`, `onError?` | `() => void` | Aggregate event subscription |

---

## Types Module

### `CantonSyndex.Types`

```daml
calculateInterest : Decimal -> BasisPoints -> Int -> Decimal
```
Computes interest using actual/365 day-count convention.

```daml
calculateProRataShare : Decimal -> Decimal -> Decimal -> Decimal
```
Computes `(lenderCommitment / totalCommitment) * totalAmount`.
