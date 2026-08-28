/**
 * CantonSyndex TypeScript Contract Interfaces
 * Mirrors the DAML template fields defined in CantonSyndex.Core
 *
 * These interfaces provide type-safe access to Canton contract payloads
 * received via the gRPC Ledger API or Canton TypeScript SDK.
 */

/** ISO 4217 currency code */
export type CurrencyCode = string;

/** Unique facility identifier */
export type FacilityId = string;

/** Unique drawdown identifier */
export type DrawdownId = string;

/** DAML Party identifier (e.g. "GlobalLeadBank::1220abc...") */
export type Party = string;

/** DAML Decimal represented as string to preserve precision */
export type Decimal = string;

/** ISO-8601 timestamp string */
export type Timestamp = string;

/** DAML ContractId (hex-encoded) */
export type ContractId = string;

// ---------------------------------------------------------------------------
// Contract Payload Interfaces
// ---------------------------------------------------------------------------

/**
 * MasterFacility — Global facility contract
 * Signatories: borrower, agent
 * Observer: regulator (optional)
 */
export interface MasterFacilityPayload {
  facilityId: FacilityId;
  borrower: Party;
  agent: Party;
  currency: CurrencyCode;
  totalLimit: Decimal;
  drawnAmount: Decimal;
  isActive: boolean;
  regulator: { tag: "Some"; value: Party } | { tag: "None" };
}

/**
 * TrancheParticipation — Bilateral lender agreement
 * Signatories: agent, lender
 * No observers (strict bilateral privacy)
 */
export interface TrancheParticipationPayload {
  facilityId: FacilityId;
  agent: Party;
  borrower: Party;
  lender: Party;
  commitmentAmount: Decimal;
  drawnAmount: Decimal;
  marginSpreadBps: Decimal;
  isActive: boolean;
}

/**
 * DrawdownExecution — Atomic drawdown audit record
 * Signatories: borrower, agent
 */
export interface DrawdownExecutionPayload {
  facilityId: FacilityId;
  drawdownId: DrawdownId;
  borrower: Party;
  agent: Party;
  amount: Decimal;
  executed: boolean;
}

/**
 * RepaymentReceipt — Lender-specific settlement confirmation
 * Signatory: agent
 * Observer: lender
 */
export interface RepaymentReceiptPayload {
  facilityId: FacilityId;
  agent: Party;
  lender: Party;
  principalPaid: Decimal;
  interestPaid: Decimal;
  timestamp: Timestamp;
}

// ---------------------------------------------------------------------------
// Choice Argument Interfaces
// ---------------------------------------------------------------------------

export interface SyndicateTrancheArgs {
  lender: Party;
  commitmentAmount: Decimal;
  marginSpreadBps: Decimal;
}

export interface RequestDrawdownArgs {
  drawdownId: DrawdownId;
  amount: Decimal;
}

export interface ApplyTrancheDrawdownArgs {
  drawAmount: Decimal;
}

export interface SettleRepaymentArgs {
  principalPaid: Decimal;
  interestPaid: Decimal;
  timestamp: Timestamp;
}

// ---------------------------------------------------------------------------
// Response Interfaces
// ---------------------------------------------------------------------------

export interface CommandResult {
  workflowId: string;
  updateId: string;
  completionOffset: string;
}

export interface ActiveContract<T> {
  contractId: ContractId;
  payload: T;
  createdAt: Timestamp;
}

export interface SyndicateLoanEvent {
  type: "FacilityCreated" | "TrancheSyndicated" | "DrawdownRequested" |
        "DrawdownDistributed" | "RepaymentSettled" | "FacilityDeactivated";
  facilityId: FacilityId;
  contractId: ContractId;
  payload: unknown;
  timestamp: Timestamp;
}
