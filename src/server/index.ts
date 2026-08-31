/**
 * CantonSyndex REST API & Static Web Server
 *
 * Exposes RESTful endpoints for enterprise core banking integration and
 * serves the CantonSyndex frontend dashboard.
 *
 * Usage:
 *   npx ts-node src/server/index.ts
 *   or compiled: node dist/server/index.js
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { SyndexLedgerBridge } from '../bridge/SyndexLedgerBridge';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const AGENT_LEDGER_URL = process.env.AGENT_LEDGER_URL || 'http://localhost:10013';
const DEFAULT_AGENT_PARTY = process.env.AGENT_PARTY || 'GlobalLeadBank::1220agent';

// Initialize bridge instance
const bridge = new SyndexLedgerBridge(
  AGENT_LEDGER_URL,
  'local-dev-jwt-token',
  DEFAULT_AGENT_PARTY
);

// Helper to parse JSON body
function parseBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {} as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON responses
function sendJson(res: http.ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data, null, 2));
}

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// HTTP Request Handler
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    // =========================================================================
    // REST API ROUTES
    // =========================================================================

    // Health Check
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'UP',
        service: 'CantonSyndex REST Bridge',
        version: '0.1.0',
        activeParty: bridge.getActingParty(),
        ledgerUrl: AGENT_LEDGER_URL,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Facility Overview
    if (pathname === '/api/facility' && method === 'GET') {
      const facilityId = parsedUrl.searchParams.get('facilityId') || 'FAC-2026-USD-100M';
      const facility = await bridge.getMasterFacility(facilityId);
      sendJson(res, 200, { facilityId, facility });
      return;
    }

    // Tranches List
    if (pathname === '/api/tranches' && method === 'GET') {
      const facilityId = parsedUrl.searchParams.get('facilityId') || undefined;
      const tranches = await bridge.getTrancheParticipations(facilityId);
      sendJson(res, 200, { tranches });
      return;
    }

    // Request Drawdown
    if (pathname === '/api/drawdown' && method === 'POST') {
      const body = await parseBody<{
        facilityCid: string;
        borrowerParty: string;
        amount: number;
        drawdownId: string;
      }>(req);
      const result = await bridge.requestDrawdown(
        body.facilityCid,
        body.borrowerParty,
        body.amount,
        body.drawdownId
      );
      sendJson(res, 200, { success: true, result });
      return;
    }

    // Settle Repayment
    if (pathname === '/api/repay' && method === 'POST') {
      const body = await parseBody<{
        trancheCid: string;
        principalRepaid: number;
        interestPaid: number;
        timestamp: string;
      }>(req);
      const result = await bridge.settleRepayment(
        body.trancheCid,
        body.principalRepaid,
        body.interestPaid,
        body.timestamp
      );
      sendJson(res, 200, { success: true, result });
      return;
    }

    // Interest Accrual Endpoints
    if (pathname === '/api/interest/accrue' && method === 'POST') {
      const body = await parseBody<{ accrualCid: string; accrualDate: string }>(req);
      const result = await bridge.accrueInterest(body.accrualCid, body.accrualDate);
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === '/api/interest/collect' && method === 'POST') {
      const body = await parseBody<{ accrualCid: string; settlementDate: string }>(req);
      const result = await bridge.collectInterest(body.accrualCid, body.settlementDate);
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === '/api/interest/receipts' && method === 'GET') {
      const facilityId = parsedUrl.searchParams.get('facilityId') || undefined;
      const receipts = await bridge.getInterestReceipts(facilityId);
      sendJson(res, 200, { receipts });
      return;
    }

    // Covenant Tracking Endpoints
    if (pathname === '/api/covenants' && method === 'GET') {
      const facilityId = parsedUrl.searchParams.get('facilityId') || 'FAC-2026-USD-100M';
      const covenants = await bridge.getCovenantStatus(facilityId);
      sendJson(res, 200, { facilityId, covenants });
      return;
    }

    if (pathname === '/api/covenants/test' && method === 'POST') {
      const body = await parseBody<{
        covenantCid: string;
        testDate: string;
        newLeverage: number;
        newDSCR: number;
        newLTV: number;
        newLiquidity: number;
      }>(req);
      const result = await bridge.testCovenant(
        body.covenantCid,
        body.testDate,
        body.newLeverage,
        body.newDSCR,
        body.newLTV,
        body.newLiquidity
      );
      sendJson(res, 200, { success: true, result });
      return;
    }

    // Commitment Fee Endpoints
    if (pathname === '/api/fees/accrue' && method === 'POST') {
      const body = await parseBody<{ feeCid: string; accrualDate: string }>(req);
      const result = await bridge.accrueCommitmentFee(body.feeCid, body.accrualDate);
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === '/api/fees/collect' && method === 'POST') {
      const body = await parseBody<{ feeCid: string; settlementDate: string }>(req);
      const result = await bridge.collectCommitmentFee(body.feeCid, body.settlementDate);
      sendJson(res, 200, { success: true, result });
      return;
    }

    // Facility Amendment Endpoints
    if (pathname === '/api/amendments/vote' && method === 'POST') {
      const body = await parseBody<{ proposalCid: string; lenderParty: string }>(req);
      const result = await bridge.acceptAmendment(body.proposalCid, body.lenderParty);
      sendJson(res, 200, { success: true, result });
      return;
    }

    if (pathname === '/api/amendments/execute' && method === 'POST') {
      const body = await parseBody<{ proposalCid: string; executionDate: string }>(req);
      const result = await bridge.executeAmendment(body.proposalCid, body.executionDate);
      sendJson(res, 200, { success: true, result });
      return;
    }

    // =========================================================================
    // STATIC FILE SERVER (Frontend Dashboard)
    // =========================================================================

    const publicDir = path.join(__dirname, '../../frontend');
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(publicDir)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }

    // 404 Not Found
    sendJson(res, 404, { error: 'Endpoint or resource not found', path: pathname });
  } catch (err: any) {
    console.error(`[Server Error] ${method} ${pathname}:`, err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║               CantonSyndex REST Bridge Server                  ║
║      Privacy-Preserving Syndicated Loan Operations Engine      ║
╚════════════════════════════════════════════════════════════════╝

  ► Dashboard:   http://localhost:${PORT}/
  ► REST API:    http://localhost:${PORT}/api/health
  ► Ledger URL:  ${AGENT_LEDGER_URL}
  ► Party:       ${DEFAULT_AGENT_PARTY}
`);
  });
}

export { server, bridge };
