/**
 * Backend API client for the frontend.
 * All calls go through the Express backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function createPayment(data: {
  senderAddress: string;
  beneficiaryAddress: string;
  tokenAddress: string;
  amount: string;
  threshold: number;
  approvers: string[];
  escrowId?: string;
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
