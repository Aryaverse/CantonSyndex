/**
 * CantonSyndex Dashboard — main.js
 * Simulated Canton Ledger state for enterprise demo.
 * In production, replace simulatedState with SyndexLedgerBridge calls.
 */

'use strict';

// =============================================================================
// SIMULATED CANTON LEDGER STATE
// =============================================================================
const simulatedState = {
  facility: {
    facilityId:  'FAC-2026-USD-100M',
    currency:    'USD',
    totalLimit:  100_000_000,
    drawnAmount:  20_000_000,
    isActive:    true,
    regulator:   'CentralBank',
  },
  tranches: [
    {
      id:              'TRANCHE-ALPHA-001',
      lender:          'AlphaBank',
      lenderKey:       'bankA',
      commitmentAmount: 60_000_000,
      drawnAmount:      12_000_000,
      marginSpreadBps:  150.0,
      isActive:        true,
    },
    {
      id:              'TRANCHE-BETA-001',
      lender:          'BetaBank',
      lenderKey:       'bankB',
      commitmentAmount: 40_000_000,
      drawnAmount:       8_000_000,
      marginSpreadBps:  175.0,
      isActive:        true,
    },
  ],
  drawdowns: [
    {
      drawdownId: 'DRAW-001',
      amount:      20_000_000,
      executed:    true,
      timestamp:  '2026-08-28T09:15:00Z',
      controller:  'BorrowerCorp',
    },
  ],
  receipts: [],
  auditLog: [
    {
      type:      'FacilityCreated',
      color:     '#8b5cf6',
      title:     'MasterFacility Created',
      detail:    'FAC-2026-USD-100M · $100M USD · BorrowerCorp + GlobalLeadBank',
      timestamp: '2026-08-28T08:00:00Z',
    },
    {
      type:      'TrancheSyndicated',
      color:     '#f59e0b',
      title:     'Tranche Syndicated → AlphaBank',
      detail:    '$60,000,000 @ 150 bps · TRANCHE-ALPHA-001',
      timestamp: '2026-08-28T08:30:00Z',
    },
    {
      type:      'TrancheSyndicated',
      color:     '#ec4899',
      title:     'Tranche Syndicated → BetaBank',
      detail:    '$40,000,000 @ 175 bps · TRANCHE-BETA-001',
      timestamp: '2026-08-28T08:35:00Z',
    },
    {
      type:      'DrawdownRequested',
      color:     '#06b6d4',
      title:     'Drawdown Requested',
      detail:    'DRAW-001 · $20,000,000 · BorrowerCorp',
      timestamp: '2026-08-28T09:15:00Z',
    },
    {
      type:      'DrawdownDistributed',
      color:     '#10b981',
      title:     'Drawdown Distributed Pro-Rata',
      detail:    'AlphaBank: $12M (60%) · BetaBank: $8M (40%)',
      timestamp: '2026-08-28T09:15:03Z',
    },
  ],
};

// Current active party perspective (affects what data is shown)
let activeParty = 'agent';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Format number as USD */
const usd = n =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** Format timestamp as readable date */
const fmtTime = ts => {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return ts; }
};

