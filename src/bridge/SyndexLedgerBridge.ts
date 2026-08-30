/**
 * SyndexLedgerBridge
 * Canton Ledger API Bridge for CantonSyndex
 *
 * Provides a type-safe TypeScript interface for enterprise core banking systems
 * to connect to their Canton Participant Node and interact with CantonSyndex
 * smart contracts via the gRPC Ledger API.
 *
 * @example
 * const bridge = new SyndexLedgerBridge(
 *   "https://participant.mybank.canton.network:8080",
 *   authToken,
 *   "GlobalLeadBank::1220abc..."
 * );
 *
 * const result = await bridge.allocateTranche(
 *   facilityCid, agentParty, "AlphaBank::...", 60_000_000, 150.0
 * );
 */

import {
  MasterFacilityPayload,
  TrancheParticipationPayload,
  DrawdownExecutionPayload,
  RepaymentReceiptPayload,
  SyndicateTrancheArgs,
  RequestDrawdownArgs,
  ApplyTrancheDrawdownArgs,
  SettleRepaymentArgs,
  CommandResult,
  ActiveContract,
  SyndicateLoanEvent,
  ContractId,
  Party,
  FacilityId,
} from "./types";

// ---------------------------------------------------------------------------
// Canton Ledger API client interface (abstracted for testability)
// In production, replace with @canton-network/dapp-sdk LedgerApiClient
// ---------------------------------------------------------------------------
interface LedgerApiClientConfig {
  baseUrl: string;
  token: string;
  applicationId?: string;
}

interface SubmitAndWaitRequest {
  actAs: Party[];
  readAs?: Party[];
  commands: CommandSpec[];
  workflowId?: string;
  deduplicationPeriod?: { seconds: number };
}

interface CommandSpec {
  templateId: string;
  contractId?: ContractId;
  choice?: string;
  argument?: Record<string, unknown>;
  createArgument?: Record<string, unknown>;
}

interface ACSStreamRequest {
  eventFormat: {
    filtersByParty: Record<string, {
      templateFilters: Array<{ templateType: string }>;
    }>;
  };
  onData: (res: { activeContracts: Array<ActiveContract<unknown>> }) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Template IDs (must match daml.yaml name + module path)
// ---------------------------------------------------------------------------
const TEMPLATE_IDS = {
  MasterFacility:        "CantonSyndex.Core:MasterFacility",
  TrancheParticipation:  "CantonSyndex.Core:TrancheParticipation",
  DrawdownExecution:     "CantonSyndex.Core:DrawdownExecution",
  RepaymentReceipt:      "CantonSyndex.Core:RepaymentReceipt",
} as const;

// ---------------------------------------------------------------------------
// SyndexLedgerBridge
// ---------------------------------------------------------------------------
export class SyndexLedgerBridge {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly applicationId: string;

  constructor(
    participantEndpoint: string,
    authToken: string,
    applicationId: string = "CantonSyndex-Bridge"
  ) {
    this.baseUrl      = participantEndpoint.replace(/\/$/, "");
    this.token        = authToken;
    this.applicationId = applicationId;
  }

