'use client';

/**
 * Create Payment Page — Form to create a new escrow payment.
 * Builds a Soroban transaction and prompts wallet signing.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, X, Copy, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { createPayment } from '@/lib/api';

export default function CreatePaymentPage() {
  const { publicKey, isConnected, connectWallet } = useWallet();
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [approvers, setApprovers] = useState<string[]>(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const addApprover = () => setApprovers([...approvers, '']);
  const removeApprover = (index: number) => {
    if (approvers.length <= 2) return;
    setApprovers(approvers.filter((_, i) => i !== index));
  };
  const updateApprover = (index: number, value: string) => {
    const updated = [...approvers];
    updated[index] = value;
    setApprovers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setIsSubmitting(true);
    try {
      const xlmAmount = (parseFloat(amount) * 10_000_000).toString();
      const validApprovers = approvers.filter((a) => a.trim().length > 0);

      const result = await createPayment({
        senderAddress: publicKey,
        beneficiaryAddress: beneficiary,
        tokenAddress: 'native',
        amount: xlmAmount,
        threshold,
        approvers: validApprovers,
      });

      if (result.success) {
        setShareLink(`${window.location.origin}/claim/${result.payment.shareLink}`);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          className="glass-card-static text-center max-w-md w-full !p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
            <PlusCircle className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-white/40 mb-6">Connect your Stellar wallet to create escrow payments.</p>
          <button onClick={connectWallet} className="btn-primary w-full">
            Connect Wallet
          </button>
        </motion.div>
      </div>
    );
  }

  if (shareLink) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          className="glass-card-static text-center max-w-lg w-full !p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Created! 🎉</h2>
          <p className="text-white/40 mb-6">Share this link with your approvers and beneficiary.</p>

          <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 mb-6">
            <input
              readOnly
              value={shareLink}
              className="flex-1 bg-transparent text-sm font-mono text-indigo-300 outline-none truncate"
            />
            <button onClick={copyLink} className="flex-shrink-0 rounded-lg bg-indigo-500/20 p-2 hover:bg-indigo-500/30 transition-colors">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-indigo-400" />}
            </button>
          </div>

          <button
            onClick={() => { setShareLink(null); setBeneficiary(''); setAmount(''); }}
            className="btn-secondary w-full"
          >
            Create Another Payment
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white mb-2">Create Payment</h1>
        <p className="text-white/40 mb-8">Set up a conditional escrow payment with multi-sig approval.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Beneficiary */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Beneficiary Address</label>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="G... (Stellar public key)"
              className="input-field font-mono text-sm"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Amount (XLM)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              step="0.01"
              min="0.01"
              className="input-field"
              required
            />
          </div>

          {/* Approvers */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Approver Addresses
            </label>
            <div className="space-y-3">
              {approvers.map((addr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={addr}
                    onChange={(e) => updateApprover(i, e.target.value)}
                    placeholder={`Approver ${i + 1} (G...)`}
                    className="input-field font-mono text-sm"
                  />
                  {approvers.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeApprover(i)}
                      className="flex-shrink-0 rounded-xl p-3 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addApprover}
              className="mt-3 flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <PlusCircle className="h-4 w-4" /> Add Approver
            </button>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              Approval Threshold ({threshold} of {approvers.filter(a => a.trim()).length || approvers.length})
            </label>
            <input
              type="range"
              min="1"
              max={approvers.length}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-white/30 mt-1">
              <span>1</span>
              <span>{approvers.length}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || !beneficiary || !amount}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Creating...</>
            ) : (
              <>Create Escrow Payment <ArrowRight className="h-5 w-5" /></>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
