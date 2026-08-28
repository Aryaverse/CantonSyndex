# CantonSyndex Architecture Documentation

## 1. System Overview

CantonSyndex is built on two core technology pillars:

| Layer | Technology | Purpose |
|---|---|---|
| Smart Contract | DAML 2.9.4 | Multi-party business logic with privacy invariants |
| Distributed Ledger | Canton Network | Cryptographic sub-transaction privacy |
| Off-chain Integration | TypeScript / gRPC Ledger API | Enterprise core banking connectivity |
| Frontend | Vanilla HTML/CSS/JS | Operations dashboard & demo interface |

---

## 2. Canton Network Topology

```
                    ┌──────────────────────────────────────────┐
                    │         Canton Synchronizer              │
                    │  (Shared Distributed State Machine)      │
                    │  No cleartext data — only commitments    │
                    └──────┬──────────────────┬───────────────┘
                           │                  │
              ┌────────────┘     ┌────────────┘
              │                  │
  ┌───────────▼──────┐  ┌────────▼──────────┐  ┌──────────────────┐
  │  Participant A   │  │  Participant B     │  │  Participant C   │
  │  GlobalLeadBank  │  │  AlphaBank         │  │  BetaBank        │
  │                  │  │                   │  │                  │
  │  Contracts:      │  │  Contracts:       │  │  Contracts:      │
  │  MasterFacility  │  │  TranchePartA     │  │  TranchePartB   │
  │  DrawdownExec.   │  │  RepaymentRcptA   │  │  RepaymentRcptB │
  │  All Receipts    │  │  (Own only)       │  │  (Own only)     │
  └──────────────────┘  └───────────────────┘  └──────────────────┘
```

**Key principle**: Canton Participant Nodes do NOT share a common database.
Each node holds cryptographic commitments for contracts in which the node's
hosted party is a signatory or observer. The Synchronizer coordinates global
state without ever seeing unencrypted contract payloads.

---

## 3. DAML Privacy Model

### Sub-Transaction Privacy

Canton achieves privacy via **view decomposition**: when a transaction creates
multiple contracts (e.g., `RequestDrawdown` creates a new `MasterFacility` AND
a `DrawdownExecution`), each sub-tree is encrypted separately and sent only to
the parties whose nodes need it.

```
RequestDrawdown Transaction
├── SubView 1: Update MasterFacility         → borrower, agent
└── SubView 2: Create DrawdownExecution      → borrower, agent
    (Neither view touches TrancheParticipation, so lenders see nothing)
```

### Signatory & Observer Rules

| Contract | Signatories | Observers | Canton Visibility |
|---|---|---|---|
| `MasterFacility` | borrower, agent | [regulator] | Only borrower, agent, regulator nodes |
| `TrancheParticipation` | agent, lender | — | **Only** agent + specific lender node |
| `DrawdownExecution` | borrower, agent | — | Only borrower, agent |
| `RepaymentReceipt` | agent | lender | Agent + specific lender (read-only) |

### Cryptographic Guarantee

Bank A's participation in `AlphaBank::TrancheParticipation` is encrypted
under a key that BetaBank's participant node does not possess. This is not
application-level RBAC — it is enforced by the Canton cryptographic protocol.
A compromised database at BetaBank's data center reveals zero information
about AlphaBank's commitment, margin spread, or drawn balance.

---

## 4. Smart Contract State Machine

```
MasterFacility
     │
     ├─[SyndicateTranche]──→ TrancheParticipation (per lender)
     │                            │
     │                            ├─[ApplyTrancheDrawdown]──→ TrancheParticipation'
     │                            │
     │                            └─[SettleRepayment]──→ (TrancheParticipation', RepaymentReceipt)
     │
     ├─[RequestDrawdown]──→ (MasterFacility', DrawdownExecution)
     │                            │
     │                            └─[MarkDrawdownExecuted]──→ DrawdownExecution'
     │
     └─[DeactivateFacility]──→ MasterFacility (isActive=False)
```

---

## 5. Contract Invariants

### MasterFacility
```
totalLimit > 0.0
drawnAmount >= 0.0
drawnAmount <= totalLimit
```

### TrancheParticipation
```
commitmentAmount > 0.0
drawnAmount >= 0.0
drawnAmount <= commitmentAmount
```

### DrawdownExecution
```
amount > 0.0
```

### RepaymentReceipt
```
principalPaid >= 0.0
interestPaid >= 0.0
```

---

## 6. Choice Authorization Matrix

| Choice | Contract | Controller | Effect |
|---|---|---|---|
| `SyndicateTranche` | MasterFacility | agent | Creates TrancheParticipation |
| `RequestDrawdown` | MasterFacility | borrower | Updates facility + creates DrawdownExecution |
| `DeactivateFacility` | MasterFacility | agent | Sets isActive = False |
| `ApplyTrancheDrawdown` | TrancheParticipation | agent | Updates tranche drawn amount |
| `SettleRepayment` | TrancheParticipation | agent | Reduces drawn amount + creates RepaymentReceipt |
| `SuspendTranche` | TrancheParticipation | agent | Sets isActive = False |
| `MarkDrawdownExecuted` | DrawdownExecution | agent | Sets executed = True |

---

## 7. TypeScript Bridge Architecture

```
Enterprise Core Banking System
          │
          │ REST / gRPC
          ▼
┌─────────────────────────────┐
│     SyndexLedgerBridge      │
│                             │
│  createMasterFacility()     │
│  allocateTranche()          │
│  requestDrawdown()          │
│  applyTrancheDrawdown()     │
│  settleRepayment()          │
│  streamPositions()          │
│  streamRepaymentReceipts()  │
│  subscribeToEvents()        │
└─────────────┬───────────────┘
              │
              │ Canton Ledger API (gRPC / HTTP JSON)
              ▼
┌─────────────────────────────┐
│   Canton Participant Node   │
│   (Bank's own node)         │
└─────────────────────────────┘
```

---

## 8. Security Considerations

1. **JWT Authentication**: Each participant node uses Canton-issued JWT tokens scoped to party identifiers. The `SyndexLedgerBridge` accepts an `authToken` that must be rotated per session.

2. **Multi-party Authorization**: Choices like `SyndicateTranche` require the agent's JWT. Choices like `RequestDrawdown` require the borrower's JWT. Canton rejects submissions with incorrect authorization.

3. **Deduplication**: All command submissions include a `workflowId` with a timestamp for Canton's built-in command deduplication.

4. **Regulator Isolation**: The regulator is an observer on `MasterFacility` only. They can audit the facility cap and aggregate terms, but cannot see any bilateral tranche details.
