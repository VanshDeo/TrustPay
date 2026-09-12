'use client';

/**
 * Dashboard Page — Action-oriented Deal Management per Design.md
 *
 * Grouped into "Action needed from you" vs "Waiting on counterparty".
 * Prominent plain-language deadlines & fallback triggers on every card.
 * Full page chrome preserved even when disconnected (no full-page block wall).
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Shield,
  Search,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Users,
  Wallet,
  Sparkles,
  PlusCircle,
  Share2,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { getPayments } from '@/lib/api';
import { stroopsToXlm, truncateAddress } from '@/lib/stellar';

interface Payment {
  _id: string;
  escrowId: string;
  senderAddress: string;
  beneficiaryAddress: string;
  amount: string;
  status: 'pending' | 'released' | 'cancelled' | 'timed_out' | 'frozen';
  threshold: number;
  approvers: string[];
  arbitrator?: string;
  shareLink: string;
  deadline?: number;
  fallback?: 'refund_sender' | 'release_beneficiary';
  milestones?: { amount: string; status: string }[];
  walletless?: boolean;
  createdAt: string;
}

type TabFilter = 'waiting_on_you' | 'waiting_on_them' | 'all';

export default function DashboardPage() {
  const { publicKey, isConnected, connectWallet } = useWallet();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabFilter>('waiting_on_you');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('');

  const targetAddress = publicKey || manualAddress;

  const loadPayments = async () => {
    if (!targetAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getPayments(targetAddress);
      if (data.success && data.payments) {
        setPayments(data.payments);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [targetAddress]);

  const copyLink = (shareLink: string, id: string) => {
    const fullUrl = `${window.location.origin}/claim/${shareLink}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Deal Categorization (Design.md) ──────────────────────────────────────────
  const categorizeDeal = (p: Payment) => {
    if (p.status !== 'pending' && p.status !== 'frozen') {
      return 'completed';
    }

    const isBeneficiary = targetAddress && p.beneficiaryAddress.toLowerCase() === targetAddress.toLowerCase();
    const isApprover = targetAddress && p.approvers?.some((a) => a.toLowerCase() === targetAddress.toLowerCase());

    // If user is an approver or beneficiary on a pending deal
    if (isApprover || (isBeneficiary && p.walletless)) {
      return 'waiting_on_you';
    }
    return 'waiting_on_them';
  };

  const actionNeededDeals = payments.filter((p) => categorizeDeal(p) === 'waiting_on_you');
  const waitingOnThemDeals = payments.filter((p) => categorizeDeal(p) === 'waiting_on_them');

  const filteredDeals = payments.filter((p) => {
    // Search query
    if (search) {
      const q = search.toLowerCase();
      const matchSearch =
        p.escrowId.toLowerCase().includes(q) ||
        p.senderAddress.toLowerCase().includes(q) ||
        p.beneficiaryAddress.toLowerCase().includes(q);
      if (!matchSearch) return false;
    }

    if (activeTab === 'waiting_on_you') return categorizeDeal(p) === 'waiting_on_you';
    if (activeTab === 'waiting_on_them') return categorizeDeal(p) === 'waiting_on_them';
    return true; // 'all' tab
  });

  // Plain-Language Status & Trust Deadline
  const renderDealPlainStatus = (p: Payment) => {
    if (p.status === 'released') {
      return {
        label: 'Funds Released Successfully',
        subtext: 'All conditions were verified.',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      };
    }
    if (p.status === 'cancelled') {
      return {
        label: 'Deal Cancelled / Refunded',
        subtext: 'Funds were returned to sender.',
        badgeClass: 'bg-red-500/10 text-red-300 border-red-500/20',
      };
    }
    if (p.status === 'frozen') {
      return {
        label: 'Guardian Safety Hold (Frozen)',
        subtext: 'Funds locked pending guardian review.',
        badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      };
    }

    // Pending: Format deadline logic
    let deadlineText = 'No expiration deadline';
    if (p.deadline && p.deadline > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const diffSec = p.deadline - nowSec;
      if (diffSec <= 0) {
        deadlineText = `Deadline passed · Triggering ${p.fallback === 'release_beneficiary' ? 'auto-release' : 'auto-refund'}`;
      } else {
        const days = Math.floor(diffSec / 86400);
        const hours = Math.floor((diffSec % 86400) / 3600);
        const timeRemaining = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        const fallbackAction = p.fallback === 'release_beneficiary' ? 'auto-releases to recipient' : 'auto-refunds to sender';
        deadlineText = `Auto-${fallbackAction} in ${timeRemaining} if unanswered`;
      }
    }

    const isAction = categorizeDeal(p) === 'waiting_on_you';
    return {
      label: isAction ? 'Waiting for your approval' : `Waiting for approval (${p.threshold} required)`,
      subtext: deadlineText,
      badgeClass: isAction
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8 space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Deals Dashboard</h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Track active conditional payments, required approvals, and auto-refund deadlines.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {targetAddress && (
            <button
              onClick={loadPayments}
              className="btn-secondary !py-2.5 !px-3 text-xs flex items-center gap-1.5"
              title="Refresh Deals"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href="/create"
            className="btn-primary w-full sm:w-auto !py-2.5 !px-5 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Create protected payment
          </Link>
        </div>
      </div>

      {/* ─── Connect Wallet Banner (Chrome preserved per Design.md) ─────── */}
      {!isConnected && !manualAddress && (
        <div className="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Connect wallet or inspect an address</h3>
              <p className="text-xs text-white/60 mt-0.5 max-w-xl">
                Connect your Freighter or passkey wallet to see payments waiting on you. Or enter your Stellar address below to inspect deals.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={connectWallet}
              className="btn-primary !py-2 !px-4 text-xs w-full sm:w-auto"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      )}

      {/* ─── Tabs & Search Bar ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Action-Oriented Tabs */}
        <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('waiting_on_you')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'waiting_on_you'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Action Needed</span>
            {actionNeededDeals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-bold">
                {actionNeededDeals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('waiting_on_them')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'waiting_on_them'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <span>Waiting on Counterparty</span>
            {waitingOnThemDeals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-mono">
                {waitingOnThemDeals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-white/60 hover:text-white'
            }`}
          >
            All Deals & History ({payments.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search address or deal ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── Deals List / Cards ──────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-white/40 flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
          <span className="text-xs">Checking on-chain deals and approval policies…</span>
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="py-14 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] space-y-3">
          <Shield className="h-10 w-10 text-white/20 mx-auto" />
          <h3 className="text-base font-semibold text-white">
            {activeTab === 'waiting_on_you'
              ? 'No Actions Required Right Now'
              : activeTab === 'waiting_on_them'
              ? 'No Pending Counterparty Approvals'
              : 'No Payment Deals Found'}
          </h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            {activeTab === 'waiting_on_you'
              ? 'You have no deals awaiting your signature or milestone approval.'
              : 'Create a conditional deal to protect your next transfer or freelance contract.'}
          </p>
          <div className="pt-2">
            <Link href="/create" className="btn-primary !py-2 !px-5 text-xs inline-flex items-center gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              Create a protected payment
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDeals.map((p) => {
            const plainStatus = renderDealPlainStatus(p);
            const amountFormatted = stroopsToXlm(p.amount);
            const isActionNeeded = categorizeDeal(p) === 'waiting_on_you';

            return (
              <div
                key={p._id || p.escrowId}
                className={`p-5 rounded-2xl border transition-all space-y-4 bg-white/[0.02] ${
                  isActionNeeded
                    ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Top Strip: Status & Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${plainStatus.badgeClass}`}>
                      {plainStatus.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-white/50 mt-2 font-mono">
                      <Clock className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span>{plainStatus.subtext}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold text-white font-mono block">
                      {amountFormatted} XLM
                    </span>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                      Protected Escrow
                    </span>
                  </div>
                </div>

                {/* Counterparties */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/20 border border-white/5 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-white/40 uppercase block mb-0.5">Sender</span>
                    <span className="text-white/80">{truncateAddress(p.senderAddress)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/40 uppercase block mb-0.5">Recipient</span>
                    <span className="text-white/80">{truncateAddress(p.beneficiaryAddress)}</span>
                  </div>
                </div>

                {/* Milestone Progress (if configured) */}
                {p.milestones && p.milestones.length > 1 && (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-white/60">
                      <span>Milestones:</span>
                      <span className="font-mono">
                        {p.milestones.filter((m) => m.status === 'released').length} of {p.milestones.length} released
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {p.milestones.map((m, idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 flex-1 rounded-full ${
                            m.status === 'released' ? 'bg-emerald-400' : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions Bottom Bar (Mobile Friendly 375px) */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                  <button
                    onClick={() => copyLink(p.shareLink || p.escrowId, p.escrowId)}
                    className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5"
                    title="Copy Claim Link"
                  >
                    {copiedId === p.escrowId ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3 w-3 text-white/60" />
                        <span>Share Link</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={`/claim/${p.shareLink || p.escrowId}`}
                    className="btn-primary !py-1.5 !px-4 text-xs font-medium flex items-center gap-1"
                  >
                    <span>View Deal</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
