'use client';

/**
 * Claim Page — Shareable payment link destination.
 * Shows escrow details, approval progress, and approve/release buttons.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Clock, CheckCircle2, XCircle, Loader2, Users } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { getPaymentByLink } from '@/lib/api';
import { stroopsToXlm, truncateAddress } from '@/lib/stellar';

interface PaymentData {
  escrowId: string;
  senderAddress: string;
  beneficiaryAddress: string;
  amount: string;
  status: string;
  threshold: number;
  approvers: string[];
  shareLink: string;
}

interface ApprovalData {
  approverAddress: string;
  approvedAt: string;
  txHash?: string;
}

export default function ClaimPage() {
  const params = useParams();
  const id = params.id as string;
  const { publicKey, isConnected, connectWallet } = useWallet();
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [approvals, setApprovals] = useState<ApprovalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getPaymentByLink(id);
        if (data.success) {
          setPayment(data.payment);
          setApprovals(data.approvals || []);
        }
      } catch (error) {
        console.error('Error loading payment:', error);
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const handleApprove = async () => {
    if (!publicKey || !payment) return;
    setApproving(true);
    try {
      // In production, this would build and sign a Soroban TX
      // For now, we record the approval via the backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAddress: payment.senderAddress,
          beneficiaryAddress: payment.beneficiaryAddress,
          tokenAddress: 'native',
          amount: payment.amount,
          threshold: payment.threshold,
          approvers: payment.approvers,
          escrowId: payment.escrowId,
        }),
      });
      // Refresh data
      const data = await getPaymentByLink(id);
      if (data.success) {
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-card-static text-center max-w-md !p-8">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h2 className="text-xl font-bold text-white mb-2">Payment Not Found</h2>
          <p className="text-white/40">This payment link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const approvalCount = approvals.length;
  const thresholdMet = approvalCount >= payment.threshold;
  const progressPercent = Math.min((approvalCount / payment.threshold) * 100, 100);

  const statusConfig = {
    pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock, label: 'Pending' },
    released: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, label: 'Released' },
    cancelled: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle, label: 'Cancelled' },
  };
  const status = statusConfig[payment.status as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Payment Details</h1>
          <div className={`flex items-center gap-2 rounded-full ${status.bg} ${status.border} border px-3 py-1`}>
            <status.icon className={`h-4 w-4 ${status.color}`} />
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {/* Payment Card */}
        <div className="glass-card-static !p-6 mb-6 space-y-4">
          <div className="text-center mb-6">
            <p className="text-white/40 text-sm mb-1">Amount</p>
            <p className="text-4xl font-bold gradient-text">{stroopsToXlm(payment.amount)} XLM</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 mb-1">From</p>
              <p className="font-mono text-indigo-300">{truncateAddress(payment.senderAddress)}</p>
            </div>
            <div>
              <p className="text-white/40 mb-1">To</p>
              <p className="font-mono text-indigo-300">{truncateAddress(payment.beneficiaryAddress)}</p>
            </div>
          </div>
        </div>

        {/* Approval Progress */}
        <div className="glass-card-static !p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-white">Approval Progress</h3>
            </div>
            <span className="text-sm text-white/40">
              {approvalCount} / {payment.threshold} required
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full bg-white/5 overflow-hidden mb-4">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {/* Approver list */}
          {payment.approvers.length > 0 && (
            <div className="space-y-2">
              {payment.approvers.map((addr, i) => {
                const hasApproved = approvals.some((a) => a.approverAddress === addr);
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/3 px-4 py-2">
                    <span className="text-sm font-mono text-white/60">{truncateAddress(addr)}</span>
                    {hasApproved ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {payment.status === 'pending' && (
          <div className="space-y-3">
            {!isConnected ? (
              <button onClick={connectWallet} className="btn-primary w-full">
                Connect Wallet to Approve
              </button>
            ) : thresholdMet ? (
              <button className="btn-primary w-full flex items-center justify-center gap-2 !from-emerald-500 !to-teal-500"
                style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                <CheckCircle2 className="h-5 w-5" /> Release Funds
              </button>
            ) : (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {approving ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Approving...</>
                ) : (
                  <><Shield className="h-5 w-5" /> Approve Payment</>
                )}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
