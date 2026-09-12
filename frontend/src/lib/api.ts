/**
 * Backend API client for the frontend.
 * All calls go through the Express backend.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

async function fetchApi(path: string, options?: RequestInit) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${API_URL}${cleanPath}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function createPayment(data: {
  senderAddress?: string; // Optional if walletlessSender
  beneficiaryAddress?: string; // Optional for walletless (recipient)
  tokenAddress: string;
  amount: string; // total amount
  milestones?: string[]; // array of XLM string amounts
  threshold: number;
  approvers: string[];
  arbitrator?: string;
  escrowId?: string;
  walletless?: boolean; // walletless recipient
  walletlessSender?: boolean; // walletless sender
  claimPin?: string;
}) {
  return fetchApi('/api/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPayments(wallet?: string) {
  const query = wallet ? `?wallet=${wallet}` : '';
  return fetchApi(`/api/payments${query}`);
}

export async function getPaymentById(id: string) {
  return fetchApi(`/api/payments/${id}`);
}

export async function getPaymentByLink(shareLink: string) {
  return fetchApi(`/api/payments/link/${shareLink}`);
}

export async function claimWalletlessPayment(shareLink: string, data: {
  recipientAddress: string;
  temporarySecret: string;
  claimPin: string;
}) {
  return fetchApi(`/api/payments/link/${shareLink}/claim`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export async function getEscrowState(escrowId: string) {
  return fetchApi(`/api/contracts/escrow/${escrowId}`);
}

export async function getApprovalState(escrowId: string) {
  return fetchApi(`/api/contracts/approval/${escrowId}`);
}

export async function buildApprovalTx(walletAddress: string, escrowId: string) {
  return fetchApi('/api/contracts/approve', {
    method: 'POST',
    body: JSON.stringify({ walletAddress, escrowId }),
  });
}

// ─── Sponsor ──────────────────────────────────────────────────────────────────

export async function submitSponsoredTx(signedTxXdr: string) {
  return fetchApi('/api/sponsor', {
    method: 'POST',
    body: JSON.stringify({ signedTxXdr }),
  });
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export async function getMetrics() {
  return fetchApi('/api/metrics');
}

// ─── AI Deal Builder ──────────────────────────────────────────────────────────

export async function parseDealWithAI(prompt: string) {
  return fetchApi('/api/ai/parse-deal', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

// ─── Agentic Payment Gateway (x402) ──────────────────────────────────────────

export async function getGatewayResources() {
  return fetchApi('/api/gateway/resources');
}

export async function requestGatewayResource(resourceId: string, options?: { escrowId?: string; agentAddress?: string }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options?.escrowId) {
    headers['X-Escrow-Id'] = options.escrowId;
  }
  if (options?.agentAddress) {
    headers['X-Agent-Address'] = options.agentAddress;
  }

  const res = await fetch(`${API_URL}/api/gateway/resource/${resourceId}`, {
    method: 'GET',
    headers,
  });

  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

export async function payGatewayResource(data: {
  resourceId: string;
  agentAddress: string;
  amount?: string;
  escrowId?: string;
}) {
  return fetchApi('/api/gateway/pay', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAgentMandates(ownerAddress?: string) {
  const query = ownerAddress ? `?ownerAddress=${encodeURIComponent(ownerAddress)}` : '';
  return fetchApi(`/api/gateway/mandates${query}`);
}

export async function saveAgentMandate(data: {
  agentAddress: string;
  ownerAddress: string;
  label: string;
  perTxLimit: string;
  perPeriodLimit: string;
  periodDuration?: number;
  tokenAddress?: string;
}) {
  return fetchApi('/api/gateway/mandates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getGatewayLogs(params?: { agentAddress?: string; status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.agentAddress) q.append('agentAddress', params.agentAddress);
  if (params?.status) q.append('status', params.status);
  if (params?.limit) q.append('limit', params.limit.toString());
  const query = q.toString() ? `?${q.toString()}` : '';
  return fetchApi(`/api/gateway/logs${query}`);
}

export async function getApiKeys(ownerAddress?: string) {
  const query = ownerAddress ? `?ownerAddress=${encodeURIComponent(ownerAddress)}` : '';
  return fetchApi(`/api/gateway/keys${query}`);
}

export async function generateApiKey(data: { name: string; ownerAddress: string }) {
  return fetchApi('/api/gateway/keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function revokeApiKey(keyId: string) {
  return fetchApi(`/api/gateway/keys/${keyId}`, {
    method: 'DELETE',
  });
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function recordPageView(path: string, referrer?: string) {
  try {
    return fetchApi('/api/metrics/pageview', {
      method: 'POST',
      body: JSON.stringify({ path, referrer }),
    });
  } catch (e) {
    // Non-blocking telemetry
  }
}
