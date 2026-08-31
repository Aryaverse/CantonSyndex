/**
 * CantonSyndex Dashboard — main.js
 * Comprehensive Operations Controller for Privacy-Preserving Syndicated Loans on Canton Network.
 *
 * Supports:
 * - JWT per-party authentication with token storage and session management
 * - Live Canton JSON API mode with real-time ACS streaming (gRPC/HTTP proxy)
 * - Interactive Sandbox mode (high-fidelity on-chain state machine simulation)
 * - Bilateral sub-transaction privacy enforcement per party view
 * - WebSocket real-time push notifications (covenant breach, amendments, accruals)
 * - DAML assertion error translation to user-friendly messages
 * - Full template suite: MasterFacility, TrancheParticipation, DrawdownExecution,
 *   InterestAccrual, CommitmentFeeAccrual, FacilityCovenants, FacilityAmendmentProposal,
 *   RepaymentReceipt, and CovenantBreachNotice.
 */

'use strict';

// =============================================================================
// GLOBAL STATE & CANTON NETWORK CONFIG
// =============================================================================

const CANTON_ENDPOINTS = {
  agent:     'http://localhost:10013',
  borrower:  'http://localhost:10013',
  bankA:     'http://localhost:10023',
  bankB:     'http://localhost:10033',
  regulator: 'http://localhost:10013',
};

let networkMode = 'simulated'; // 'simulated' | 'live-local'
let activeParty = 'agent';
let sessionToken = null;       // JWT token for current party
let acsPollingInterval = null; // ACS streaming poll handle
let wsConnection = null;       // WebSocket notification hub

// High-fidelity state machine representing on-ledger contracts
const state = {
  facility: {
    facilityId:  'FAC-2026-USD-100M',
    currency:    'USD',
    totalLimit:  100_000_000,
    drawnAmount:  20_000_000,
    isActive:    true,
    borrower:    'Amazon Capital',
    agent:       'Goldman Sachs',
    regulator:   'Federal Reserve',
  },
  tranches: [
    {
      id:               'TRANCHE-JPMC-001',
      lender:           'JPMorgan Chase',
      lenderKey:        'bankA',
      commitmentAmount: 60_000_000,
      drawnAmount:      12_000_000,
      marginSpreadBps:  150.0,
      isActive:         true,
    },
    {
      id:               'TRANCHE-DB-001',
      lender:           'Deutsche Bank',
      lenderKey:        'bankB',
      commitmentAmount: 40_000_000,
      drawnAmount:       8_000_000,
      marginSpreadBps:  175.0,
      isActive:         true,
    },
  ],
  interestContracts: [
    {
      trancheId:          'INT-JPMC-Q3-2026',
      lenderKey:          'bankA',
      lender:             'JPMorgan Chase',
      principalBalance:   12_000_000,
      baseRateBps:        530.0, // SOFR
      marginSpreadBps:    150.0,
      allInRateBps:       680.0,
      dayCountConvention: 'Actual365Fixed',
      periodStartDate:    '2026-07-01',
      periodEndDate:      '2026-10-01',
      accruedInterest:    69_304.11,
      isSettled:          false,
    },
    {
      trancheId:          'INT-DB-Q3-2026',
      lenderKey:          'bankB',
      lender:             'Deutsche Bank',
      principalBalance:    8_000_000,
      baseRateBps:        530.0,
      marginSpreadBps:    175.0,
      allInRateBps:       705.0,
      dayCountConvention: 'Actual365Fixed',
      periodStartDate:    '2026-07-01',
      periodEndDate:      '2026-10-01',
      accruedInterest:    47_901.37,
      isSettled:          false,
    },
  ],
  interestReceipts: [],
  feeContracts: [
    {
      trancheId:        'FEE-JPMC-Q3-2026',
      lenderKey:        'bankA',
      lender:           'JPMorgan Chase',
      commitmentAmount: 60_000_000,
      drawnAmount:      12_000_000,
      undrawnAmount:    48_000_000,
      feeBps:           50.0, // 0.50% pa
      periodStartDate:  '2026-07-01',
      periodEndDate:    '2026-10-01',
      accruedFee:       60_493.15,
      isSettled:        false,
    },
    {
      trancheId:        'FEE-DB-Q3-2026',
      lenderKey:        'bankB',
      lender:           'Deutsche Bank',
      commitmentAmount: 40_000_000,
      drawnAmount:       8_000_000,
      undrawnAmount:    32_000_000,
      feeBps:           50.0,
      periodStartDate:  '2026-07-01',
      periodEndDate:    '2026-10-01',
      accruedFee:       40_328.77,
      isSettled:        false,
    },
  ],
  feeReceipts: [],
  covenants: {
    facilityId:       'FAC-2026-USD-100M',
    maxLeverageRatio: 4.50,
    minDSCR:          1.25,
    maxLTV:           0.75,
    minLiquidity:     5_000_000,
    lastTestDate:     '2026-06-30',
    leverageActual:   3.80,
    dscrActual:       1.45,
    ltvActual:        0.62,
    liquidityActual:  7_200_000,
    breachStatus:     'Compliant', // 'Compliant' | 'Breached' | 'WaivedByAgent' | 'Accelerated'
    curePeriodDays:   30,
    waiverReason:     null,
  },
  covenantNotice: null,
  amendments: [
    {
      proposalId:          'AMEND-FAC-2026-001',
      facilityId:          'FAC-2026-USD-100M',
      amendmentType:       'IncreaseCreditLimit',
      proposedNewLimit:    150_000_000,
      proposedNewMaturity: null,
      rationale:           'Borrower requests $50M credit expansion for European renewable infrastructure project.',
      proposalDate:        '2026-08-25',
      expiryDate:          '2026-09-30',
      lenders:             ['JPMorgan Chase', 'Deutsche Bank'],
      acceptedBy:          ['JPMorgan Chase'],
      rejectedBy:          [],
      isExecuted:          false,
      requiresUnanimous:   true,
    },
  ],
  amendmentRecords: [],
  drawdowns: [
    {
      drawdownId: 'DRAW-001',
      amount:      20_000_000,
      executed:    true,
      timestamp:  '2026-08-28T09:15:00Z',
      controller:  'Amazon Capital',
    },
  ],
  receipts: [],
  auditLog: [
    {
      type:      'FacilityCreated',
      color:     '#0052cc',
      title:     'MasterFacility Created',
      detail:    'FAC-2026-USD-100M · $100M USD · Amazon Capital + Goldman Sachs',
      timestamp: '2026-08-28T08:00:00Z',
    },
    {
      type:      'TrancheSyndicated',
      color:     '#f59e0b',
      title:     'Tranche Syndicated → JPMorgan Chase',
      detail:    '$60,000,000 @ 150 bps · TRANCHE-JPMC-001',
      timestamp: '2026-08-28T08:30:00Z',
    },
    {
      type:      'TrancheSyndicated',
      color:     '#ec4899',
      title:     'Tranche Syndicated → Deutsche Bank',
      detail:    '$40,000,000 @ 175 bps · TRANCHE-DB-001',
      timestamp: '2026-08-28T08:35:00Z',
    },
    {
      type:      'InterestAccrualInitiated',
      color:     '#06b6d4',
      title:     'Bilateral Interest Accrual Initialized',
      detail:    'JPMorgan Chase ($12M @ 6.80%) & Deutsche Bank ($8M @ 7.05%)',
      timestamp: '2026-08-28T08:40:00Z',
    },
    {
      type:      'CovenantsActive',
      color:     '#10b981',
      title:     'Quarterly Covenants Registered',
      detail:    'Leverage <= 4.5x, DSCR >= 1.25x, LTV <= 75%, Liquidity >= $5M',
      timestamp: '2026-08-28T08:45:00Z',
    },
    {
      type:      'DrawdownExecuted',
      color:     '#10b981',
      title:     'Drawdown Distributed Pro-Rata',
      detail:    'JPMorgan Chase: $12M (60%) · Deutsche Bank: $8M (40%)',
      timestamp: '2026-08-28T09:15:00Z',
    },
  ],
};

// =============================================================================
// UTILITIES & FORMATTING
// =============================================================================

const usd = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtTime = ts => {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return ts; }
};

// Icon SVGs for toasts
const TOAST_ICONS = {
  info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>',
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
};