  // -------------------------------------------------------------------------
  // Private: Execute a gRPC/HTTP command via Canton Ledger API
  // -------------------------------------------------------------------------
  private async submitAndWait(request: SubmitAndWaitRequest): Promise<CommandResult> {
    const workflowId = request.workflowId ?? `SYNDEX-${Date.now()}`;
    const body = {
      ...request,
      workflowId,
      applicationId: this.applicationId,
    };

    const response = await fetch(`${this.baseUrl}/v1/commands/submit-and-wait`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Canton Ledger API error [${response.status}]: ${errorText}`);
    }

    return response.json() as Promise<CommandResult>;
  }

  // =========================================================================
  // FACILITY OPERATIONS
  // =========================================================================

  /**
   * Create a new Master Facility on the ledger.
   * Requires multi-party submission (borrower + agent must authorize).
   * In Canton, this is handled via pre-authorized command submissions.
   */
  async createMasterFacility(
    actAs: Party[],
    payload: Omit<MasterFacilityPayload, "drawnAmount" | "isActive">
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs,
      workflowId: `CREATE-FACILITY-${payload.facilityId}-${Date.now()}`,
      commands: [{
        templateId:      TEMPLATE_IDS.MasterFacility,
        createArgument: {
          ...payload,
          drawnAmount: "0.0",
          isActive:    true,
        },
      }],
    });
  }

  /**
   * Provision a bilateral tranche commitment for an approved lender.
   * Controller: agent (Lead Arranger)
   */
  async allocateTranche(
    masterFacilityCid: ContractId,
    agentParty: Party,
    args: SyndicateTrancheArgs
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs:      [agentParty],
      workflowId: `ALLOC-TRANCHE-${args.lender}-${Date.now()}`,
      commands: [{
        templateId: TEMPLATE_IDS.MasterFacility,
        contractId: masterFacilityCid,
        choice:     "SyndicateTranche",
        argument: {
          lender:           args.lender,
          commitmentAmount: args.commitmentAmount,
          marginSpreadBps:  args.marginSpreadBps,
        },
      }],
    });
  }

  /**
   * Trigger a borrower drawdown against remaining facility headroom.
   * Controller: borrower
   */
  async requestDrawdown(
    masterFacilityCid: ContractId,
    borrowerParty: Party,
    args: RequestDrawdownArgs
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs:      [borrowerParty],
      workflowId: `DRAW-REQ-${args.drawdownId}-${Date.now()}`,
      commands: [{
        templateId: TEMPLATE_IDS.MasterFacility,
        contractId: masterFacilityCid,
        choice:     "RequestDrawdown",
        argument: {
          drawdownId: args.drawdownId,
          amount:     args.amount,
        },
      }],
    });
  }

  /**
   * Distribute a pro-rata drawdown share to a specific tranche.
   * Controller: agent
   */
  async applyTrancheDrawdown(
    trancheCid: ContractId,
    agentParty: Party,
    args: ApplyTrancheDrawdownArgs
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs:      [agentParty],
      workflowId: `APPLY-DRAW-${trancheCid.slice(0, 12)}-${Date.now()}`,
      commands: [{
        templateId: TEMPLATE_IDS.TrancheParticipation,
        contractId: trancheCid,
        choice:     "ApplyTrancheDrawdown",
        argument:   { drawAmount: args.drawAmount },
      }],
    });
  }

  /**
   * Process a repayment settlement for a specific lender's tranche.
   * Controller: agent
   * Creates an immutable RepaymentReceipt visible to the lender.
   */
  async settleRepayment(
    trancheCid: ContractId,
    agentParty: Party,
    args: SettleRepaymentArgs
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs:      [agentParty],
      workflowId: `SETTLE-${trancheCid.slice(0, 12)}-${Date.now()}`,
      commands: [{
        templateId: TEMPLATE_IDS.TrancheParticipation,
        contractId: trancheCid,
        choice:     "SettleRepayment",
        argument: {
          principalPaid: args.principalPaid,
          interestPaid:  args.interestPaid,
          timestamp:     args.timestamp,
        },
      }],
    });
  }

  // =========================================================================
  // STREAMING & QUERY OPERATIONS
  // =========================================================================

  /**
   * Stream active TrancheParticipation contracts for a specific party.
   * Each party sees ONLY their own contracts due to Canton sub-transaction privacy.
   */
  async streamPositions(
    partyId: Party,
    onUpdate: (contracts: Array<ActiveContract<TrancheParticipationPayload>>) => void,
    onError?: (err: Error) => void
  ): Promise<() => void> {
    const url = new URL(`${this.baseUrl}/v1/state/active-contracts`);
    const body: ACSStreamRequest = {
      eventFormat: {
        filtersByParty: {
          [partyId]: {
            templateFilters: [
              { templateType: TEMPLATE_IDS.TrancheParticipation },
            ],
          },
        },
      },
      onData: (res) => onUpdate(
        res.activeContracts as Array<ActiveContract<TrancheParticipationPayload>>
      ),
      onError,
    };

    // In production: use Canton SDK streaming client
    // Here we simulate with polling for demo purposes
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const response = await fetch(url.toString(), {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              filter: body.eventFormat,
            }),
          });
          if (response.ok) {
            const data = await response.json() as { activeContracts: Array<ActiveContract<TrancheParticipationPayload>> };
            onUpdate(data.activeContracts ?? []);
          }
        } catch (err) {
          onError?.(err as Error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };

    poll();
    return () => { active = false; };
  }

  /**
   * Stream all RepaymentReceipt contracts visible to a party.
   * Due to Canton privacy model, each lender sees ONLY their own receipts.
   */
  async streamRepaymentReceipts(
    partyId: Party,
    onUpdate: (receipts: Array<ActiveContract<RepaymentReceiptPayload>>) => void,
    onError?: (err: Error) => void
  ): Promise<() => void> {
    let active = true;
    const poll = async () => {
      while (active) {
        try {
          const response = await fetch(
            `${this.baseUrl}/v1/state/active-contracts`,
            {
              method: "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${this.token}`,
              },
              body: JSON.stringify({
                filter: {
                  filtersByParty: {
                    [partyId]: {
                      templateFilters: [{ templateType: TEMPLATE_IDS.RepaymentReceipt }],
                    },
                  },
                },
              }),
            }
          );
          if (response.ok) {
            const data = await response.json() as { activeContracts: Array<ActiveContract<RepaymentReceiptPayload>> };
            onUpdate(data.activeContracts ?? []);
          }
        } catch (err) {
          onError?.(err as Error);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };

    poll();
    return () => { active = false; };
  }

  /**
   * Query the active MasterFacility for a given facilityId.
   * Both borrower and agent can read the facility contract.
   */
  async queryFacility(
    partyId: Party,
    facilityId: FacilityId
  ): Promise<ActiveContract<MasterFacilityPayload> | null> {
    const response = await fetch(`${this.baseUrl}/v1/state/active-contracts`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        filter: {
          filtersByParty: {
            [partyId]: {
              templateFilters: [{ templateType: TEMPLATE_IDS.MasterFacility }],
            },
          },
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      activeContracts: Array<ActiveContract<MasterFacilityPayload>>;
    };
    return data.activeContracts.find(c => c.payload.facilityId === facilityId) ?? null;
  }

  // =========================================================================
  // EVENT AGGREGATION
  // =========================================================================

  /**
   * Subscribe to all CantonSyndex events for audit and monitoring.
   * Returns a cleanup function to unsubscribe.
   */
  async subscribeToEvents(
    partyId: Party,
    onEvent: (event: SyndicateLoanEvent) => void,
    onError?: (err: Error) => void
  ): Promise<() => void> {
    const stopTranches = await this.streamPositions(partyId, (contracts) => {
      contracts.forEach(c => onEvent({
        type:       "TrancheSyndicated",
        facilityId: c.payload.facilityId,
        contractId: c.contractId,
        payload:    c.payload,
        timestamp:  c.createdAt,
      }));
    }, onError);

    const stopReceipts = await this.streamRepaymentReceipts(partyId, (receipts) => {
      receipts.forEach(r => onEvent({
        type:       "RepaymentSettled",
        facilityId: r.payload.facilityId,
        contractId: r.contractId,
        payload:    r.payload,
        timestamp:  r.createdAt,
      }));
    }, onError);

    return () => {
      stopTranches();
      stopReceipts();
    };
  }

  // =========================================================================
  // Interest Accrual Methods
  // =========================================================================

  /**
   * Create a new InterestAccrual contract for a lender's tranche.
   * Both agent and lender must authorize (submitMulti in Canton terms).
   */
  async createInterestAccrual(
    facilityId: string,
    trancheId: string,
    lenderParty: Party,
    principalBalance: number,
    marginSpreadBps: number,
    baseRateBps: number,
    periodStartDate: string,
    periodEndDate: string,
    dayCountConvention: "Actual365Fixed" | "Actual360" | "Thirty360"
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty, lenderParty],
      commands: [{
        type: "create",
        templateId: `${this.packageId}:CantonSyndex.Core:InterestAccrual`,
        payload: {
          facilityId,
          trancheId,
          agent: this.actingParty,
          lender: lenderParty,
          principalBalance,
          marginSpreadBps,
          baseRateBps,
          periodStartDate,
          periodEndDate,
          dayCountConvention: { tag: dayCountConvention, value: {} },
          accruedInterest: 0.0,
          isSettled: false,
        },
      }],
    });
  }

  /**
   * Trigger interest accrual calculation up to accrualDate.
   * Returns the updated InterestAccrual contract ID.
   */
  async accrueInterest(
    accrualContractId: ContractId,
    accrualDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:InterestAccrual`,
        contractId: accrualContractId,
        choice: "AccrueInterest",
        argument: { accrualDate },
      }],
    });
  }

  /**
   * Collect accrued interest at period end → creates InterestPaymentReceipt.
   */
  async collectInterest(
    accrualContractId: ContractId,
    settlementDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:InterestAccrual`,
        contractId: accrualContractId,
        choice: "CollectInterest",
        argument: { settlementDate },
      }],
    });
  }

  /**
   * Query all InterestPaymentReceipts visible to the calling party.
   * Each lender only sees their own receipts (Canton sub-tx privacy).
   */
  async getInterestReceipts(
    facilityId?: string
  ): Promise<ActiveContract[]> {
    const all = await this.queryContracts(
      `${this.packageId}:CantonSyndex.Core:InterestPaymentReceipt`
    );
    if (facilityId) {
      return all.filter(c => (c.payload as any).facilityId === facilityId);
    }
    return all;
  }

  // =========================================================================
  // Covenant Tracking Methods
  // =========================================================================

  /**
   * Create FacilityCovenants contract with initial threshold values.
   * Both borrower and agent are signatories.
   */
  async createFacilityCovenants(
    facilityId: string,
    borrowerParty: Party,
    lenderParties: Party[],
    regulatorParty: Party | null,
    maxLeverageRatio: number,
    minDSCR: number,
    maxLTV: number,
    minLiquidity: number,
    curePeriodDays: number,
    initialTestDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty, borrowerParty],
      commands: [{
        type: "create",
        templateId: `${this.packageId}:CantonSyndex.Core:FacilityCovenants`,
        payload: {
          facilityId,
          borrower: borrowerParty,
          agent: this.actingParty,
          lenders: lenderParties,
          regulator: regulatorParty ? { tag: "Some", value: regulatorParty } : { tag: "None", value: {} },
          maxLeverageRatio,
          minDSCR,
          maxLTV,
          minLiquidity,
          lastTestDate: initialTestDate,
          leverageActual: 0.0,
          dscrActual: 0.0,
          ltvActual: 0.0,
          liquidityActual: 0.0,
          breachStatus: { tag: "Compliant", value: {} },
          curePeriodDays,
        },
      }],
    });
  }

  /**
   * Run a quarterly covenant test with new financial data.
   * Returns updated FacilityCovenants contract (Compliant or Breached).
   */
  async testCovenant(
    covenantContractId: ContractId,
    testDate: string,
    newLeverage: number,
    newDSCR: number,
    newLTV: number,
    newLiquidity: number
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:FacilityCovenants`,
        contractId: covenantContractId,
        choice: "TestCovenant",
        argument: { testDate, newLeverage, newDSCR, newLTV, newLiquidity },
      }],
    });
  }

  /**
   * Query the current covenant status for a facility.
   */
  async getCovenantStatus(facilityId: string): Promise<ActiveContract | null> {
    const results = await this.queryContracts(
      `${this.packageId}:CantonSyndex.Core:FacilityCovenants`
    );
    const match = results.find(c => (c.payload as any).facilityId === facilityId);
    return match ?? null;
  }

  // =========================================================================
  // Commitment Fee Methods
  // =========================================================================

  /**
   * Create a CommitmentFeeAccrual for a lender's undrawn commitment.
   */
  async createCommitmentFeeAccrual(
    facilityId: string,
    trancheId: string,
    lenderParty: Party,
    commitmentAmount: number,
    drawnAmount: number,
    feeBps: number,
    periodStartDate: string,
    periodEndDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty, lenderParty],
      commands: [{
        type: "create",
        templateId: `${this.packageId}:CantonSyndex.Core:CommitmentFeeAccrual`,
        payload: {
          facilityId,
          trancheId,
          agent: this.actingParty,
          lender: lenderParty,
          commitmentAmount,
          drawnAmount,
          feeBps,
          periodStartDate,
          periodEndDate,
          accruedFee: 0.0,
          isSettled: false,
        },
      }],
    });
  }

  /**
   * Accrue commitment fee up to accrualDate (Actual/365).
   */
  async accrueCommitmentFee(
    feeContractId: ContractId,
    accrualDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:CommitmentFeeAccrual`,
        contractId: feeContractId,
        choice: "AccrueCommitmentFee",
        argument: { accrualDate },
      }],
    });
  }

  /**
   * Collect commitment fee at period end → CommitmentFeeReceipt.
   */
  async collectCommitmentFee(
    feeContractId: ContractId,
    settlementDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:CommitmentFeeAccrual`,
        contractId: feeContractId,
        choice: "CollectCommitmentFee",
        argument: { settlementDate },
      }],
    });
  }

  // =========================================================================
  // Facility Amendment Methods
  // =========================================================================

  /**
   * Propose a facility amendment (borrower + agent sign).
   */
  async proposeAmendment(
    facilityId: string,
    proposalId: string,
    borrowerParty: Party,
    lenderParties: Party[],
    amendmentType: string,
    rationale: string,
    proposalDate: string,
    expiryDate: string,
    proposedNewLimit?: number,
    proposedNewMaturity?: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty, borrowerParty],
      commands: [{
        type: "create",
        templateId: `${this.packageId}:CantonSyndex.Core:FacilityAmendmentProposal`,
        payload: {
          facilityId,
          proposalId,
          borrower: borrowerParty,
          agent: this.actingParty,
          lenders: lenderParties,
          amendmentType: { tag: amendmentType, value: {} },
          proposedNewLimit: proposedNewLimit != null
            ? { tag: "Some", value: proposedNewLimit }
            : { tag: "None", value: {} },
          proposedNewMaturity: proposedNewMaturity != null
            ? { tag: "Some", value: proposedNewMaturity }
            : { tag: "None", value: {} },
          newLender: { tag: "None", value: {} },
          removedLender: { tag: "None", value: {} },
          rationale,
          proposalDate,
          expiryDate,
          acceptedBy: [],
          rejectedBy: [],
        },
      }],
    });
  }

  /**
   * Lender votes to accept an amendment proposal.
   */
  async acceptAmendment(
    proposalContractId: ContractId,
    lenderParty: Party
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [lenderParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:FacilityAmendmentProposal`,
        contractId: proposalContractId,
        choice: "AcceptAmendment",
        argument: { lender: lenderParty },
      }],
    });
  }

  /**
   * Agent executes amendment once consent threshold is met.
   */
  async executeAmendment(
    proposalContractId: ContractId,
    executionDate: string
  ): Promise<CommandResult> {
    return this.submitAndWait({
      actAs: [this.actingParty],
      commands: [{
        type: "exercise",
        templateId: `${this.packageId}:CantonSyndex.Core:FacilityAmendmentProposal`,
        contractId: proposalContractId,
        choice: "ExecuteAmendment",
        argument: { executionDate },
      }],
    });
  }
}
