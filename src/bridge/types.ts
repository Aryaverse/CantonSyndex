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
        "DrawdownDistributed" | "RepaymentSettled" | "FacilityDeactivated" |
        "InterestAccrued" | "InterestCollected" |
        "CovenantTested" | "CovenantBreached" | "CovenantAccelerated" |
        "FeeAccrued" | "FeeCollected" |
        "AmendmentProposed" | "AmendmentExecuted";
  facilityId: FacilityId;
  contractId: ContractId;
  payload: unknown;
  timestamp: Timestamp;
}

// ---------------------------------------------------------------------------
// Day-Count Convention
// ---------------------------------------------------------------------------
export type DayCountConvention = "Actual365Fixed" | "Actual360" | "Thirty360";

// ---------------------------------------------------------------------------
// Interest Accrual Types
// ---------------------------------------------------------------------------
export interface InterestAccrualPayload {
  facilityId: string;
  trancheId: string;
  agent: Party;
  lender: Party;
  principalBalance: number;
  marginSpreadBps: number;
  baseRateBps: number;
  periodStartDate: string;    // ISO date: "YYYY-MM-DD"
  periodEndDate: string;
  dayCountConvention: { tag: DayCountConvention; value: Record<string, never> };
  accruedInterest: number;
  isSettled: boolean;
}

export interface InterestPaymentReceiptPayload {
  facilityId: string;
  trancheId: string;
  agent: Party;
  lender: Party;
  principalBalance: number;
  accruedInterest: number;
  marginSpreadBps: number;
  baseRateBps: number;
  dayCountConvention: { tag: DayCountConvention; value: Record<string, never> };
  periodStartDate: string;
  periodEndDate: string;
  settlementDate: string;
}

// ---------------------------------------------------------------------------
// Covenant Tracking Types
// ---------------------------------------------------------------------------
export type CovenantBreachStatus =
  | "Compliant"
  | "Breached"
  | "WaivedByAgent"
  | "Accelerated";

export interface FacilityCovenantsPayload {
  facilityId: string;
  borrower: Party;
  agent: Party;
  lenders: Party[];
  regulator: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  maxLeverageRatio: number;
  minDSCR: number;
  maxLTV: number;
  minLiquidity: number;
  lastTestDate: string;
  leverageActual: number;
  dscrActual: number;
  ltvActual: number;
  liquidityActual: number;
  breachStatus: { tag: CovenantBreachStatus; value: Record<string, never> };
  curePeriodDays: number;
}

export interface CovenantBreachNoticePayload {
  facilityId: string;
  borrower: Party;
  agent: Party;
  lenders: Party[];
  regulator: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  accelerationDate: string;
  leverageAtBreach: number;
  dscrAtBreach: number;
  ltvAtBreach: number;
  liquidityAtBreach: number;
  noticeText: string;
}

// ---------------------------------------------------------------------------
// Commitment Fee Types
// ---------------------------------------------------------------------------
export interface CommitmentFeeAccrualPayload {
  facilityId: string;
  trancheId: string;
  agent: Party;
  lender: Party;
  commitmentAmount: number;
  drawnAmount: number;
  feeBps: number;
  periodStartDate: string;
  periodEndDate: string;
  accruedFee: number;
  isSettled: boolean;
}

export interface CommitmentFeeReceiptPayload {
  facilityId: string;
  trancheId: string;
  agent: Party;
  lender: Party;
  commitmentAmount: number;
  averageUndrawnAmount: number;
  feeBps: number;
  accruedFee: number;
  periodStartDate: string;
  periodEndDate: string;
  settlementDate: string;
}

// ---------------------------------------------------------------------------
// Facility Amendment Types
// ---------------------------------------------------------------------------
export type AmendmentType =
  | "IncreaseCreditLimit"
  | "ExtendMaturity"
  | "AddLender"
  | "RemoveLender"
  | "ReduceCreditLimit"
  | "ChangeCurrency";

export interface FacilityAmendmentProposalPayload {
  facilityId: string;
  proposalId: string;
  borrower: Party;
  agent: Party;
  lenders: Party[];
  amendmentType: { tag: AmendmentType; value: Record<string, never> };
  proposedNewLimit: { tag: "Some"; value: number } | { tag: "None"; value: Record<string, never> };
  proposedNewMaturity: { tag: "Some"; value: string } | { tag: "None"; value: Record<string, never> };
  newLender: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  removedLender: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  rationale: string;
  proposalDate: string;
  expiryDate: string;
  acceptedBy: Party[];
  rejectedBy: Party[];
}

export interface FacilityAmendmentRecordPayload {
  facilityId: string;
  proposalId: string;
  borrower: Party;
  agent: Party;
  lenders: Party[];
  amendmentType: { tag: AmendmentType; value: Record<string, never> };
  proposedNewLimit: { tag: "Some"; value: number } | { tag: "None"; value: Record<string, never> };
  proposedNewMaturity: { tag: "Some"; value: string } | { tag: "None"; value: Record<string, never> };
  newLender: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  removedLender: { tag: "Some"; value: Party } | { tag: "None"; value: Record<string, never> };
  rationale: string;
  proposalDate: string;
  executionDate: string;
  acceptedBy: Party[];
  rejectedBy: Party[];
  totalLenders: number;
  acceptedCount: number;
}

