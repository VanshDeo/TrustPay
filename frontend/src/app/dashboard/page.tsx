'use client';

/**
 * Dashboard Page — User's payment history with status, search, and pagination.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { getPayments } from '@/lib/api';
import { stroopsToXlm, truncateAddress } from '@/lib/stellar';
import Link from 'next/link';

interface Payment {
  _id: string;
  escrowId: string;
  senderAddress: string;
  beneficiaryAddress: string;
  amount: string;
  status: string;
  threshold: number;
  shareLink: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { publicKey, isConnected, connectWallet } = useWallet();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'released' | 'cancelled'>('all');

  useEffect(() => {
    async function load() {
      if (!publicKey) { setLoading(false); return; }
      try {
        const data = await getPayments(publicKey);
        if (data.success) setPayments(data.payments);
      } catch (error) {
        console.error('Error loading payments:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [publicKey]);

  const filtered = payments.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.escrowId.toLowerCase().includes(q) ||
        p.beneficiaryAddress.toLowerCase().includes(q) ||
        p.senderAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'released': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <Clock className="h-4 w-4 text-amber-400" />;
    }
  };

  const statusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      released: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          className="glass-card-static text-center max-w-md w-full !p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-white/40 mb-6">View your payment history by connecting your wallet.</p>
          <button onClick={connectWallet} className="btn-primary w-full">Connect Wallet</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-white/40 mt-1">Your escrow payments and transactions</p>
          </div>
          <Link href="/create" className="btn-primary text-sm">+ New Payment</Link>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by address or escrow ID..."
              className="input-field !pl-10 text-sm"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'pending', 'released', 'cancelled'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-white/40 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="text-center py-20 text-white/30">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="glass-card-static text-center !p-12">
            <p className="text-white/40 mb-4">No payments found</p>
            <Link href="/create" className="btn-primary text-sm">Create Your First Payment</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((payment, i) => {
              const isSender = payment.senderAddress === publicKey;
              return (
                <motion.div
                  key={payment._id}
                  className="glass-card-static !p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-xl p-2 ${isSender ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                      {isSender
                        ? <ArrowUpRight className="h-5 w-5 text-red-400" />
                        : <ArrowDownLeft className="h-5 w-5 text-emerald-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {isSender ? 'Sent to' : 'Received from'}{' '}
                        <span className="font-mono text-indigo-300">
                          {truncateAddress(isSender ? payment.beneficiaryAddress : payment.senderAddress)}
                        </span>
                      </p>
                      <p className="text-xs text-white/30">
                        {new Date(payment.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-lg font-semibold text-white">
                      {stroopsToXlm(payment.amount)} XLM
                    </p>
                    <div className={`flex items-center gap-1 rounded-full border px-3 py-1 ${statusBadge(payment.status)}`}>
                      {statusIcon(payment.status)}
                      <span className="text-xs font-medium capitalize">{payment.status}</span>
                    </div>
                    <Link
                      href={`/claim/${payment.shareLink}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-4 w-4 text-white/30 hover:text-white" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
