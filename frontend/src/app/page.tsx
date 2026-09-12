'use client';

/**
 * Landing Page — Decluttered, Invisible Blockchain UX per Design.md
 *
 * One headline, primary CTA ('Create a protected payment'),
 * secondary CTA ('I received a link' with quick claim lookup),
 * 3 real differentiators, and 3 key stats.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

const differentiators = [
  {
    icon: LinkIcon,
    title: 'Walletless Claiming',
    description: 'Send protected money to anyone via a link. Recipients claim straight to bank or passkey without seed phrases.',
  },
  {
    icon: Zap,
    title: 'Zero Fees, Fully Sponsored',
    description: 'All network costs are sponsored automatically. You never see gas fees or cryptic network prompts.',
  },
  {
    icon: ShieldCheck,
    title: 'Self-Enforcing Conditions',
    description: 'Milestones, multi-party approvals, and automated timeout refunds execute strictly as programmed.',
  },
];

const keyStats = [
  { label: 'Network Finality', value: '~5 sec' },
  { label: 'Sender/Recipient Gas Fees', value: '$0.00' },
  { label: 'Smart Rule Guarantee', value: '100%' },
];

export default function LandingPage() {
  const router = useRouter();
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimInput, setClaimInput] = useState('');
  const [claimError, setClaimError] = useState('');

  const handleClaimLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = claimInput.trim();
    if (!trimmed) return;

    // Extract ID if a full URL was pasted
    let resolvedId = trimmed;
    try {
      if (trimmed.includes('/claim/')) {
        const parts = trimmed.split('/claim/');
        resolvedId = parts[1].split(/[?#]/)[0];
      }
    } catch {
      // Use as-is
    }

    if (!resolvedId) {
      setClaimError('Please enter a valid claim link or ID');
      return;
    }

    router.push(`/claim/${resolvedId}`);
  };

  return (
    <div className="relative min-h-[90vh] flex flex-col justify-between">
      {/* ─── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center w-full">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

        {/* Live Status Pill */}
        <motion.div
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-md"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-white/80">Protected Payments on Stellar</span>
        </motion.div>

        {/* One Strong Headline */}
        <motion.h1
          className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl mb-6 max-w-4xl mx-auto leading-[1.1]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Money moves only when{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">
            conditions are met.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mb-10 max-w-2xl text-base sm:text-lg text-white/60 leading-relaxed"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Set up milestone payments, auto-refund deadlines, or autonomous agent spending limits. No crypto jargon, no seed phrases, and zero gas fees.
        </motion.p>

        {/* Action CTAs (Primary & Secondary per Design.md) */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3.5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {/* Primary CTA */}
          <Link
            href="/create"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 group"
          >
            Create a protected payment
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Secondary CTA */}
          <button
            onClick={() => {
              setClaimError('');
              setClaimModalOpen(true);
            }}
            className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 font-medium text-sm border border-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <LinkIcon className="h-4 w-4 text-indigo-400" />
            I received a link
          </button>
        </motion.div>

        {/* Clean 3-Metric Strip */}
        <motion.div
          className="mt-16 pt-8 border-t border-white/5 grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {keyStats.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-white font-mono">{stat.value}</p>
              <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ─── 3 Core Differentiators (Cut the feature wall) ────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {differentiators.map((diff, i) => {
            const Icon = diff.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-indigo-500/30 transition-all space-y-3"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">{diff.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{diff.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── "I received a link" Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {claimModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Claim Protected Payment</h3>
                </div>
                <button
                  onClick={() => setClaimModalOpen(false)}
                  className="text-white/40 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-white/60">
                Paste the payment link or escrow ID you received to claim your funds. No crypto wallet is required to view your deal.
              </p>

              <form onSubmit={handleClaimLookup} className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="e.g. escrow_123 or https://.../claim/..."
                    value={claimInput}
                    onChange={(e) => {
                      setClaimInput(e.target.value);
                      setClaimError('');
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                  />
                  {claimError && <p className="text-[11px] text-red-400 mt-1">{claimError}</p>}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setClaimModalOpen(false)}
                    className="btn-secondary !py-2 !px-4 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary !py-2 !px-5 text-xs flex items-center gap-1.5"
                  >
                    Open Payment
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