/** Show toast notification */
const toast = (message, type = 'info') => {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  el.innerHTML = `<span style="font-size:1rem">${icon}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};

/** Get visible tranches based on active party (Canton privacy simulation) */
const getVisibleTranches = () => {
  switch (activeParty) {
    case 'agent':
    case 'borrower': return simulatedState.tranches; // Agent/Borrower see all tranches
    case 'bankA':    return simulatedState.tranches.filter(t => t.lenderKey === 'bankA');
    case 'bankB':    return simulatedState.tranches.filter(t => t.lenderKey === 'bankB');
    case 'regulator': return []; // Regulator only sees MasterFacility
    default:         return [];
  }
};

// =============================================================================
// TAB NAVIGATION
// =============================================================================
const setupTabs = () => {
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
};

// =============================================================================
// PARTY SELECTOR
// =============================================================================
const setupPartySelector = () => {
  const select = document.getElementById('party-select');
  select.addEventListener('change', () => {
    activeParty = select.value;
    renderAll();
    const partyNames = {
      agent: 'GlobalLeadBank (Agent)',
      borrower: 'BorrowerCorp',
      bankA: 'AlphaBank (Bank A)',
      bankB: 'BetaBank (Bank B)',
      regulator: 'CentralBank (Regulator)',
    };
    toast(`Switched to party: ${partyNames[activeParty]}`, 'info');
  });
};

// =============================================================================
// OVERVIEW PANEL
// =============================================================================
const renderOverview = () => {
  const { facility, tranches, drawdowns } = simulatedState;
  const utilized = facility.drawnAmount / facility.totalLimit;

  // KPI values
  document.getElementById('kpi-total-val').textContent    = usd(facility.totalLimit);
  document.getElementById('kpi-drawn-val').textContent    = usd(facility.drawnAmount);
  document.getElementById('kpi-headroom-val').textContent = usd(facility.totalLimit - facility.drawnAmount);
  document.getElementById('kpi-tranches-val').textContent = getVisibleTranches().length;
  document.getElementById('kpi-drawdowns-val').textContent = drawdowns.length;

  // KPI subs
  document.querySelector('#kpi-drawn .kpi-sub').textContent =
    `${(utilized * 100).toFixed(1)}% utilized`;
  document.querySelector('#kpi-headroom .kpi-sub').textContent =
    `${((1 - utilized) * 100).toFixed(1)}% remaining`;
  document.querySelector('#kpi-tranches .kpi-sub').textContent =
    getVisibleTranches().map(t => t.lender).join(' · ') || 'No visible tranches';

  // Gauge (arc from 20°→160° = 251 dash for full)
  const arcLength = 251;
  const dashOffset = arcLength - (utilized * arcLength);
  const gaugeArc = document.getElementById('gauge-arc');
  const gaugePct = document.getElementById('gauge-pct-text');
  if (gaugeArc) {
    gaugeArc.style.strokeDashoffset = dashOffset;
    gaugePct.textContent = `${(utilized * 100).toFixed(0)}%`;
  }

  // Facility amount display
  document.querySelector('.facility-amount').textContent = usd(facility.totalLimit);
};

// =============================================================================
// TRANCHES PANEL
// =============================================================================
const renderTranches = () => {
  const tbody  = document.getElementById('tranche-tbody');
  const visible = getVisibleTranches();

  if (visible.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color:var(--clr-text-dim); padding: 32px; font-size:0.85rem;">
          🔒 No tranche contracts visible to ${activeParty === 'regulator' ? 'CentralBank (Regulator)' : activeParty}
          <br><span style="font-size:0.72rem; font-family:var(--font-mono); color:var(--clr-text-dim)">
            Canton sub-transaction privacy enforced
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
          <span class="badge ${t.isActive ? 'badge-active' : ''}" style="${!t.isActive ? 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5' : ''}">
            ${t.isActive ? 'Active' : 'Suspended'}
          </span>
        </td>
      </tr>`;
  }).join('');
};