const toast = (arg1, arg2 = '', arg3 = 'info', duration = 4500) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  let title = 'Notice';
  let message = '';
  let type = 'info';

  const VALID_TYPES = ['info', 'success', 'warning', 'error'];

  if (VALID_TYPES.includes(arg2)) {
    // Called as toast('My message', 'success')
    message = arg1;
    type = arg2;
    title = type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'System Notice';
    if (typeof arg3 === 'number') duration = arg3;
  } else if (arg2 && typeof arg2 === 'string') {
    // Called as toast('Title', 'Message', 'type')
    title = arg1;
    message = arg2;
    type = VALID_TYPES.includes(arg3) ? arg3 : 'info';
  } else {
    // Called as toast('My message')
    message = arg1;
    title = 'Notice';
    type = 'info';
  }

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <div class="toast-body">
      <p class="toast-title">${title}</p>
      ${message ? `<p class="toast-msg">${message}</p>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;
  const close = el.querySelector('.toast-close');
  const dismiss = () => {
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 280);
  };
  close.addEventListener('click', dismiss);
  container.appendChild(el);
  setTimeout(dismiss, duration);
};

const logAudit = (type, title, detail, color = '#0052cc') => {
  state.auditLog.unshift({
    type,
    title,
    detail,
    color,
    timestamp: new Date().toISOString(),
  });
  renderAudit();
};

// =============================================================================
// PRIVACY FILTERS (CANTON SUB-TRANSACTION PRIVACY)
// =============================================================================

const getVisibleTranches = () => {
  switch (activeParty) {
    case 'agent':
    case 'borrower': return state.tranches;
    case 'bankA':    return state.tranches.filter(t => t.lenderKey === 'bankA');
    case 'bankB':    return state.tranches.filter(t => t.lenderKey === 'bankB');
    case 'regulator': return [];
    default:         return [];
  }
};

const getVisibleInterestContracts = () => {
  switch (activeParty) {
    case 'agent':    return state.interestContracts;
    case 'bankA':    return state.interestContracts.filter(c => c.lenderKey === 'bankA');
    case 'bankB':    return state.interestContracts.filter(c => c.lenderKey === 'bankB');
    default:         return []; // Borrower and regulator cannot see bilateral accrual details
  }
};

const getVisibleFeeContracts = () => {
  switch (activeParty) {
    case 'agent':    return state.feeContracts;
    case 'bankA':    return state.feeContracts.filter(c => c.lenderKey === 'bankA');
    case 'bankB':    return state.feeContracts.filter(c => c.lenderKey === 'bankB');
    default:         return [];
  }
};

// =============================================================================
// DAML ERROR TRANSLATOR — maps assertion messages to friendly UI text
// =============================================================================

const DAML_ERROR_MAP = [
  { pattern: /DA.Exception.AssertionFailed/i,                              friendly: 'A DAML contract assertion was violated. Check your input values against contract invariants.' },
  { pattern: /Unauthorized/i,                                              friendly: 'Your party does not have authorization to perform this action. Check your JWT token and party role.' },
  { pattern: /Contract not found/i,                                        friendly: 'The target contract could not be found. It may have already been archived or the contract ID is invalid.' },
  { pattern: /exceeds.*limit|limit.*exceeded/i,                            friendly: 'The requested amount exceeds the facility credit limit. Please check outstanding drawdowns and headroom.' },
  { pattern: /drawdown.*zero|zero.*drawdown/i,                             friendly: 'Drawdown amount must be greater than zero.' },
  { pattern: /repayment.*exceeds|exceeds.*principal/i,                     friendly: 'Repayment amount exceeds the outstanding drawn principal on this tranche.' },
  { pattern: /covenant.*breach|breach.*covenant/i,                         friendly: 'A covenant ratio test has failed. The borrower is in breach. Refer to the Covenants tab for detail.' },
  { pattern: /amendment.*lapsed|proposal.*expired/i,                       friendly: 'This amendment proposal has lapsed. The voting deadline has passed without unanimous consent.' },
  { pattern: /already.*voted|duplicate.*accept/i,                          friendly: 'This lender has already voted on the amendment proposal.' },
  { pattern: /HTTP 401|unauthorized/i,                                     friendly: 'Authentication failed. Your JWT token may be expired or invalid. Please sign in again.' },
  { pattern: /HTTP 403|forbidden/i,                                        friendly: 'Access denied. Your party does not have permission to view or modify this contract.' },
  { pattern: /ECONNREFUSED|Failed to fetch|NetworkError|net::ERR/i,        friendly: 'Cannot reach the Canton ledger node. Ensure the Canton LocalNet is running and accessible.' },
];

const translateDamlError = (rawError) => {
  const raw = String(rawError?.message || rawError || '');
  for (const { pattern, friendly } of DAML_ERROR_MAP) {
    if (pattern.test(raw)) return { friendly, raw };
  }
  return { friendly: 'An unexpected ledger error occurred. Please check your inputs and try again.', raw };
};

const showErrorModal = (error, context = '') => {
  const { friendly, raw } = translateDamlError(error);
  const overlay = document.getElementById('error-modal-overlay');
  const msgEl   = document.getElementById('error-modal-message');
  const detailEl = document.getElementById('error-modal-detail');
  const detailWrap = document.getElementById('error-modal-detail-wrap');
  const titleEl = document.getElementById('error-modal-title');

  titleEl.textContent  = context ? `Transaction Failed — ${context}` : 'Transaction Failed';
  msgEl.textContent    = friendly;
  detailEl.textContent = raw;
  detailWrap.style.display = raw ? 'block' : 'none';
  overlay.style.display = 'flex';
};

// =============================================================================
// LIVE CANTON JSON API CLIENT (with JWT auth headers & error translation)
// =============================================================================

const cantonApi = {
  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (sessionToken) h['Authorization'] = `Bearer ${sessionToken}`;
    return h;
  },

  async queryContracts(templateId) {
    if (networkMode === 'simulated') return null;
    const endpoint = CANTON_ENDPOINTS[activeParty] || CANTON_ENDPOINTS.agent;
    try {
      const res = await fetch(`${endpoint}/v1/query`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ templateIds: [templateId] }),
      });
      if (res.status === 401) { auth.logout(); throw new Error('HTTP 401 unauthorized'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.result || [];
    } catch (err) {
      console.warn(`[Canton API] Query failed:`, err);
      const { friendly } = translateDamlError(err);
      toast('Canton Node Offline', friendly, 'warning');
      return null;
    }
  },

  async exerciseChoice(templateId, contractId, choice, argument) {
    if (networkMode === 'simulated') return null;
    const endpoint = CANTON_ENDPOINTS[activeParty] || CANTON_ENDPOINTS.agent;
    try {
      const res = await fetch(`${endpoint}/v1/exercise`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ templateId, contractId, choice, argument }),
      });
      if (res.status === 401) { auth.logout(); throw new Error('HTTP 401 unauthorized'); }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[Canton API] Exercise failed:`, err);
      showErrorModal(err, choice);
      throw err;
    }
  },
};

// =============================================================================
// JWT AUTHENTICATION MODULE
// =============================================================================

const PARTY_DISPLAY_NAMES = {
  agent:     { name: 'Goldman Sachs',  role: 'Lead Arranger', avatar: 'GS' },
  borrower:  { name: 'Amazon Capital', role: 'Borrower',      avatar: 'AC' },
  bankA:     { name: 'JPMorgan Chase', role: 'Senior Lender', avatar: 'JPM' },
  bankB:     { name: 'Deutsche Bank',  role: 'Senior Lender', avatar: 'DB' },
  regulator: { name: 'Federal Reserve',role: 'Regulator',     avatar: 'FED' },
};

