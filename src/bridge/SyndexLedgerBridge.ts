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
}