// Tranche form toggling
const setupTrancheForm = () => {
  const form    = document.getElementById('new-tranche-form');
  const btnNew  = document.getElementById('btn-new-tranche');
  const btnCancel = document.getElementById('btn-cancel-tranche');

  btnNew?.addEventListener('click', () => {
    if (activeParty !== 'agent') {
      toast('Only the Lead Agent (GlobalLeadBank) can syndicate tranches', 'error');
      return;
    }
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  btnCancel?.addEventListener('click', () => {
    form.style.display = 'none';
  });

  document.getElementById('tranche-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const lender = document.getElementById('t-lender').value;
    const amount = parseFloat(document.getElementById('t-amount').value);
    const bps    = parseFloat(document.getElementById('t-bps').value);

    if (!lender || isNaN(amount) || isNaN(bps)) {
      toast('Please fill all fields', 'error'); return;
    }

    const headroom = simulatedState.facility.totalLimit - simulatedState.facility.drawnAmount -
      simulatedState.tranches.reduce((s, t) => s + t.commitmentAmount, 0);

    if (amount > headroom + simulatedState.facility.totalLimit) {
      toast('Commitment exceeds facility headroom', 'error'); return;
    }

    const lenderNames = { bankA: 'AlphaBank', bankB: 'BetaBank', bankC: 'GammaBank' };
    simulatedState.tranches.push({
      id:               `TRANCHE-${lender.toUpperCase()}-${Date.now()}`,
      lender:           lenderNames[lender],
      lenderKey:        lender,
      commitmentAmount: amount,
      drawnAmount:      0,
      marginSpreadBps:  bps,
      isActive:         true,
    });

    addAuditEntry({
      type:      'TrancheSyndicated',
      color:     '#8b5cf6',
      title:     `Tranche Syndicated → ${lenderNames[lender]}`,
      detail:    `${usd(amount)} @ ${bps} bps · Agent: GlobalLeadBank`,
      timestamp: new Date().toISOString(),
    });

    toast(`✓ SyndicateTranche executed: ${lenderNames[lender]} ${usd(amount)} @ ${bps}bps`, 'success');
    form.style.display = 'none';
    e.target.reset();
    renderAll();
  });
};

// =============================================================================
// DRAWDOWN PANEL
// =============================================================================
const renderDrawdown = () => {
  const { facility, drawdowns } = simulatedState;
  const headroom = facility.totalLimit - facility.drawnAmount;
  document.getElementById('draw-headroom').textContent = usd(headroom);
  document.getElementById('draw-current').textContent  = usd(facility.drawnAmount);

  const list = document.getElementById('draw-event-list');
  if (drawdowns.length === 0) {
    list.innerHTML = '<p style="color:var(--clr-text-dim);font-size:0.85rem">No drawdown events yet.</p>';
    return;
  }
  list.innerHTML = drawdowns.map(d => `
    <div class="event-item">
      <div class="event-dot event-dot--cyan"></div>
      <div class="event-body">
        <p class="event-title">DrawdownExecution · ${d.drawdownId}</p>
        <p class="event-meta">Amount: ${usd(d.amount)} · Controller: ${d.controller} · Executed: ${d.executed} · ${fmtTime(d.timestamp)}</p>
      </div>
    </div>`).join('');
};

const setupDrawdownForm = () => {
  document.getElementById('drawdown-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if (activeParty !== 'borrower') {
      toast('Only the Borrower (BorrowerCorp) can request drawdowns', 'error'); return;
    }
    const id     = document.getElementById('d-id').value.trim();
    const amount = parseFloat(document.getElementById('d-amount').value);
    const headroom = simulatedState.facility.totalLimit - simulatedState.facility.drawnAmount;

    if (!id) { toast('Enter a drawdown reference ID', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
    if (amount > headroom) { toast(`Amount exceeds available headroom: ${usd(headroom)}`, 'error'); return; }

    simulatedState.facility.drawnAmount += amount;
    simulatedState.drawdowns.push({
      drawdownId: id, amount, executed: false,
      timestamp: new Date().toISOString(), controller: 'BorrowerCorp',
    });

    // Simulate pro-rata distribution
    const totalCommitment = simulatedState.tranches.reduce((s, t) => s + t.commitmentAmount, 0);
    simulatedState.tranches.forEach(t => {
      const share = (t.commitmentAmount / totalCommitment) * amount;
      t.drawnAmount += share;
    });

    addAuditEntry({
      type: 'DrawdownRequested', color: '#06b6d4',
      title: `Drawdown Requested · ${id}`,
      detail: `${usd(amount)} · BorrowerCorp → Pro-rata distributed`,
      timestamp: new Date().toISOString(),
    });

    toast(`✓ RequestDrawdown submitted: ${id} · ${usd(amount)}`, 'success');
    e.target.reset();
    renderAll();
  });
};

// =============================================================================
// SETTLEMENT PANEL
// =============================================================================
const renderSettlement = () => {
  const list = document.getElementById('receipt-items');
  if (simulatedState.receipts.length === 0) {
    list.innerHTML = '<p style="color:var(--clr-text-dim);font-size:0.85rem">No repayment receipts yet.</p>';
    return;
  }
  list.innerHTML = simulatedState.receipts.map(r => `
    <div class="receipt-item">
      <div class="event-dot event-dot--green"></div>
      <div class="event-body">
        <p class="event-title">RepaymentReceipt · ${r.lender}</p>
        <p class="event-meta">
          Principal: ${usd(r.principalPaid)} · Interest: ${usd(r.interestPaid)} · ${fmtTime(r.timestamp)}
        </p>
      </div>
    </div>`).join('');
};

const setupSettlementForm = () => {
  // Set default timestamp
  const tsInput = document.getElementById('s-ts');
  if (tsInput) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    tsInput.value = now.toISOString().slice(0, 16);
  }

  document.getElementById('settlement-form')?.addEventListener('submit', e => {
    e.preventDefault();
    if (activeParty !== 'agent') {
      toast('Only the Agent (GlobalLeadBank) can settle repayments', 'error'); return;
    }

    const lenderKey  = document.getElementById('s-lender').value;
    const principal  = parseFloat(document.getElementById('s-principal').value);
    const interest   = parseFloat(document.getElementById('s-interest').value);
    const ts         = document.getElementById('s-ts').value;

    if (!lenderKey) { toast('Select a lender tranche', 'error'); return; }
    if (isNaN(principal) || principal < 0) { toast('Enter a valid principal amount', 'error'); return; }
    if (isNaN(interest)  || interest < 0)  { toast('Enter a valid interest amount', 'error'); return; }

    const tranche = simulatedState.tranches.find(t => t.lenderKey === lenderKey);
    if (!tranche) { toast('Tranche not found', 'error'); return; }
    if (principal > tranche.drawnAmount) {
      toast(`Principal ${usd(principal)} exceeds drawn balance ${usd(tranche.drawnAmount)}`, 'error'); return;
    }

    tranche.drawnAmount     -= principal;
    simulatedState.facility.drawnAmount -= principal;

    const receipt = {
      lender: tranche.lender, lenderKey,
      principalPaid: principal, interestPaid: interest,
      timestamp: ts ? new Date(ts).toISOString() : new Date().toISOString(),
    };
    simulatedState.receipts.push(receipt);

    addAuditEntry({
      type: 'RepaymentSettled', color: '#10b981',
      title: `Repayment Settled · ${tranche.lender}`,
      detail: `Principal: ${usd(principal)} · Interest: ${usd(interest)}`,
      timestamp: receipt.timestamp,
    });

    toast(`✓ SettleRepayment executed: ${tranche.lender} principal ${usd(principal)}`, 'success');
    e.target.reset();
    tsInput.value = new Date().toISOString().slice(0, 16);
    renderAll();
  });
};

