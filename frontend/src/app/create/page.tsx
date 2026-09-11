'use client';

/**
 * Create Payment Page — Form to create a new escrow payment.
 * Builds a Soroban transaction (or sends walletless request) and prompts wallet signing.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, X, Copy, Check, ArrowRight, Loader2, Wallet, Users, AlertTriangle } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { createPayment } from '@/lib/api';

export default function CreatePaymentPage() {
  const { publicKey, isConnected, connectWallet } = useWallet();
  const [walletlessSender, setWalletlessSender] = useState(false);
  const [walletlessRecipient, setWalletlessRecipient] = useState(false);
  
  const [beneficiary, setBeneficiary] = useState('');
  const [claimPin, setClaimPin] = useState('');
  
  const [milestones, setMilestones] = useState<string[]>(['']);
  
  const [threshold, setThreshold] = useState(1);
  const [approvers, setApprovers] = useState<string[]>(['']);
  const [arbitrator, setArbitrator] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [temporarySecretInfo, setTemporarySecretInfo] = useState<string | null>(null);

  const addApprover = () => setApprovers([...approvers, '']);
  const removeApprover = (index: number) => {
    if (approvers.length <= 1) return;
    setApprovers(approvers.filter((_, i) => i !== index));
    if (threshold > approvers.length - 1) {
        setThreshold(approvers.length - 1);
    }
  };
  const updateApprover = (index: number, value: string) => {
    const updated = [...approvers];
    updated[index] = value;
    setApprovers(updated);
  };

  const addMilestone = () => setMilestones([...milestones, '']);
  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };
  const updateMilestone = (index: number, value: string) => {
    const updated = [...milestones];
    updated[index] = value;
    setMilestones(updated);
  };

  const totalAmount = milestones.reduce((acc, m) => acc + (parseFloat(m) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletlessSender && !publicKey) {
      alert("Please connect your wallet first.");
      return;
    }
    
    if (walletlessRecipient && claimPin.length < 4) {
      alert("Claim PIN must be at least 4 characters");
      return;
    }

    if (totalAmount <= 0) {
      alert("Total amount must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const xlmTotalAmount = (totalAmount * 10_000_000).toString();
      const xlmMilestones = milestones
        .map(m => parseFloat(m) || 0)
        .filter(m => m > 0)
        .map(m => (m * 10_000_000).toString());

      const validApprovers = approvers.filter((a) => a.trim().length > 0);
      const validArbitrator = arbitrator.trim().length > 0 ? arbitrator.trim() : undefined;

      const result = await createPayment({
        senderAddress: walletlessSender ? undefined : (publicKey || undefined),
        beneficiaryAddress: walletlessRecipient ? undefined : beneficiary,
        tokenAddress: 'native',
        amount: xlmTotalAmount,
        milestones: xlmMilestones,
        threshold,
        approvers: validApprovers,
        arbitrator: validArbitrator,
        walletless: walletlessRecipient,
        walletlessSender,
        claimPin: walletlessRecipient ? claimPin : undefined,
      });

      if (result.success) {
        let finalLink = `${window.location.origin}/claim/${result.payment.shareLink}`;
        
        let tempSecrets = [];
        if (result.temporarySecret) {
            tempSecrets.push(`Recipient Secret: ${result.temporarySecret}`);
        }
        if (result.temporarySenderSecret) {
            tempSecrets.push(`Sender Secret: ${result.temporarySenderSecret}`);
        }
        
        if (tempSecrets.length > 0) {
            setTemporarySecretInfo(tempSecrets.join('\n'));
        }
        setShareLink(finalLink);
      } else {
        alert("Failed: " + result.error);
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      alert("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (shareLink) {
      try {
        if (navigator.share) {
          await navigator.share({
            title: 'TrustPay Escrow Payment',
            text: 'You received a protected payment on TrustPay.',
            url: shareLink,
          });
        } else {
          await navigator.clipboard.writeText(shareLink);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        // Fallback or user cancelled share
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

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
          
          {(walletlessRecipient || walletlessSender) && (
            <div className="mb-6 rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <p className="text-sm text-orange-200 font-semibold">Important Secrets</p>
              </div>
              <p className="text-xs text-orange-200/80 mb-2">
                Save the following secrets securely. If you lose them, funds may be permanently locked.
              </p>
              <pre className="text-xs bg-black/40 p-3 rounded-lg text-orange-300 font-mono whitespace-pre-wrap break-all">
                {temporarySecretInfo}
              </pre>
            </div>
          )}

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
            onClick={() => { 
                setShareLink(null); 
                setBeneficiary(''); 
                setMilestones(['']); 
                setWalletlessRecipient(false); 
                setWalletlessSender(false);
                setClaimPin(''); 
                setTemporarySecretInfo(null);
            }}
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
        <p className="text-white/40 mb-8">Set up a conditional escrow payment with milestones & multi-sig approval.</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Sender Settings */}
          <div className="glass-card-static !p-6 space-y-4 border border-white/10">
            <h3 className="text-lg font-semibold text-white">1. Sender Identity</h3>
            <div className="bg-white/5 rounded-xl p-1 flex">
              <button
                type="button"
                onClick={() => setWalletlessSender(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${!walletlessSender ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}
              >
                <Wallet className="h-4 w-4" /> Use Freighter Wallet
              </button>
              <button
                type="button"
                onClick={() => setWalletlessSender(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${walletlessSender ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}
              >
                <Users className="h-4 w-4" /> No Wallet (Generate Temporary)
              </button>
            </div>
            {!walletlessSender && !isConnected && (
              <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-center">
                <p className="text-sm text-indigo-200 mb-3">You need to connect your wallet to proceed as a wallet sender.</p>
                <button type="button" onClick={connectWallet} className="btn-primary py-2 px-4 text-sm">
                  Connect Freighter
                </button>
              </div>
            )}
            {!walletlessSender && isConnected && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
                    <Check className="h-4 w-4" /> Connected as: <span className="font-mono">{publicKey?.substring(0, 8)}...</span>
                </div>
            )}
          </div>

          {/* Recipient Settings */}
          <div className="glass-card-static !p-6 space-y-4 border border-white/10">
            <h3 className="text-lg font-semibold text-white">2. Recipient</h3>
            <div className="bg-white/5 rounded-xl p-1 flex">
              <button
                type="button"
                onClick={() => setWalletlessRecipient(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${!walletlessRecipient ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}
              >
                <Wallet className="h-4 w-4" /> Has Wallet
              </button>
              <button
                type="button"
                onClick={() => setWalletlessRecipient(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${walletlessRecipient ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}
              >
                <Users className="h-4 w-4" /> No Wallet
              </button>
            </div>
            
            {walletlessRecipient ? (
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Claim PIN (Share this with recipient separately)</label>
                <input
                  type="text"
                  value={claimPin}
                  onChange={(e) => setClaimPin(e.target.value)}
                  placeholder="e.g. 1234 or a secret word"
                  className="input-field"
                  required={walletlessRecipient}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">Beneficiary Address</label>
                <input
                  type="text"
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="G... (Stellar public key)"
                  className="input-field font-mono text-sm"
                  required={!walletlessRecipient}
                />
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="glass-card-static !p-6 space-y-4 border border-white/10">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-white">3. Milestones</h3>
                <span className="text-sm text-indigo-400 font-medium">Total: {totalAmount} XLM</span>
            </div>
            
            <div className="space-y-3">
              {milestones.map((amt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs text-white/50 border border-white/10">
                    {i+1}
                  </div>
                  <input
                    type="number"
                    value={amt}
                    onChange={(e) => updateMilestone(i, e.target.value)}
                    placeholder={`Milestone ${i + 1} Amount (XLM)`}
                    className="input-field"
                    step="0.01"
                    min="0.01"
                    required
                  />
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
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
              onClick={addMilestone}
              className="mt-3 flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <PlusCircle className="h-4 w-4" /> Add Milestone
            </button>
          </div>

          {/* Approvers & Arbitrator */}
          <div className="glass-card-static !p-6 space-y-4 border border-white/10">
            <h3 className="text-lg font-semibold text-white">4. Approval Rules</h3>
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
                      required
                    />
                    {approvers.length > 1 && (
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
                className="mt-3 flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors mb-6"
              >
                <PlusCircle className="h-4 w-4" /> Add Approver
              </button>
            </div>

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
            
            <div className="pt-4 border-t border-white/10 mt-4">
              <label className="block text-sm font-medium text-white/60 mb-2">
                Arbitrator Address (Optional)
              </label>
              <p className="text-xs text-white/40 mb-3">An arbitrator can override the threshold to resolve disputes.</p>
              <input
                type="text"
                value={arbitrator}
                onChange={(e) => setArbitrator(e.target.value)}
                placeholder="G... (Arbitrator public key)"
                className="input-field font-mono text-sm"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={
                isSubmitting || 
                (!walletlessSender && !isConnected) ||
                (!walletlessRecipient && !beneficiary) || 
                (walletlessRecipient && !claimPin) || 
                totalAmount <= 0
            }
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-4 text-lg"
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