const auth = {
  // Validate and store JWT session
  login(party, token, mode) {
    if (!party) throw new Error('Please select your institution.');
    if (!token || token.trim().length < 8) throw new Error('Please enter a valid Canton JWT token.');

    // Store session
    sessionToken = token.trim();
    activeParty = party;
    networkMode = mode || 'simulated';

    // Persist to sessionStorage for page reload resilience
    sessionStorage.setItem('syndex_party', party);
    sessionStorage.setItem('syndex_token', token.trim());
    sessionStorage.setItem('syndex_mode', networkMode);

    this._applySession();
  },

  // Restore session from storage
  restore() {
    const party = sessionStorage.getItem('syndex_party');
    const token = sessionStorage.getItem('syndex_token');
    const mode  = sessionStorage.getItem('syndex_mode') || 'simulated';
    if (party && token) {
      sessionToken = token;
      activeParty = party;
      networkMode = mode;
      this._applySession();
      return true;
    }
    return false;
  },

  logout() {
    sessionToken = null;
    sessionStorage.removeItem('syndex_party');
    sessionStorage.removeItem('syndex_token');
    sessionStorage.removeItem('syndex_mode');
    stopAcsStreaming();
    stopWebSocket();
    // Show login screen
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.remove('hidden');
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.style.display = 'none';
    toast('You have been signed out successfully.', 'info');
  },

  _applySession() {
    // Hide login screen
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.add('hidden');

    // Update party selector in header
    const partySelect = document.getElementById('party-select');
    if (partySelect) partySelect.value = activeParty;

    // Update network mode selector
    const modeSelect = document.getElementById('network-mode-select');
    if (modeSelect) modeSelect.value = networkMode;

    // Update session chip
    const info = PARTY_DISPLAY_NAMES[activeParty] || { name: activeParty, avatar: activeParty[0].toUpperCase(), role: '' };
    const avatarEl = document.getElementById('session-avatar');
    const nameEl   = document.getElementById('session-name');
    if (avatarEl) avatarEl.textContent = info.avatar;
    if (nameEl)   nameEl.textContent   = `${info.name}`;

    // Update ledger status
    const statusText = document.getElementById('ledger-status-text');
    if (statusText) {
      statusText.textContent = networkMode === 'live-local' ? 'Canton LocalNet (Live)' : 'Interactive Sandbox';
    }

    // Default to Overview tab if none active
    const activeTab = document.querySelector('.tab-btn.active');
    if (!activeTab) {
      document.getElementById('tab-overview')?.click();
    }

    // Boot streaming and dashboard
    renderAll();
    startAcsStreaming();
    startWebSocket();
    toast(`Welcome, ${info.name}`, `Active as ${info.role}`, 'success');
  },
};

// =============================================================================
// REAL-TIME ACS STREAMING (replaces 30s fixed poll)
// =============================================================================

const ACS_POLL_INTERVAL_LIVE = 8000;     // 8s in live mode
const ACS_POLL_INTERVAL_SANDBOX = 30000; // 30s in sandbox mode

const startAcsStreaming = () => {
  stopAcsStreaming();
  const interval = networkMode === 'live-local' ? ACS_POLL_INTERVAL_LIVE : ACS_POLL_INTERVAL_SANDBOX;

  acsPollingInterval = setInterval(async () => {
    if (networkMode !== 'live-local') { renderAll(); return; }

    try {
      // Poll MasterFacility ACS from live Canton node
      const contracts = await cantonApi.queryContracts('CantonSyndex:Core:MasterFacility');
      if (contracts && contracts.length > 0) {
        const payload = contracts[0].payload;
        if (payload) {
          state.facility.totalLimit  = payload.totalCreditLimit ?? state.facility.totalLimit;
          state.facility.isActive    = payload.isActive ?? state.facility.isActive;
          state.facility.borrower    = payload.borrower ?? state.facility.borrower;
        }
        const statusDot = document.querySelector('#ledger-status .status-dot');
        if (statusDot) statusDot.style.background = 'var(--clr-green)';
      }

      // Poll Covenant ACS for breach state changes
      const covenantContracts = await cantonApi.queryContracts('CantonSyndex:Core:FacilityCovenants');
      if (covenantContracts && covenantContracts.length > 0) {
        const p = covenantContracts[0].payload;
        if (p) {
          state.covenants.leverageActual  = p.currentLeverage   ?? state.covenants.leverageActual;
          state.covenants.dscrActual      = p.currentDSCR       ?? state.covenants.dscrActual;
          state.covenants.ltvActual       = p.currentLTV        ?? state.covenants.ltvActual;
          state.covenants.liquidityActual = p.currentLiquidity  ?? state.covenants.liquidityActual;
          state.covenants.breachStatus    = p.breachStatus      ?? state.covenants.breachStatus;
          // Push alert if breached
          if (p.breachStatus === 'Breached') {
            wsHub.pushAlert('covenant_breach', 'Covenant Breach Detected', `${state.facility.facilityId} — Covenant ratio test failed. Cure period: ${state.covenants.curePeriodDays} days.`);
          }
        }
      }

      renderAll();
    } catch (err) {
      console.warn('[ACS Stream] Poll error:', err);
    }
  }, interval);

  console.log(`[ACS Stream] Started — polling every ${interval / 1000}s in ${networkMode} mode`);
};

const stopAcsStreaming = () => {
  if (acsPollingInterval) { clearInterval(acsPollingInterval); acsPollingInterval = null; }
};

// =============================================================================
// WEBSOCKET NOTIFICATION HUB (real-time push alerts)
// =============================================================================

const WS_RECONNECT_DELAY_MS = 5000;
const WS_MAX_RECONNECTS = 8;
let wsReconnectCount = 0;

// Notification types pushed via WebSocket
const WS_NOTIFICATION_HANDLERS = {
  covenant_breach: (data) => {
    toast('⚠️ Covenant Breach', data.message || 'A covenant ratio test has failed.', 'error', 8000);
    logAudit('CovenantBreach', 'Covenant Breach Notification', data.message || 'Breach detected on-chain', '#ef4444');
  },
  amendment_vote: (data) => {
    toast('🗳️ Amendment Vote', data.message || 'A lender has voted on an amendment proposal.', 'info');
    logAudit('AmendmentVote', 'Amendment Vote Received', data.message || '', '#06b6d4');
  },
  amendment_executed: (data) => {
    toast('✅ Amendment Executed', data.message || 'A facility amendment has been executed on-chain.', 'success');
    logAudit('AmendmentExecuted', 'Amendment Executed', data.message || '', '#10b981');
  },
  interest_accrued: (data) => {
    toast('Interest Accrued', data.message || 'A bilateral interest accrual has been recorded.', 'info', 4000);
  },
  fee_accrued: (data) => {
    toast('Fee Accrued', data.message || 'A commitment fee has been accrued.', 'info', 4000);
  },
  ledger_connected: () => {
    const dot = document.querySelector('#ledger-status .status-dot');
    const txt = document.getElementById('ledger-status-text');
    if (dot) dot.style.background = 'var(--clr-green)';
    if (txt)  txt.textContent = 'Canton LocalNet (Live)';
    toast('Ledger Connected', 'WebSocket channel established with Canton LocalNet.', 'success');
  },
  ledger_disconnected: () => {
    const dot = document.querySelector('#ledger-status .status-dot');
    if (dot) dot.style.background = 'var(--clr-red)';
    toast('Ledger Disconnected', 'Connection to Canton node lost. Reconnecting…', 'warning');
  },
};

// In-process push hub (used when no real WS server is available — simulates push in Sandbox)
const wsHub = {
  pushAlert(type, title, message) {
    const handler = WS_NOTIFICATION_HANDLERS[type];
    if (handler) handler({ title, message });
  },
  // Simulate periodic covenant check push in sandbox mode
  startSandboxPush() {
    // Simulated push: check for covenant near-breach every 45s
    setInterval(() => {
      if (networkMode !== 'simulated') return;
      if (state.covenants.leverageActual > state.covenants.maxLeverageRatio * 0.9) {
        wsHub.pushAlert('covenant_breach',
          'Covenant Near-Breach Warning',
          `Leverage ratio ${state.covenants.leverageActual.toFixed(2)}x approaching threshold of ${state.covenants.maxLeverageRatio}x.`);
      }
    }, 45000);
  },
};

