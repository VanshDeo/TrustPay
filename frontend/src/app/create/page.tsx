'use client';

/**
 * Create Protected Payment Page — Refactored to 3-step progressive question flow
 * per Design.md & Phase 4 specs:
 * 1. What's this for? (AI Deal Builder or manual entry)
 * 2. Who's it with? (Walletless-first recipient + progressive disclosure for milestones/deadline)
 * 3. Review via Explain Before You Sign (Plain-English confirmation before signing)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Share2,
  PlusCircle,
  X,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Wallet,
  UserCheck,
  Link as LinkIcon,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { createPayment, parseDealWithAI } from '@/lib/api';
import { explainTransaction } from '@/lib/explainer';
import ExplainBeforeYouSign from '@/components/ExplainBeforeYouSign';

export default function CreatePaymentPage() {
  const { publicKey, isConnected, connectWallet } = useWallet();

  // Step state (1: What, 2: Who & Rules, 3: Review & Sign)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1 State: Deal Description & AI Builder
  const [dealPrompt, setDealPrompt] = useState('');
  const [isParsingAI, setIsParsingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessSummary, setAiSuccessSummary] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [totalAmount, setTotalAmount] = useState('100');

  // Step 2 State: Parties & Rules
  const [walletlessSender, setWalletlessSender] = useState(false);
  const [walletlessRecipient, setWalletlessRecipient] = useState(true);
  const [beneficiary, setBeneficiary] = useState('');
  const [claimPin, setClaimPin] = useState('1234');

  // Progressive disclosure accordions
  const [showMilestones, setShowMilestones] = useState(false);
  const [milestones, setMilestones] = useState<string[]>(['100']);

  const [showDeadline, setShowDeadline] = useState(false);
  const [deadlineDays, setDeadlineDays] = useState<number>(0);
  const [fallback, setFallback] = useState<'refund' | 'release'>('refund');

  const [showAdvancedRules, setShowAdvancedRules] = useState(false);
  const [approvers, setApprovers] = useState<string[]>(['']);
  const [threshold, setThreshold] = useState(1);
  const [arbitrator, setArbitrator] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [temporarySecretInfo, setTemporarySecretInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ─── AI Parser Action ──────────────────────────────────────────────────────────
  const handleParseWithAI = async () => {
    if (!dealPrompt.trim()) return;

    setIsParsingAI(true);
    setAiError(null);
    setAiSuccessSummary(null);

    try {
      const response = await parseDealWithAI(dealPrompt);
      if (response && response.success && response.deal) {
        const deal = response.deal;
        if (deal.title) setTitle(deal.title);
        if (deal.amount) {
          setTotalAmount(deal.amount);
        }
        if (deal.milestones && deal.milestones.length > 1) {
          setMilestones(deal.milestones);
          setShowMilestones(true);
        } else if (deal.amount) {
          setMilestones([deal.amount]);
        }

        if (deal.beneficiary) {
          setBeneficiary(deal.beneficiary);
          setWalletlessRecipient(false);
        } else {
          setWalletlessRecipient(deal.walletlessRecipient ?? true);
        }

        if (deal.deadlineDays && deal.deadlineDays > 0) {
          setDeadlineDays(deal.deadlineDays);
          setShowDeadline(true);
        }
        if (deal.fallback) {
          setFallback(deal.fallback);
        }

        if (deal.arbitrator) {
          setArbitrator(deal.arbitrator);
          setShowAdvancedRules(true);
        }
        if (deal.threshold) {
          setThreshold(deal.threshold);
        }
        if (deal.approvers && deal.approvers.length > 0) {
          setApprovers(deal.approvers);
          setShowAdvancedRules(true);
        }

        setAiSuccessSummary(deal.summary || 'Deal parsed successfully!');
      } else {
        setAiError(response?.error || 'Could not parse deal details. Please check the text or configure manually.');
      }
    } catch (err: any) {
      console.error('AI parse error:', err);
      setAiError('Network error while analyzing deal. You can enter details manually.');
    } finally {
      setIsParsingAI(false);
    }
  };

  // Milestone management
  const addMilestone = () => setMilestones([...milestones, '']);
  const removeMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    const updated = milestones.filter((_, i) => i !== index);
    setMilestones(updated);
    const sum = updated.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    setTotalAmount(sum.toString());
  };
  const updateMilestone = (index: number, val: string) => {
    const updated = [...milestones];
    updated[index] = val;
    setMilestones(updated);
    const sum = updated.reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
    setTotalAmount(sum.toString());
  };

  // Approver management
  const addApprover = () => setApprovers([...approvers, '']);
  const removeApprover = (index: number) => {
    if (approvers.length <= 1) return;
    setApprovers(approvers.filter((_, i) => i !== index));
  };
  const updateApprover = (index: number, val: string) => {
    const updated = [...approvers];
    updated[index] = val;
    setApprovers(updated);
  };

  // ─── Step 1 Validation ────────────────────────────────────────────────────────
  const canProceedFromStep1 = parseFloat(totalAmount) > 0;

  // ─── Step 2 Validation ────────────────────────────────────────────────────────
  const canProceedFromStep2 =
    parseFloat(totalAmount) > 0 &&
    (walletlessRecipient ? claimPin.trim().length >= 4 : beneficiary.trim().length >= 10);

  // ─── Step 3 Submit Action ─────────────────────────────────────────────────────
  const handleSubmitPayment = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const parsedAmount = parseFloat(totalAmount) || 0;
      const xlmTotalAmount = Math.round(parsedAmount * 10_000_000).toString();

      const validMilestones =
        milestones.length > 1
          ? milestones
              .map((m) => parseFloat(m) || 0)
              .filter((m) => m > 0)
              .map((m) => Math.round(m * 10_000_000).toString())
          : [xlmTotalAmount];

      const validApprovers = approvers.filter((a) => a.trim().length > 0);
      const validArbitrator = arbitrator.trim().length > 0 ? arbitrator.trim() : undefined;

      const result = await createPayment({
        senderAddress: walletlessSender ? undefined : publicKey || undefined,
        beneficiaryAddress: walletlessRecipient ? undefined : beneficiary,
        tokenAddress: 'native',
        amount: xlmTotalAmount,
        milestones: validMilestones,
        threshold,
        approvers: validApprovers,
        arbitrator: validArbitrator,
        walletless: walletlessRecipient,
        walletlessSender,
        claimPin: walletlessRecipient ? claimPin : undefined,
      });

      if (result.success) {
        const finalLink = `${window.location.origin}/claim/${result.payment.shareLink}`;

        const tempSecrets = [];
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
        setSubmitError(result.error || 'Failed to create payment. Please verify parameters.');
      }
    } catch (error: any) {
      console.error('Error creating payment:', error);
      setSubmitError(error.message || 'An unexpected error occurred while creating the escrow.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Copy or share link
  const copyLink = async () => {
    if (!shareLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'TrustPay Protected Payment',
          text: 'You received a protected escrow payment on TrustPay.',
          url: shareLink,
        });
      } else {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ─── Post-Creation Success Screen ─────────────────────────────────────────────
  if (shareLink) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
        <motion.div
          className="rounded-3xl bg-neutral-900/90 border border-white/10 text-center max-w-lg w-full p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Protected Payment Created! 🎉</h2>
          <p className="text-sm text-neutral-400 mb-6">
            Share this link with your recipient to claim their payment once conditions are met.
          </p>

          {temporarySecretInfo && (
            <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <p className="text-xs text-amber-200 font-semibold uppercase tracking-wider">Secret Recovery Keys</p>
              </div>
              <p className="text-xs text-amber-200/80 mb-2">
                Save these secrets now. They allow claiming funds without a pre-existing wallet.
              </p>
              <pre className="text-xs bg-black/50 p-3 rounded-xl text-amber-300 font-mono whitespace-pre-wrap break-all border border-amber-500/20">
                {temporarySecretInfo}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 mb-6">
            <input
              readOnly
              value={shareLink}
              className="flex-1 bg-transparent text-sm font-mono text-indigo-300 outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="flex-shrink-0 rounded-xl bg-indigo-500/20 p-2.5 hover:bg-indigo-500/30 text-indigo-400 transition-colors"
              title="Copy or share link"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <button
            onClick={() => {
              setShareLink(null);
              setTemporarySecretInfo(null);
              setCurrentStep(1);
              setDealPrompt('');
              setAiSuccessSummary(null);
            }}
            className="w-full py-3 px-4 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
          >
            Create Another Deal
          </button>
        </motion.div>
      </div>
    );
  }

  // Generate real-time explanation for Review step
  const currentExplanation = explainTransaction({
    functionName: 'create_escrow',
    amount: totalAmount,
    token: 'XLM',
    beneficiary: walletlessRecipient ? '' : beneficiary,
    milestones: milestones.length > 1 ? milestones : undefined,
    threshold,
    totalApprovers: approvers.filter((a) => a.trim()).length || 1,
    deadlineDays,
    fallback,
    arbitrator: arbitrator.trim() || undefined,
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      {/* Step Indicator Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {currentStep}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {currentStep === 1 && "Step 1: What's this deal for?"}
              {currentStep === 2 && 'Step 2: Who is it with & Rules'}
              {currentStep === 3 && 'Step 3: Review & Sign'}
            </span>
          </div>
          <span className="text-xs text-neutral-500">Step {currentStep} of 3</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: '33%' }}
            animate={{ width: currentStep === 1 ? '33%' : currentStep === 2 ? '66%' : '100%' }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ─── STEP 1: What's this for? ────────────────────────────────────────── */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Create Protected Payment</h1>
              <p className="text-sm text-neutral-400">
                Describe your deal in plain English, or configure amounts directly. Money moves only when agreed conditions are satisfied.
              </p>
            </div>

            {/* AI Deal Builder Card */}
            <div className="rounded-2xl bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/20 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>AI Deal Builder</span>
                </div>
                <span className="text-[11px] font-medium text-indigo-400/80 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Instant Policy Formulation
                </span>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">
                Type what you want in simple language — amount, milestones, deadlines, or fallbacks — and AI will configure the escrow policy for you.
              </p>

              <textarea
                value={dealPrompt}
                onChange={(e) => setDealPrompt(e.target.value)}
                placeholder="e.g., Pay Alex 500 XLM for web development split into 2 equal milestones within 7 days with automatic refund if inactive..."
                rows={3}
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3.5 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />

              {/* Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-neutral-500">Quick examples:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Pay 500 XLM for website design in 2 equal milestones within 7 days with refund',
                    'Hold 200 XLM for marketplace item with 3-day refund fallback',
                    'Escrow 800 XLM with Alice as arbitrator',
                  ].map((example, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDealPrompt(example)}
                      className="rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs text-neutral-300 border border-white/5 transition-all text-left"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleParseWithAI}
                  disabled={isParsingAI || !dealPrompt.trim()}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isParsingAI ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyzing deal terms...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Auto-fill with AI Deal Builder
                    </>
                  )}
                </button>
              </div>

              {/* Status messages */}
              {aiError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiSuccessSummary && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2">
                  <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{aiSuccessSummary}</span>
                </div>
              )}
            </div>

            {/* Core Deal Fields */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
                Payment Details
              </h3>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  Deal Title / Purpose (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Website Redesign Milestone 1"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  Total Amount (XLM)
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => {
                    setTotalAmount(e.target.value);
                    if (milestones.length <= 1) {
                      setMilestones([e.target.value]);
                    }
                  }}
                  min="0.1"
                  step="0.1"
                  placeholder="100"
                  className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white font-medium placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Continue Button */}
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedFromStep1}
              className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Parties & Conditions <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* ─── STEP 2: Who's it with & Conditions ──────────────────────────────── */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Who is it with?</h1>
              <p className="text-sm text-neutral-400">
                Choose how parties interact. First-time users can claim and send without pre-existing wallets.
              </p>
            </div>

            {/* Sender Identity */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 p-5 sm:p-6 space-y-3">
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                Your Sender Account
              </label>
              <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setWalletlessSender(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    !walletlessSender
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" /> Connected Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setWalletlessSender(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    walletlessSender
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" /> No Wallet (Generate)
                </button>
              </div>

              {!walletlessSender && !isConnected && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                  <span>Connect Freighter when ready to sign.</span>
                  <button
                    type="button"
                    onClick={connectWallet}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
                  >
                    Connect
                  </button>
                </div>
              )}
            </div>

            {/* Recipient Identity */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 p-5 sm:p-6 space-y-4">
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                Recipient
              </label>

              <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setWalletlessRecipient(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    walletlessRecipient
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5" /> Shareable Link (No Wallet)
                </button>
                <button
                  type="button"
                  onClick={() => setWalletlessRecipient(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    !walletlessRecipient
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Wallet className="h-3.5 w-3.5" /> Stellar Address
                </button>
              </div>

              {walletlessRecipient ? (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                    Claim PIN / Secret Passphrase
                  </label>
                  <input
                    type="text"
                    value={claimPin}
                    onChange={(e) => setClaimPin(e.target.value)}
                    placeholder="e.g. 1234 or a secret word"
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Share this PIN separately with your recipient to unlock their claimable balance.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                    Beneficiary Stellar Address (G...)
                  </label>
                  <input
                    type="text"
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder="GABX6M3Z..."
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white font-mono placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
              )}
            </div>

            {/* Progressive Disclosure Section: Milestones */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowMilestones(!showMilestones)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">Milestone Releases</h4>
                  <p className="text-xs text-neutral-400">
                    {milestones.length > 1
                      ? `${milestones.length} milestones totaling ${totalAmount} XLM`
                      : 'Single release on completion (Click to split into milestones)'}
                  </p>
                </div>
                {showMilestones ? (
                  <ChevronUp className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              {showMilestones && (
                <div className="p-4 sm:p-5 pt-0 space-y-3 border-t border-white/5">
                  {milestones.map((amt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-neutral-400 font-mono">
                        {i + 1}
                      </span>
                      <input
                        type="number"
                        value={amt}
                        onChange={(e) => updateMilestone(i, e.target.value)}
                        placeholder={`Milestone ${i + 1} (XLM)`}
                        className="flex-1 rounded-xl bg-black/40 border border-white/10 p-2.5 text-xs text-white"
                        step="0.1"
                        min="0.1"
                      />
                      {milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(i)}
                          className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMilestone}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors pt-1"
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Add Milestone
                  </button>
                </div>
              )}
            </div>

            {/* Progressive Disclosure Section: Deadline & Timeout */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDeadline(!showDeadline)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">Deadline & Auto-Resolution</h4>
                  <p className="text-xs text-neutral-400">
                    {deadlineDays > 0
                      ? `${deadlineDays} days timeout with automatic ${fallback}`
                      : 'No automatic deadline (Click to configure auto-refund)'}
                  </p>
                </div>
                {showDeadline ? (
                  <ChevronUp className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              {showDeadline && (
                <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-white/5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Timeout Duration (Days)
                    </label>
                    <input
                      type="number"
                      value={deadlineDays || ''}
                      onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 0)}
                      placeholder="e.g. 7"
                      min="1"
                      className="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Fallback Action if Deadline Expires
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setFallback('refund')}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          fallback === 'refund'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Refund Sender
                      </button>
                      <button
                        type="button"
                        onClick={() => setFallback('release')}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          fallback === 'release'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        Release to Recipient
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Progressive Disclosure Section: Approvers & Arbitrator */}
            <div className="rounded-2xl bg-neutral-900/60 border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedRules(!showAdvancedRules)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-white">Disputes & Multi-Sig Approvals</h4>
                  <p className="text-xs text-neutral-400">
                    {arbitrator
                      ? 'Arbitrator configured for dispute resolution'
                      : 'Standard single-party approval (Click to add arbitrator)'}
                  </p>
                </div>
                {showAdvancedRules ? (
                  <ChevronUp className="h-4 w-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-neutral-400" />
                )}
              </button>

              {showAdvancedRules && (
                <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-white/5">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Arbitrator Address (Optional)
                    </label>
                    <p className="text-[11px] text-neutral-500 mb-2">
                      An arbitrator holds dispute override authority if either party contests release.
                    </p>
                    <input
                      type="text"
                      value={arbitrator}
                      onChange={(e) => setArbitrator(e.target.value)}
                      placeholder="G... (Arbitrator public key)"
                      className="w-full rounded-xl bg-black/40 border border-white/10 p-2.5 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                      Approval Threshold ({threshold} of {approvers.filter((a) => a.trim()).length || 1})
                    </label>
                    <input
                      type="range"
                      min="1"
                      max={Math.max(1, approvers.length)}
                      value={threshold}
                      onChange={(e) => setThreshold(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-5 py-3 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedFromStep2}
                className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review via Explain Before You Sign <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: Review via Explain Before You Sign ─────────────────────── */}
        {currentStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Review & Confirm</h1>
              <p className="text-sm text-neutral-400">
                Understand exactly how your payment executes before you sign. No hidden gas or unstated rules.
              </p>
            </div>

            {/* Render Explain Before You Sign */}
            <ExplainBeforeYouSign
              explanation={currentExplanation}
              onConfirm={handleSubmitPayment}
              onCancel={() => setCurrentStep(2)}
              isSubmitting={isSubmitting}
              confirmLabel={
                walletlessSender
                  ? 'Confirm & Create Payment'
                  : isConnected
                  ? 'Sign & Lock in Escrow'
                  : 'Connect Wallet to Sign'
              }
            />

            {submitError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Transaction Failed</p>
                  <p>{submitError}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