// =============================================================================
// AUDIT LOG
// =============================================================================
const addAuditEntry = (entry) => {
  simulatedState.auditLog.push(entry);
  renderAuditLog();
};

const renderAuditLog = () => {
  const container = document.getElementById('audit-timeline');
  const sorted = [...simulatedState.auditLog].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  container.innerHTML = sorted.map(entry => `
    <div class="audit-entry">
      <div class="audit-time">${fmtTime(entry.timestamp)}</div>
      <div class="audit-line">
        <div class="audit-line-dot" style="background:${entry.color}; border-color:${entry.color}33"></div>
        <div class="audit-line-bar"></div>
      </div>
      <div class="audit-content">
        <div class="audit-type" style="color:${entry.color}">${entry.type}</div>
        <div class="audit-detail">${entry.title} — ${entry.detail}</div>
      </div>
    </div>`).join('');
};

// =============================================================================
// MAIN RENDER
// =============================================================================
const renderAll = () => {
  renderOverview();
  renderTranches();
  renderDrawdown();
  renderSettlement();
  renderAuditLog();
};

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupPartySelector();
  setupTrancheForm();
  setupDrawdownForm();
  setupSettlementForm();
  renderAll();

  // Simulated ledger heartbeat — animates the status dot
  setTimeout(() => {
    toast('Canton Ledger connected · FAC-2026-USD-100M loaded', 'success');
  }, 800);

  // Auto-refresh simulation (every 30s in real deployment)
  setInterval(renderAll, 30_000);

  console.log('%cCantonSyndex Dashboard', 'color:#8b5cf6;font-size:18px;font-weight:700');
  console.log('%cCanton Network · DAML 2.9.4 · Privacy-Preserving Syndicated Lending', 'color:#06b6d4');
});