const startWebSocket = () => {
  // In sandbox mode, use in-process push hub only
  if (networkMode === 'simulated') {
    wsHub.startSandboxPush();
    return;
  }

  // In live mode, connect to the bridge server WebSocket endpoint
  const wsUrl = `ws://localhost:3000/ws/notifications`;
  try {
    stopWebSocket();
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
      wsReconnectCount = 0;
      WS_NOTIFICATION_HANDLERS.ledger_connected?.();
      // Send party subscription
      wsConnection.send(JSON.stringify({ type: 'subscribe', party: activeParty, token: sessionToken }));
    };

    wsConnection.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handler = WS_NOTIFICATION_HANDLERS[msg.type];
        if (handler) handler(msg);
      } catch (e) { console.warn('[WS] Bad message:', e); }
    };

    wsConnection.onclose = () => {
      WS_NOTIFICATION_HANDLERS.ledger_disconnected?.();
      // Exponential backoff reconnect
      if (wsReconnectCount < WS_MAX_RECONNECTS) {
        const delay = WS_RECONNECT_DELAY_MS * Math.pow(1.5, wsReconnectCount);
        wsReconnectCount++;
        console.log(`[WS] Reconnecting in ${(delay/1000).toFixed(1)}s (attempt ${wsReconnectCount}/${WS_MAX_RECONNECTS})`);
        setTimeout(startWebSocket, delay);
      } else {
        console.warn('[WS] Max reconnect attempts reached. Falling back to ACS polling only.');
      }
    };

    wsConnection.onerror = (err) => { console.warn('[WS] Error:', err); };
  } catch (err) {
    console.warn('[WS] WebSocket unavailable, using polling only:', err);
  }
};

const stopWebSocket = () => {
  if (wsConnection) {
    wsConnection.onclose = null; // prevent reconnect on manual close
    wsConnection.close();
    wsConnection = null;
  }
};

// =============================================================================
// RENDERERS
// =============================================================================

const renderOverview = () => {
  const { facility, tranches, drawdowns } = state;
  const utilized = facility.drawnAmount / facility.totalLimit;

  document.getElementById('kpi-total-val').textContent    = usd(facility.totalLimit);
  document.getElementById('kpi-drawn-val').textContent    = usd(facility.drawnAmount);
  document.getElementById('kpi-headroom-val').textContent = usd(facility.totalLimit - facility.drawnAmount);
  document.getElementById('kpi-tranches-val').textContent = getVisibleTranches().length;
  document.getElementById('kpi-drawdowns-val').textContent = drawdowns.length;

  document.querySelector('#kpi-drawn .kpi-sub').textContent = `${(utilized * 100).toFixed(1)}% utilized`;
  document.querySelector('#kpi-headroom .kpi-sub').textContent = `${((1 - utilized) * 100).toFixed(1)}% headroom remaining`;
  document.querySelector('#kpi-tranches .kpi-sub').textContent =
    getVisibleTranches().map(t => t.lender).join(' · ') || 'No visible tranches (Privacy)';

  const arcLength = 251;
  const dashOffset = arcLength - (utilized * arcLength);
  const gaugeArc = document.getElementById('gauge-arc');
  const gaugePct = document.getElementById('gauge-pct-text');
  if (gaugeArc) {
    gaugeArc.style.strokeDashoffset = Math.max(0, Math.min(arcLength, dashOffset));
    gaugePct.textContent = `${(utilized * 100).toFixed(0)}%`;
  }
  document.querySelector('.facility-amount').textContent = usd(facility.totalLimit);
};

const renderTranches = () => {
  const tbody = document.getElementById('tranche-tbody');
  const visible = getVisibleTranches();

  if (visible.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:var(--clr-text-dim); padding: 32px; font-size:0.85rem;">
          🔒 No tranche contracts visible to <strong>${activeParty}</strong>
          <br><span style="font-size:0.75rem; font-family:var(--font-mono); color:#a78bfa;">
            Canton sub-transaction privacy strictly enforced
          </span>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = visible.map(t => {
    const util = t.drawnAmount / t.commitmentAmount;
    const pct  = (util * 100).toFixed(1);
    return `
      <tr>
        <td><strong>${t.lender}</strong></td>
        <td>${usd(t.commitmentAmount)}</td>
        <td>${usd(t.drawnAmount)}</td>
        <td>${usd(t.commitmentAmount - t.drawnAmount)}</td>
        <td>${t.marginSpreadBps.toFixed(1)} bps</td>
        <td>
          <div class="util-bar-wrap">
            <div class="util-bar-bg">
              <div class="util-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="util-pct">${pct}%</span>
          </div>
        </td>
        <td>
          <span class="badge ${t.isActive ? 'badge-active' : ''}">
            ${t.isActive ? 'Active' : 'Suspended'}
          </span>
        </td>
      </tr>`;
  }).join('');
};

const renderDrawdown = () => {
  const list = document.getElementById('draw-event-list');
  list.innerHTML = state.drawdowns.map(d => `
    <div class="event-item">
      <div class="event-icon" style="background:rgba(6,182,212,0.15); color:#06b6d4;">↓</div>
      <div class="event-body">
        <p class="event-title"><strong>${d.drawdownId}</strong> · ${usd(d.amount)} USD</p>
        <p class="event-meta">Requested by ${d.controller} · Pro-Rata Distributed · ${fmtTime(d.timestamp)}</p>
      </div>
      <span class="badge badge-active">Executed</span>
    </div>
  `).join('');
};

const renderInterest = () => {
  const visible = getVisibleInterestContracts();
  const grid = document.getElementById('interest-contracts-grid');
  const receiptsList = document.getElementById('interest-receipts-list');

  const totalAccrued = visible.reduce((acc, c) => acc + c.accruedInterest, 0);
  document.getElementById('stat-total-interest').textContent = usd(totalAccrued);

  if (visible.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: rgba(15,23,42,0.5); border-radius: 12px; border: 1px dashed rgba(139,92,246,0.3); color: #94a3b8;">
        🔒 Interest Accrual contracts are bilateral between Agent and participating Lenders.<br>
        <span style="font-size: 0.8rem; color: #a78bfa;">Not visible to ${activeParty} under Canton sub-tx privacy.</span>
      </div>`;
  } else {
    grid.innerHTML = visible.map(c => `
      <div class="tranche-card">
        <div class="tranche-card-header">
          <span class="tranche-card-title">${c.lender} · ${c.trancheId}</span>
          <span class="badge badge-active">${c.isSettled ? 'Settled' : 'Accruing'}</span>
        </div>
        <div class="tranche-card-body">
          <div class="tcb-row">
            <span class="tcb-label">Principal Balance:</span>
            <span class="tcb-val">${usd(c.principalBalance)}</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">Base Rate (SOFR):</span>
            <span class="tcb-val">${(c.baseRateBps / 100).toFixed(2)}% (${c.baseRateBps} bps)</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">Margin Spread:</span>
            <span class="tcb-val">${(c.marginSpreadBps / 100).toFixed(2)}% (${c.marginSpreadBps} bps)</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">All-In Rate:</span>
            <span class="tcb-val text-cyan font-bold">${(c.allInRateBps / 100).toFixed(2)}%</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">Accrual Basis:</span>
            <span class="tcb-val">${c.dayCountConvention}</span>
          </div>
          <div class="tcb-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <span class="tcb-label">Accrued Interest:</span>
            <span class="tcb-val text-accent" style="font-size: 1.2rem; font-weight: 700;">${usd(c.accruedInterest)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  receiptsList.innerHTML = state.interestReceipts.length === 0
    ? `<p style="color:#94a3b8; font-size:0.85rem; padding: 1rem 0;">No interest receipts settled yet.</p>`
    : state.interestReceipts.map(r => `
        <div class="receipt-card">
          <div class="receipt-header">
            <strong>${r.trancheId}</strong>
            <span class="badge badge-active">Settled</span>
          </div>
          <p style="font-size:0.85rem; color:#cbd5e1; margin-top:0.25rem;">
            Paid ${usd(r.accruedInterest)} to ${r.lender} on ${r.settlementDate} (Rate: ${(r.allInRateBps/100).toFixed(2)}%)
          </p>
        </div>
      `).join('');
};

const renderFees = () => {
  const visible = getVisibleFeeContracts();
  const grid = document.getElementById('fee-cards-grid');
  const receiptsList = document.getElementById('fee-receipts-list');

  const totalUndrawn = visible.reduce((acc, c) => acc + c.undrawnAmount, 0);
  const totalAccrued = visible.reduce((acc, c) => acc + c.accruedFee, 0);

  document.getElementById('stat-total-undrawn').textContent = usd(totalUndrawn);
  document.getElementById('stat-total-accrued-fees').textContent = usd(totalAccrued);

  if (visible.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; background: rgba(15,23,42,0.5); border-radius: 12px; border: 1px dashed rgba(6,182,212,0.3); color: #94a3b8;">
        🔒 Commitment Fee contracts are strictly bilateral.<br>
        <span style="font-size: 0.8rem; color: #67e8f9;">Not visible to ${activeParty}.</span>
      </div>`;
  } else {
    grid.innerHTML = visible.map(c => `
      <div class="tranche-card">
        <div class="tranche-card-header">
          <span class="tranche-card-title">${c.lender} · ${c.trancheId}</span>
          <span class="badge badge-canton">50 bps</span>
        </div>
        <div class="tranche-card-body">
          <div class="tcb-row">
            <span class="tcb-label">Total Commitment:</span>
            <span class="tcb-val">${usd(c.commitmentAmount)}</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">Drawn Portion:</span>
            <span class="tcb-val">${usd(c.drawnAmount)}</span>
          </div>
          <div class="tcb-row">
            <span class="tcb-label">Undrawn Capacity:</span>
            <span class="tcb-val text-cyan font-bold">${usd(c.undrawnAmount)}</span>
          </div>
          <div class="tcb-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <span class="tcb-label">Accrued Commitment Fee:</span>
            <span class="tcb-val text-accent" style="font-size: 1.2rem; font-weight: 700;">${usd(c.accruedFee)}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  receiptsList.innerHTML = state.feeReceipts.length === 0
    ? `<p style="color:#94a3b8; font-size:0.85rem; padding: 1rem 0;">No commitment fee receipts issued yet.</p>`
    : state.feeReceipts.map(r => `
        <div class="receipt-card">
          <div class="receipt-header">
            <strong>${r.trancheId}</strong>
            <span class="badge badge-active">Issued</span>
          </div>
          <p style="font-size:0.85rem; color:#cbd5e1; margin-top:0.25rem;">
            Collected ${usd(r.accruedFee)} on ${r.settlementDate} (Undrawn basis: ${usd(r.undrawnAmount)})
          </p>
        </div>
      `).join('');
};

const renderCovenants = () => {
  const cov = state.covenants;
  const grid = document.getElementById('covenants-metrics-grid');
  const badgeWrap = document.getElementById('covenant-global-status-badge');
  const noticeWrap = document.getElementById('covenant-notice-container');

  const statusColors = {
    Compliant:     'badge-active',
    Breached:      'badge badge-danger',
    WaivedByAgent: 'badge badge-warning',
    Accelerated:   'badge badge-danger',
  };

  badgeWrap.innerHTML = `<span class="badge ${statusColors[cov.breachStatus] || 'badge-active'}">${cov.breachStatus}</span>`;

  const isLevBreach = cov.leverageActual > cov.maxLeverageRatio;
  const isDscrBreach = cov.dscrActual < cov.minDSCR;
  const isLtvBreach = cov.ltvActual > cov.maxLTV;
  const isLiqBreach = cov.liquidityActual < cov.minLiquidity;

  grid.innerHTML = `
    <div class="covenant-card ${isLevBreach ? 'is-breached' : ''}">
      <div class="cov-card-header">
        <span class="cov-title">Leverage Ratio</span>
        <span class="badge ${isLevBreach ? 'btn-danger' : 'badge-active'}">${isLevBreach ? 'BREACH' : 'OK'}</span>
      </div>
      <div class="cov-ratio-display">
        <span class="cov-val-large ${isLevBreach ? 'text-danger' : 'text-cyan'}">${cov.leverageActual.toFixed(2)}x</span>
        <span class="cov-limit-label">Max ${cov.maxLeverageRatio.toFixed(2)}x</span>
      </div>
      <div class="cov-bar-bg">
        <div class="cov-bar-fill ${isLevBreach ? 'fill-red' : 'fill-green'}" style="width: ${Math.min(100, (cov.leverageActual / cov.maxLeverageRatio) * 100)}%"></div>
      </div>
    </div>

    <div class="covenant-card ${isDscrBreach ? 'is-breached' : ''}">
      <div class="cov-card-header">
        <span class="cov-title">Debt Service Coverage (DSCR)</span>
        <span class="badge ${isDscrBreach ? 'btn-danger' : 'badge-active'}">${isDscrBreach ? 'BREACH' : 'OK'}</span>
      </div>
      <div class="cov-ratio-display">
        <span class="cov-val-large ${isDscrBreach ? 'text-danger' : 'text-cyan'}">${cov.dscrActual.toFixed(2)}x</span>
        <span class="cov-limit-label">Min ${cov.minDSCR.toFixed(2)}x</span>
      </div>
      <div class="cov-bar-bg">
        <div class="cov-bar-fill ${isDscrBreach ? 'fill-red' : 'fill-green'}" style="width: ${Math.min(100, (cov.dscrActual / cov.minDSCR) * 100)}%"></div>
      </div>
    </div>

    <div class="covenant-card ${isLtvBreach ? 'is-breached' : ''}">
      <div class="cov-card-header">
        <span class="cov-title">Loan-to-Value (LTV)</span>
        <span class="badge ${isLtvBreach ? 'btn-danger' : 'badge-active'}">${isLtvBreach ? 'BREACH' : 'OK'}</span>
      </div>
      <div class="cov-ratio-display">
        <span class="cov-val-large ${isLtvBreach ? 'text-danger' : 'text-cyan'}">${(cov.ltvActual * 100).toFixed(1)}%</span>
        <span class="cov-limit-label">Max ${(cov.maxLTV * 100).toFixed(1)}%</span>
      </div>
      <div class="cov-bar-bg">
        <div class="cov-bar-fill ${isLtvBreach ? 'fill-red' : 'fill-green'}" style="width: ${Math.min(100, (cov.ltvActual / cov.maxLTV) * 100)}%"></div>
      </div>
    </div>

    <div class="covenant-card ${isLiqBreach ? 'is-breached' : ''}">
      <div class="cov-card-header">
        <span class="cov-title">Minimum Liquidity</span>
        <span class="badge ${isLiqBreach ? 'btn-danger' : 'badge-active'}">${isLiqBreach ? 'BREACH' : 'OK'}</span>
      </div>
      <div class="cov-ratio-display">
        <span class="cov-val-large ${isLiqBreach ? 'text-danger' : 'text-cyan'}">${usd(cov.liquidityActual)}</span>
        <span class="cov-limit-label">Min ${usd(cov.minLiquidity)}</span>
      </div>
      <div class="cov-bar-bg">
        <div class="cov-bar-fill ${isLiqBreach ? 'fill-red' : 'fill-green'}" style="width: ${Math.min(100, (cov.liquidityActual / cov.minLiquidity) * 100)}%"></div>
      </div>
    </div>
  `;

  if (state.covenantNotice) {
    noticeWrap.innerHTML = `
      <div class="notice-card">
        <div class="notice-title">🚨 ON-LEDGER DEFAULT & ACCELERATION NOTICE</div>
        <p style="font-size:0.9rem; line-height:1.5;">${state.covenantNotice.noticeText}</p>
        <p style="font-size:0.8rem; color:#f87171; margin-top:0.5rem; font-family:var(--font-mono)">
          Accelerated on ${state.covenantNotice.accelerationDate} · Signatory: Agent · Observers: Borrower, Lenders, Regulator
        </p>
      </div>`;
  } else {
    noticeWrap.innerHTML = '';
  }
};

const renderAmendments = () => {
  const container = document.getElementById('amendment-proposals-container');
  const recordsList = document.getElementById('amendment-records-list');

  if (state.amendments.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; font-size:0.9rem;">No active amendment proposals.</p>`;
  } else {
    container.innerHTML = state.amendments.map(a => {
      const totalLenders = a.lenders.length;
      const acceptCount  = a.acceptedBy.length;
      const rejectCount  = a.rejectedBy.length;
      const thresholdMet = a.requiresUnanimous ? (acceptCount === totalLenders) : (acceptCount * 2 > totalLenders);

      return `
        <div class="amendment-card">
          <div class="amend-meta-row">
            <div>
              <h4 style="color:#f8fafc; font-size:1.1rem; margin-bottom:0.25rem;">${a.proposalId} · ${a.amendmentType}</h4>
              <p style="color:#94a3b8; font-size:0.85rem;">${a.rationale}</p>
            </div>
            <span class="badge ${thresholdMet ? 'badge-active' : 'badge-warning'}">
              ${a.isExecuted ? 'Executed' : thresholdMet ? 'Consent Reached' : 'Voting In Progress'}
            </span>
          </div>

          <div style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0.75rem;">
            ${a.proposedNewLimit ? `<strong>Proposed Limit:</strong> ${usd(a.proposedNewLimit)} (Expansion: +${usd(a.proposedNewLimit - state.facility.totalLimit)})` : ''}
            ${a.proposedNewMaturity ? `<strong>Proposed Maturity:</strong> ${a.proposedNewMaturity}` : ''}
            · <strong>Deadline:</strong> ${a.expiryDate}
          </div>

          <div class="vote-tally-bar">
            <span style="font-size:0.85rem; font-weight:600;">Lender Votes (${acceptCount}/${totalLenders}):</span>
            ${a.lenders.map(l => {
              const hasAccepted = a.acceptedBy.includes(l);
              const hasRejected = a.rejectedBy.includes(l);
              const statusClass = hasAccepted ? 'accepted' : hasRejected ? 'rejected' : 'pending';
              const text        = hasAccepted ? `${l} (Yes)` : hasRejected ? `${l} (No)` : `${l} (Pending)`;
              return `<span class="vote-pill ${statusClass}">${text}</span>`;
            }).join('')}
          </div>

          <div class="form-actions form-actions--inline" style="margin-top:1rem;">
            ${(activeParty === 'bankA' || activeParty === 'bankB') && !a.isExecuted ? `
              <button class="btn btn-secondary" onclick="castVote('${a.proposalId}', true)">Accept Proposal</button>
              <button class="btn btn-danger" onclick="castVote('${a.proposalId}', false)">Reject Proposal</button>
            ` : ''}
            ${activeParty === 'agent' && !a.isExecuted ? `
              <button class="btn btn-primary" onclick="executeProposal('${a.proposalId}')" ${!thresholdMet ? 'disabled title="Consent threshold not yet met"' : ''}>
                Execute Amendment (${a.requiresUnanimous ? 'Unanimous' : 'Majority'})
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  recordsList.innerHTML = state.amendmentRecords.length === 0
    ? `<p style="color:#94a3b8; font-size:0.85rem; padding: 1rem 0;">No executed amendments yet.</p>`
    : state.amendmentRecords.map(r => `
        <div class="receipt-card">
          <div class="receipt-header">
            <strong>${r.proposalId} — ${r.amendmentType}</strong>
            <span class="badge badge-active">Executed</span>
          </div>
          <p style="font-size:0.85rem; color:#cbd5e1; margin-top:0.25rem;">
            ${r.rationale} (Consented by ${r.acceptedBy.join(', ')})
          </p>
        </div>
      `).join('');
};

const renderSettlement = () => {
  const container = document.getElementById('receipt-items');
  if (state.receipts.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; padding: 1rem 0;">No repayments settled yet.</p>`;
    return;
  }
  container.innerHTML = state.receipts.map(r => `
    <div class="receipt-card">
      <div class="receipt-header">
        <strong>${r.trancheId}</strong>
        <span class="badge badge-active">Settled</span>
      </div>
      <p style="font-size:0.85rem; color:#cbd5e1; margin-top:0.25rem;">
        Principal: ${usd(r.principalRepaid)} · Interest: ${usd(r.interestPaid)} · Timestamp: ${fmtTime(r.timestamp)}
      </p>
    </div>
  `).join('');
};

const renderAudit = () => {
  const timeline = document.getElementById('audit-timeline');
  timeline.innerHTML = state.auditLog.map(item => `
    <div class="audit-item">
      <div class="audit-dot" style="background:${item.color}; box-shadow:0 0 10px ${item.color}80;"></div>
      <div class="audit-body">
        <div class="audit-header">
          <span class="audit-type" style="color:${item.color};">${item.type}</span>
          <span class="audit-time">${fmtTime(item.timestamp)}</span>
        </div>
        <p class="audit-title">${item.title}</p>
        <p class="audit-detail">${item.detail}</p>
      </div>
    </div>
  `).join('');
};

const renderAll = () => {
  renderOverview();
  renderTranches();
  renderDrawdown();
  renderInterest();
  renderFees();
  renderCovenants();
  renderAmendments();
  renderSettlement();
  renderAudit();
};

// =============================================================================
// ACTIONS & FORM HANDLERS
// =============================================================================

// Cast amendment vote (global for onclick)
window.castVote = (proposalId, accept) => {
  const partyName = activeParty === 'bankA' ? 'JPMorgan Chase' : activeParty === 'bankB' ? 'Deutsche Bank' : null;
  if (!partyName) {
    toast('Only participating syndicate lenders can cast votes.', 'error');
    return;
  }
  const prop = state.amendments.find(a => a.proposalId === proposalId);
  if (!prop) return;

  if (prop.acceptedBy.includes(partyName) || prop.rejectedBy.includes(partyName)) {
    toast(`${partyName} has already cast a vote on this proposal.`, 'warning');
    return;
  }

  if (accept) {
    prop.acceptedBy.push(partyName);
    toast(`${partyName} voted ACCEPT for ${proposalId}`, 'success');
  } else {
    prop.rejectedBy.push(partyName);
    toast(`${partyName} voted REJECT for ${proposalId}`, 'warning');
  }

  logAudit(
    'AmendmentVoted',
    `Lender Vote Cast: ${partyName}`,
    `${partyName} voted ${accept ? 'ACCEPT' : 'REJECT'} on ${proposalId}`,
    accept ? '#10b981' : '#ef4444'
  );
  renderAmendments();
};

// Execute amendment (global for onclick)
window.executeProposal = proposalId => {
  const prop = state.amendments.find(a => a.proposalId === proposalId);
  if (!prop) return;

  const total = prop.lenders.length;
  const acceptCount = prop.acceptedBy.length;
  const met = prop.requiresUnanimous ? (acceptCount === total) : (acceptCount * 2 > total);

  if (!met) {
    toast(`Cannot execute: Required consent threshold not reached. (${acceptCount}/${total})`, 'error');
    return;
  }

  prop.isExecuted = true;
  if (prop.proposedNewLimit) {
    state.facility.totalLimit = prop.proposedNewLimit;
  }

  state.amendmentRecords.unshift({
    proposalId:   prop.proposalId,
    amendmentType: prop.amendmentType,
    rationale:    prop.rationale,
    acceptedBy:   [...prop.acceptedBy],
    executionDate: new Date().toISOString().split('T')[0],
  });

  toast(`Amendment ${proposalId} executed on-ledger!`, 'success');
  logAudit(
    'AmendmentExecuted',
    `Facility Amendment Executed: ${prop.amendmentType}`,
    `${proposalId} executed. New Limit: ${usd(state.facility.totalLimit)}`,
    '#06b6d4'
  );
  renderAll();
};

const setupForms = () => {
  // Drawdown Form
  const drawForm = document.getElementById('drawdown-form');
  if (drawForm) {
    drawForm.addEventListener('submit', e => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('d-amount').value);
      const headroom = state.facility.totalLimit - state.facility.drawnAmount;

      if (isNaN(amount) || amount <= 0) {
        toast('Please enter a valid positive drawdown amount.', 'error');
        return;
      }
      if (amount > headroom) {
        toast(`Drawdown rejected: Requested ${usd(amount)} exceeds available headroom ${usd(headroom)}`, 'error');
        return;
      }

      state.facility.drawnAmount += amount;
      // Pro-rata distribution: JPMorgan Chase 60%, Deutsche Bank 40%
      const alphaDraw = amount * 0.6;
      const betaDraw  = amount * 0.4;
      state.tranches[0].drawnAmount += alphaDraw;
      state.tranches[1].drawnAmount += betaDraw;

      // Update interest & fee contracts drawn/undrawn balances
      state.interestContracts[0].principalBalance += alphaDraw;
      state.interestContracts[1].principalBalance += betaDraw;
      state.feeContracts[0].drawnAmount += alphaDraw;
      state.feeContracts[0].undrawnAmount = Math.max(0, state.feeContracts[0].commitmentAmount - state.feeContracts[0].drawnAmount);
      state.feeContracts[1].drawnAmount += betaDraw;
      state.feeContracts[1].undrawnAmount = Math.max(0, state.feeContracts[1].commitmentAmount - state.feeContracts[1].drawnAmount);

      const drawId = `DRAW-00${state.drawdowns.length + 1}`;
      state.drawdowns.unshift({
        drawdownId: drawId,
        amount,
        executed: true,
        timestamp: new Date().toISOString(),
        controller: 'Amazon Capital',
      });

      toast(`Drawdown ${drawId} for ${usd(amount)} executed!`, 'success');
      logAudit(
        'DrawdownExecuted',
        `Drawdown ${drawId} Distributed`,
        `JPMorgan Chase: +${usd(alphaDraw)} (60%) · Deutsche Bank: +${usd(betaDraw)} (40%)`,
        '#10b981'
      );
      renderAll();
      drawForm.reset();
    });
  }

  // Interest Accrue Form
  const accrueForm = document.getElementById('interest-accrue-form');
  if (accrueForm) {
    accrueForm.addEventListener('submit', e => {
      e.preventDefault();
      const lenderKey = document.getElementById('int-tranche').value;
      const convention = document.getElementById('int-convention').value;
      const contract = state.interestContracts.find(c => c.lenderKey === lenderKey);

      if (!contract) return;
      contract.dayCountConvention = convention;
      // Actual/365 calculation for demo increment
      const dailyRate = (contract.allInRateBps / 10000) / (convention === 'Actual360' ? 360 : 365);
      const addedInterest = contract.principalBalance * dailyRate * 30; // 30 days
      contract.accruedInterest += addedInterest;

      toast(`Accrued ${usd(addedInterest)} interest for ${contract.lender}`, 'success');
      logAudit(
        'InterestAccrued',
        `Interest Accrued: ${contract.lender}`,
        `Calculated 30-day accrual on ${usd(contract.principalBalance)} @ ${(contract.allInRateBps/100).toFixed(2)}% (${convention})`,
        '#06b6d4'
      );
      renderInterest();
    });

    document.getElementById('btn-collect-interest')?.addEventListener('click', () => {
      const lenderKey = document.getElementById('int-tranche').value;
      const contract = state.interestContracts.find(c => c.lenderKey === lenderKey);
      if (!contract || contract.accruedInterest <= 0) {
        toast('No accrued interest to collect for this tranche.', 'warning');
        return;
      }

      state.interestReceipts.unshift({
        trancheId:      contract.trancheId,
        lender:         contract.lender,
        accruedInterest: contract.accruedInterest,
        allInRateBps:   contract.allInRateBps,
        settlementDate: new Date().toISOString().split('T')[0],
      });

      const collected = contract.accruedInterest;
      contract.accruedInterest = 0;
      contract.isSettled = true;

      toast(`Collected & settled ${usd(collected)} interest for ${contract.lender}!`, 'success');
      logAudit(
        'InterestCollected',
        `Interest Payment Settled: ${contract.lender}`,
        `Settled ${usd(collected)} via Agent. InterestPaymentReceipt created.`,
        '#10b981'
      );
      renderInterest();
    });
  }

  // Commitment Fee Form
  document.getElementById('btn-accrue-fee')?.addEventListener('click', () => {
    const lenderKey = document.getElementById('fee-lender').value;
    const contract = state.feeContracts.find(c => c.lenderKey === lenderKey);
    if (!contract) return;

    const dailyFeeRate = (contract.feeBps / 10000) / 365;
    const addedFee = contract.undrawnAmount * dailyFeeRate * 30;
    contract.accruedFee += addedFee;

    toast(`Accrued ${usd(addedFee)} commitment fee for ${contract.lender}`, 'success');
    logAudit(
      'CommitmentFeeAccrued',
      `Commitment Fee Accrued: ${contract.lender}`,
      `Accrued on ${usd(contract.undrawnAmount)} undrawn base @ 50 bps`,
      '#f59e0b'
    );
    renderFees();
  });

  document.getElementById('btn-collect-fee')?.addEventListener('click', () => {
    const lenderKey = document.getElementById('fee-lender').value;
    const contract = state.feeContracts.find(c => c.lenderKey === lenderKey);
    if (!contract || contract.accruedFee <= 0) {
      toast('No accrued commitment fee to collect.', 'warning');
      return;
    }

    state.feeReceipts.unshift({
      trancheId:     contract.trancheId,
      lender:        contract.lender,
      undrawnAmount: contract.undrawnAmount,
      accruedFee:    contract.accruedFee,
      settlementDate: new Date().toISOString().split('T')[0],
    });

    const collected = contract.accruedFee;
    contract.accruedFee = 0;

    toast(`Issued CommitmentFeeReceipt: ${usd(collected)} for ${contract.lender}`, 'success');
    logAudit(
      'CommitmentFeeCollected',
      `Fee Receipt Issued: ${contract.lender}`,
      `Settled ${usd(collected)} on ${usd(contract.undrawnAmount)} undrawn capacity.`,
      '#10b981'
    );
    renderFees();
  });

  // Covenant Form
  const covForm = document.getElementById('covenant-test-form');
  if (covForm) {
    covForm.addEventListener('submit', e => {
      e.preventDefault();
      const lev  = parseFloat(document.getElementById('cov-leverage').value);
      const dscr = parseFloat(document.getElementById('cov-dscr').value);
      const ltv  = parseFloat(document.getElementById('cov-ltv').value) / 100;
      const liq  = parseFloat(document.getElementById('cov-liquidity').value);
      const testDate = document.getElementById('cov-test-date').value || new Date().toISOString().split('T')[0];

      if (isNaN(lev) || isNaN(dscr) || isNaN(ltv) || isNaN(liq)) {
        toast('Please fill out all financial ratio fields.', 'error');
        return;
      }

      state.covenants.leverageActual  = lev;
      state.covenants.dscrActual      = dscr;
      state.covenants.ltvActual       = ltv;
      state.covenants.liquidityActual = liq;
      state.covenants.lastTestDate    = testDate;

      const hasBreach = lev > state.covenants.maxLeverageRatio ||
                        dscr < state.covenants.minDSCR ||
                        ltv > state.covenants.maxLTV ||
                        liq < state.covenants.minLiquidity;

      state.covenants.breachStatus = hasBreach ? 'Breached' : 'Compliant';

      if (hasBreach) {
        toast(`⚠️ COVENANT BREACH DETECTED on ${testDate}! Status: Breached`, 'error');
        logAudit(
          'CovenantBreach',
          'Quarterly Covenant Breach Detected',
          `Leverage: ${lev.toFixed(2)}x (max 4.5x) · DSCR: ${dscr.toFixed(2)}x (min 1.25x)`,
          '#ef4444'
        );
      } else {
        toast(`✓ Covenants verified compliant on ${testDate}`, 'success');
        logAudit(
          'CovenantTestPassed',
          'Quarterly Covenants Compliant',
          `All financial ratios satisfy credit agreement requirements.`,
          '#10b981'
        );
      }
      renderCovenants();
    });

    document.getElementById('btn-waive-breach')?.addEventListener('click', () => {
      if (state.covenants.breachStatus !== 'Breached') {
        toast('Cannot waive: Facility covenants are currently Compliant.', 'warning');
        return;
      }
      const reason = prompt('Enter formal waiver justification / cure plan:', 'Borrower provided 90-day deleveraging plan.');
      if (!reason) return;

      state.covenants.breachStatus = 'WaivedByAgent';
      state.covenants.waiverReason = reason;
      toast(`Covenant breach waived by Agent.`, 'warning');
      logAudit(
        'CovenantWaived',
        'Covenant Breach Waived by Agent',
        `Reason: ${reason}`,
        '#f59e0b'
      );
      renderCovenants();
    });

    document.getElementById('btn-accelerate-breach')?.addEventListener('click', () => {
      if (state.covenants.breachStatus !== 'Breached') {
        toast('Acceleration requires an active, un-waived Covenant Breach.', 'error');
        return;
      }
      const notice = prompt('Confirm Acceleration Notice Text:', 'NOTICE OF DEFAULT: Agent hereby accelerates entire $100M facility due to covenant default.');
      if (!notice) return;

      state.covenants.breachStatus = 'Accelerated';
      state.covenantNotice = {
        noticeText: notice,
        accelerationDate: new Date().toISOString().split('T')[0],
      };

      toast(`🚨 FACILITY ACCELERATED! CovenantBreachNotice broadcast on-ledger.`, 'error');
      logAudit(
        'FacilityAccelerated',
        'DEFAULT ACCELERATION EXECUTED',
        `Permanent CovenantBreachNotice published to Borrower, Lenders, and Regulator.`,
        '#dc2626'
      );
      renderCovenants();
    });
  }

  // Amendment Form
  const amendForm = document.getElementById('amendment-proposal-form');
  if (amendForm) {
    const typeSelect = document.getElementById('amend-type');
    typeSelect?.addEventListener('change', () => {
      const isLimit = typeSelect.value === 'IncreaseCreditLimit' || typeSelect.value === 'ReduceCreditLimit';
      const isMaturity = typeSelect.value === 'ExtendMaturity';
      document.getElementById('amend-limit-group').style.display = isLimit ? 'block' : 'none';
      document.getElementById('amend-maturity-group').style.display = isMaturity ? 'block' : 'none';
    });

    amendForm.addEventListener('submit', e => {
      e.preventDefault();
      const type = typeSelect.value;
      const newLimit = parseFloat(document.getElementById('amend-new-limit').value);
      const newMaturity = document.getElementById('amend-new-maturity').value;
      const expiry = document.getElementById('amend-expiry').value || '2026-12-31';
      const rationale = document.getElementById('amend-rationale').value;

      const propId = `AMEND-FAC-2026-00${state.amendments.length + 1}`;
      state.amendments.unshift({
        proposalId: propId,
        facilityId: state.facility.facilityId,
        amendmentType: type,
        proposedNewLimit: isNaN(newLimit) ? null : newLimit,
        proposedNewMaturity: newMaturity || null,
        rationale,
        proposalDate: new Date().toISOString().split('T')[0],
        expiryDate: expiry,
        lenders: ['JPMorgan Chase', 'Deutsche Bank'],
        acceptedBy: [],
        rejectedBy: [],
        isExecuted: false,
        requiresUnanimous: type === 'IncreaseCreditLimit' || type === 'ChangeCurrency',
      });

      toast(`Amendment proposal ${propId} submitted for syndicate vote!`, 'success');
      logAudit(
        'AmendmentProposed',
        `New Amendment Proposed: ${type}`,
        `${propId} proposed by Borrower & Agent · Voting open until ${expiry}`,
        '#06b6d4'
      );
      renderAmendments();
      amendForm.reset();
    });
  }

  // Settlement Form
  const settleForm = document.getElementById('settlement-form');
  if (settleForm) {
    settleForm.addEventListener('submit', e => {
      e.preventDefault();
      const lenderKey = document.getElementById('s-lender').value;
      const principal = parseFloat(document.getElementById('s-principal').value) || 0;
      const interest  = parseFloat(document.getElementById('s-interest').value) || 0;
      const tranche   = state.tranches.find(t => t.lenderKey === lenderKey);

      if (!tranche) {
        toast('Please select a valid lender tranche.', 'error');
        return;
      }
      if (principal > tranche.drawnAmount) {
        toast(`Repayment exceeds drawn principal (${usd(tranche.drawnAmount)})`, 'error');
        return;
      }

      tranche.drawnAmount -= principal;
      state.facility.drawnAmount -= principal;

      state.receipts.unshift({
        trancheId: tranche.id,
        lender: tranche.lender,
        principalRepaid: principal,
        interestPaid: interest,
        timestamp: new Date().toISOString(),
      });

      toast(`SettleRepayment executed for ${tranche.lender}!`, 'success');
      logAudit(
        'RepaymentSettled',
        `Repayment Settled: ${tranche.lender}`,
        `Principal: ${usd(principal)} · Interest: ${usd(interest)}`,
        '#10b981'
      );
      renderAll();
      settleForm.reset();
    });
  }
};

// =============================================================================
// SETUP TABS, PARTY SELECTOR, & NETWORK SWITCHER
// =============================================================================

const setupNavigation = () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`panel-${target}`)?.classList.add('active');
    });
  });

  const partySelect = document.getElementById('party-select');
  if (partySelect) {
    partySelect.addEventListener('change', () => {
      activeParty = partySelect.value;
      renderAll();
      toast(`Perspective switched to: ${partySelect.options[partySelect.selectedIndex].text}`, 'info');
    });
  }

  const modeSelect = document.getElementById('network-mode-select');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      networkMode = modeSelect.value;
      const statusText = document.getElementById('ledger-status-text');
      if (networkMode === 'live-local') {
        statusText.textContent = 'Canton LocalNet (Live)';
        toast('Connected to Canton LocalNet Participant Nodes.', 'success');
      } else {
        statusText.textContent = 'Interactive Sandbox';
        toast('Switched to Interactive Sandbox mode.', 'info');
      }
      renderAll();
    });
  }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupForms();

  // Set default form dates
  const today = new Date().toISOString().split('T')[0];
  const dateInputs = ['int-accrual-date', 'fee-action-date', 'cov-test-date', 'amend-expiry'];
  dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });

  // ─── Error Modal dismiss ──────────────────────────────────────────────────
  const errCloseBtn = document.getElementById('error-modal-close-btn');
  if (errCloseBtn) {
    errCloseBtn.addEventListener('click', () => {
      document.getElementById('error-modal-overlay').style.display = 'none';
    });
  }
  const errDetailToggle = document.getElementById('error-detail-toggle');
  if (errDetailToggle) {
    errDetailToggle.addEventListener('click', () => {
      const detailEl = document.getElementById('error-modal-detail');
      const expanded = errDetailToggle.getAttribute('aria-expanded') === 'true';
      errDetailToggle.setAttribute('aria-expanded', String(!expanded));
      errDetailToggle.textContent = expanded ? 'Show technical detail ▼' : 'Hide technical detail ▲';
      detailEl.style.display = expanded ? 'none' : 'block';
    });
    // Initially hide detail pre
    const detailEl = document.getElementById('error-modal-detail');
    if (detailEl) detailEl.style.display = 'none';
  }
  // Close error modal on overlay click
  const errOverlay = document.getElementById('error-modal-overlay');
  if (errOverlay) {
    errOverlay.addEventListener('click', (e) => {
      if (e.target === errOverlay) errOverlay.style.display = 'none';
    });
  }

  // ─── Login form handler ──────────────────────────────────────────────────
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const party  = document.getElementById('login-party-select').value;
      const token  = document.getElementById('login-jwt-input').value;
      const mode   = document.getElementById('login-mode-select').value;
      const errEl  = document.getElementById('login-error');
      const btn    = document.getElementById('login-submit-btn');
      const spinner = document.getElementById('login-spinner');

      // Clear previous errors
      errEl.style.display = 'none';

      try {
        btn.disabled = true;
        spinner.classList.add('active');
        // Simulate brief auth handshake delay for UX
        setTimeout(() => {
          try {
            auth.login(party, token, mode);
          } catch (authErr) {
            errEl.textContent = authErr.message || 'Authentication failed.';
            errEl.style.display = 'block';
          } finally {
            btn.disabled = false;
            spinner.classList.remove('active');
          }
        }, 600);
      } catch (err) {
        errEl.textContent = err.message || 'Authentication failed.';
        errEl.style.display = 'block';
        btn.disabled = false;
        spinner.classList.remove('active');
      }
    });
  }

  // ─── Token eye toggle ────────────────────────────────────────────────────
  const eyeBtn = document.getElementById('token-eye-btn');
  const jwtInput = document.getElementById('login-jwt-input');
  if (eyeBtn && jwtInput) {
    eyeBtn.addEventListener('click', () => {
      const isPassword = jwtInput.type === 'password';
      jwtInput.type = isPassword ? 'text' : 'password';
    });
  }

  // ─── Logout button ───────────────────────────────────────────────────────
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => auth.logout());
  }

  // ─── Party selector syncs with session ───────────────────────────────────
  const partySelect = document.getElementById('party-select');
  if (partySelect) {
    partySelect.addEventListener('change', () => {
      activeParty = partySelect.value;
      // Update session chip
      const info = PARTY_DISPLAY_NAMES[activeParty] || { name: activeParty, avatar: activeParty[0].toUpperCase(), role: '' };
      const avatarEl = document.getElementById('session-avatar');
      const nameEl   = document.getElementById('session-name');
      if (avatarEl) avatarEl.textContent = info.avatar;
      if (nameEl)   nameEl.textContent   = `${info.name} (${info.role})`;
      sessionStorage.setItem('syndex_party', activeParty);
      renderAll();
      toast('Party Switched', `Perspective: ${info.name} (${info.role})`, 'info');
    });
  }

  // ─── Try restore session or show login ───────────────────────────────────
  const restored = auth.restore();
  if (!restored) {
    // Show login screen — it's already visible by default
    renderAll(); // render empty state behind login
  }
});
