'use client';

/**
 * Agent / Developer View — Agentic Payment Gateway (x402-shaped, Stellar-settled)
 *
 * Provides API key management, Smart Wallet mandate spending-limit monitoring,
 * live 402 challenge/settlement audit logs, and an interactive 402 test simulator.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Shield,
  Key,
  FileCode,
  Activity,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Code2,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import {
  getGatewayResources,
  requestGatewayResource,
  payGatewayResource,
  getAgentMandates,
  saveAgentMandate,
  getGatewayLogs,
  getApiKeys,
  generateApiKey,
  revokeApiKey,
} from '@/lib/api';
import { truncateAddress } from '@/lib/stellar';

type Tab = 'mandates' | 'logs' | 'keys' | 'simulator';

export default function DeveloperGatewayPage() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('mandates');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Mandates State ──
  const [mandates, setMandates] = useState<any[]>([]);
  const [mandatesLoading, setMandatesLoading] = useState(true);
  const [showNewMandateModal, setShowNewMandateModal] = useState(false);
  const [mandateForm, setMandateForm] = useState({
    agentAddress: '',
    label: '',
    perTxLimit: '5000000', // 5 USDC
    perPeriodLimit: '25000000', // 25 USDC
    periodDurationHours: '24',
    tokenAddress: 'USDC',
  });
  const [mandateSubmitting, setMandateSubmitting] = useState(false);

  // ── Logs State ──
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'payment_required' | 'escrow_created' | 'settled'>('all');

  // ── Keys State ──
  const [keys, setKeys] = useState<any[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [keyGenerating, setKeyGenerating] = useState(false);

  // ── Simulator State ──
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>('ai-inference-alpha');
  const [simStep, setSimStep] = useState<number>(1);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [sim402Response, setSim402Response] = useState<any | null>(null);
  const [simPaymentResult, setSimPaymentResult] = useState<any | null>(null);
  const [simSettledPayload, setSimSettledPayload] = useState<any | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Load Data
  const refreshMandates = async () => {
    setMandatesLoading(true);
    try {
      const res = await getAgentMandates(publicKey || undefined);
      if (res.success && res.mandates) {
        setMandates(res.mandates);
      } else {
        // Fallback default sample mandate for demonstration if empty
        setMandates([
          {
            _id: 'sample_m1',
            agentAddress: 'GCZ4AGNT273KMWQ3LP26YTR4QW5N8L90X4V2M1A7K90L82F',
            ownerAddress: publicKey || 'GD7YHUMANOWNERADDRESS000000000000000000000',
            label: 'Autonomous Arbitrage & Market Agent',
            perTxLimit: '5000000',
            perPeriodLimit: '50000000',
            periodDuration: 86400,
            periodUsed: '12000000',
            tokenAddress: 'USDC',
            isActive: true,
          },
        ]);
      }
    } catch (e) {
      console.warn('Error fetching mandates:', e);
    } finally {
      setMandatesLoading(false);
    }
  };

  const refreshLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await getGatewayLogs({
        status: logFilter === 'all' ? undefined : logFilter,
      });
      if (res.success && res.logs) {
        setLogs(res.logs);
      }
    } catch (e) {
      console.warn('Error fetching logs:', e);
    } finally {
      setLogsLoading(false);
    }
  };

  const refreshKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await getApiKeys(publicKey || undefined);
      if (res.success && res.keys) {
        setKeys(res.keys);
      }
    } catch (e) {
      console.warn('Error fetching keys:', e);
    } finally {
      setKeysLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const res = await getGatewayResources();
      if (res.success && res.resources) {
        setResources(res.resources);
      }
    } catch (e) {
      console.warn('Error fetching resources:', e);
    }
  };

  useEffect(() => {
    refreshMandates();
    refreshLogs();
    refreshKeys();
    loadResources();
  }, [publicKey]);

  useEffect(() => {
    refreshLogs();
  }, [logFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Mandate Submit ──
  const handleSaveMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandateForm.agentAddress || !mandateForm.label) return;
    setMandateSubmitting(true);
    try {
      await saveAgentMandate({
        agentAddress: mandateForm.agentAddress,
        ownerAddress: publicKey || 'GD7YHUMANOWNERADDRESS000000000000000000000',
        label: mandateForm.label,
        perTxLimit: mandateForm.perTxLimit,
        perPeriodLimit: mandateForm.perPeriodLimit,
        periodDuration: parseInt(mandateForm.periodDurationHours, 10) * 3600,
        tokenAddress: mandateForm.tokenAddress,
      });
      setShowNewMandateModal(false);
      setMandateForm({
        agentAddress: '',
        label: '',
        perTxLimit: '5000000',
        perPeriodLimit: '25000000',
        periodDurationHours: '24',
        tokenAddress: 'USDC',
      });
      await refreshMandates();
    } catch (err) {
      console.error('Error saving mandate:', err);
    } finally {
      setMandateSubmitting(false);
    }
  };

  // ── Key Generate ──
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName) return;
    setKeyGenerating(true);
    try {
      const res = await generateApiKey({
        name: newKeyName,
        ownerAddress: publicKey || 'GD7YHUMANOWNERADDRESS000000000000000000000',
      });
      if (res.success && res.apiKey) {
        setCreatedSecret(res.apiKey.secretKey);
        setNewKeyName('');
        await refreshKeys();
      }
    } catch (err) {
      console.error('Error generating key:', err);
    } finally {
      setKeyGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is immediate.')) return;
    try {
      await revokeApiKey(keyId);
      await refreshKeys();
    } catch (err) {
      console.error('Error revoking key:', err);
    }
  };

  // ── Simulator Handlers ──
  const runSimStep1 = async () => {
    setSimLoading(true);
    setSimError(null);
    setSim402Response(null);
    setSimPaymentResult(null);
    setSimSettledPayload(null);
    try {
      // Send unauthenticated GET -> expects 402 Payment Required
      const res = await requestGatewayResource(selectedResourceId);
      if (res.status === 402) {
        setSim402Response(res.data);
        setSimStep(2);
      } else {
        setSimError(`Unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      setSimError(err.message || 'Failed to request resource');
    } finally {
      setSimLoading(false);
    }
  };

  const runSimStep2 = async () => {
    if (!sim402Response?.x402) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const activeAgent = mandates[0]?.agentAddress || 'GCZ4AGNT273KMWQ3LP26YTR4QW5N8L90X4V2M1A7K90L82F';
      const payRes = await payGatewayResource({
        resourceId: selectedResourceId,
        agentAddress: activeAgent,
        amount: sim402Response.x402.amount,
      });

      if (payRes.success) {
        setSimPaymentResult(payRes);
        setSimStep(3);
        await refreshLogs();
        await refreshMandates();
      } else {
        setSimError(payRes.error || 'Payment execution rejected by mandate policy');
      }
    } catch (err: any) {
      setSimError(err.message || 'Payment execution failed');
    } finally {
      setSimLoading(false);
    }
  };

  const runSimStep3 = async () => {
    if (!simPaymentResult?.escrowId) return;
    setSimLoading(true);
    setSimError(null);
    try {
      // Replay GET with X-Escrow-Id header
      const res = await requestGatewayResource(selectedResourceId, {
        escrowId: simPaymentResult.escrowId,
        agentAddress: simPaymentResult.agentAddress,
      });

      if (res.status === 200 && res.data.success) {
        setSimSettledPayload(res.data);
        setSimStep(4);
        await refreshLogs();
      } else {
        setSimError(`Settlement verification failed with status ${res.status}`);
      }
    } catch (err: any) {
      setSimError(err.message || 'Settlement verification request failed');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                Agentic Payment Gateway
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                  x402 · Stellar Soroban
                </span>
              </h1>
              <p className="text-sm text-white/60 mt-0.5">
                Autonomous agent spending limits, HTTP 402 challenge policies, and programmable escrow settlement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => {
              refreshMandates();
              refreshLogs();
              refreshKeys();
            }}
            className="btn-secondary !py-2 !px-3 text-xs flex items-center gap-1.5"
            title="Refresh Gateway Data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Soroban Testnet Online
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/5">
        {[
          { id: 'mandates', label: 'Mandates & Limits', icon: Shield },
          { id: 'logs', label: '402 Gateway Logs', icon: Activity },
          { id: 'keys', label: 'API Keys & Integration', icon: Key },
          { id: 'simulator', label: 'Interactive 402 Simulator', icon: Play },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: MANDATES & SPENDING LIMITS ─────────────────────────────────── */}
      {activeTab === 'mandates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Agent Spending-Limit Mandates</h2>
              <p className="text-xs text-white/50">
                Addresses Smart Wallets with enforced policy limits. Autonomous agent keys cannot exceed these bounds.
              </p>
            </div>
            <button
              onClick={() => setShowNewMandateModal(true)}
              className="btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Agent Mandate
            </button>
          </div>

          {mandatesLoading ? (
            <div className="p-8 text-center text-white/50 flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
              <span>Querying Smart Wallet mandates…</span>
            </div>
          ) : mandates.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <Shield className="h-10 w-10 text-white/30 mx-auto mb-3" />
              <h3 className="text-base font-medium text-white">No Agent Mandates Active</h3>
              <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">
                Configure a spending limit for an AI agent smart wallet to allow autonomous 402 micro-escrows under your authorization.
              </p>
              <button
                onClick={() => setShowNewMandateModal(true)}
                className="btn-primary !py-2 !px-4 text-xs mt-4"
              >
                Configure First Mandate
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mandates.map((m) => {
                const perTxNum = (parseInt(m.perTxLimit, 10) / 1000000).toFixed(2);
                const perPeriodNum = (parseInt(m.perPeriodLimit, 10) / 1000000).toFixed(2);
                const usedNum = (parseInt(m.periodUsed || '0', 10) / 1000000).toFixed(2);
                const pctUsed = Math.min(
                  100,
                  Math.round(((parseInt(m.periodUsed || '0', 10)) / (parseInt(m.perPeriodLimit, 10) || 1)) * 100)
                );

                return (
                  <div
                    key={m._id || m.agentAddress}
                    className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-base">{m.label}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Enforced On-Chain
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-mono text-white/50">
                            {truncateAddress(m.agentAddress)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(m.agentAddress, m.agentAddress)}
                            className="text-white/40 hover:text-white"
                          >
                            {copiedId === m.agentAddress ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Cpu className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Limit Stats */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                      <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Per-Tx Limit
                        </span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">
                          {perTxNum} <span className="text-xs text-white/50">{m.tokenAddress}</span>
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider block">
                          Period Cap ({Math.round(m.periodDuration / 3600)}h)
                        </span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">
                          {perPeriodNum} <span className="text-xs text-white/50">{m.tokenAddress}</span>
                        </span>
                      </div>
                    </div>

                    {/* Usage Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/50">Current Period Budget Used:</span>
                        <span className="font-mono text-white/80">
                          {usedNum} / {perPeriodNum} {m.tokenAddress} ({pctUsed}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            pctUsed > 80 ? 'bg-amber-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pctUsed}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Mandate Modal */}
          {showNewMandateModal && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-400" />
                    Configure Agent Mandate
                  </h3>
                  <button
                    onClick={() => setShowNewMandateModal(false)}
                    className="text-white/40 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveMandate} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Agent Mandate Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Market Intelligence Bot #4"
                      value={mandateForm.label}
                      onChange={(e) => setMandateForm({ ...mandateForm, label: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Agent Smart Wallet Address (Signer Key)
                    </label>
                    <input
                      type="text"
                      placeholder="G... or Soroban Contract ID"
                      value={mandateForm.agentAddress}
                      onChange={(e) => setMandateForm({ ...mandateForm, agentAddress: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs placeholder-white/30 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">
                        Max Per-Tx Limit (Stroops / Units)
                      </label>
                      <input
                        type="text"
                        placeholder="5000000 (5 USDC)"
                        value={mandateForm.perTxLimit}
                        onChange={(e) => setMandateForm({ ...mandateForm, perTxLimit: e.target.value })}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">
                        Rolling Period Cap (Stroops / Units)
                      </label>
                      <input
                        type="text"
                        placeholder="25000000 (25 USDC)"
                        value={mandateForm.perPeriodLimit}
                        onChange={(e) => setMandateForm({ ...mandateForm, perPeriodLimit: e.target.value })}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Period Duration (Hours)</label>
                      <input
                        type="number"
                        value={mandateForm.periodDurationHours}
                        onChange={(e) =>
                          setMandateForm({ ...mandateForm, periodDurationHours: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-white/70 mb-1">Asset Symbol</label>
                      <input
                        type="text"
                        value={mandateForm.tokenAddress}
                        onChange={(e) => setMandateForm({ ...mandateForm, tokenAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                    💡 This limits the agent key inside Smart Wallet's <code>__check_auth</code>. If the agent attempts a payment above the cap, the transaction is rejected automatically.
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowNewMandateModal(false)}
                      className="btn-secondary !py-2 !px-4 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={mandateSubmitting}
                      className="btn-primary !py-2 !px-5 text-xs flex items-center gap-2"
                    >
                      {mandateSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Save Mandate Policy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: 402 GATEWAY LOGS ────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">402 Paywall Audit Logs</h2>
              <p className="text-xs text-white/50">
                Real-time stream of HTTP 402 challenges issued to AI agents and conditional escrow settlements.
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 self-start">
              {(['all', 'payment_required', 'escrow_created', 'settled'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`px-3 py-1 text-xs rounded-lg transition-all capitalize ${
                    logFilter === f ? 'bg-indigo-600 text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {logsLoading ? (
            <div className="p-8 text-center text-white/50 flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
              <span>Loading gateway request logs…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
              <Activity className="h-10 w-10 text-white/30 mx-auto mb-3" />
              <h3 className="text-base font-medium text-white">No Request Logs Recorded Yet</h3>
              <p className="text-xs text-white/50 mt-1">
                Trigger a sample 402 request in the Interactive Simulator tab to inspect incoming challenges.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Resource / Endpoint</th>
                    <th className="py-3 px-4">Status Code</th>
                    <th className="py-3 px-4">Asset & Amount</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4 text-right">Raw Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {logs.map((log) => {
                    const amountFormatted = (parseInt(log.amount, 10) / 1000000).toFixed(2);
                    return (
                      <tr key={log._id || log.requestId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-white/50">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-medium block">{log.resourceId}</span>
                          <span className="text-[10px] text-white/40">{log.resourcePath}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.httpStatus === 402
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            HTTP {log.httpStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/80">
                          {amountFormatted} {log.asset}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                              log.status === 'settled'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : log.status === 'escrow_created'
                                ? 'bg-indigo-500/10 text-indigo-300'
                                : 'bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {log.status === 'settled' && <CheckCircle2 className="h-3 w-3" />}
                            {log.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 underline font-sans"
                          >
                            Inspect JSON
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Log Raw Inspector Modal */}
          {selectedLog && (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white">
                      Raw Request & Challenge Inspector
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-white/40 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center text-white/50">
                    <span>Request ID: <span className="font-mono text-white">{selectedLog.requestId}</span></span>
                    <span>Time: <span className="font-mono text-white">{new Date(selectedLog.createdAt).toISOString()}</span></span>
                  </div>

                  <div className="bg-black/40 border border-white/5 rounded-xl p-4 overflow-x-auto max-h-96">
                    <pre className="font-mono text-indigo-200 text-xs leading-relaxed">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/10">
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="btn-secondary !py-2 !px-4 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: API KEYS & AGENT INTEGRATION ──────────────────────────────── */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Developer API Keys</h2>
              <p className="text-xs text-white/50">
                Keys used by external agent clients to interact with TrustPay's Gateway endpoints.
              </p>
            </div>
          </div>

          {/* Key Generation Card */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <h3 className="text-sm font-semibold text-white">Generate New API Key</h3>
            <form onSubmit={handleGenerateKey} className="flex gap-3">
              <input
                type="text"
                placeholder="Key Name (e.g. Production Agent #1)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                required
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={keyGenerating || !newKeyName}
                className="btn-primary !py-2 !px-5 text-xs flex items-center gap-2"
              >
                {keyGenerating && <RefreshCw className="h-3 w-3 animate-spin" />}
                Generate Key
              </button>
            </form>

            {/* Created secret banner */}
            {createdSecret && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-300">
                    🔑 Copy your secret key now. It will never be displayed again:
                  </span>
                  <button
                    onClick={() => copyToClipboard(createdSecret, 'createdSecret')}
                    className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1"
                  >
                    {copiedId === 'createdSecret' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-black/40 font-mono text-xs text-emerald-200 break-all select-all">
                  {createdSecret}
                </div>
              </div>
            )}
          </div>

          {/* Keys List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Active Keys</h3>
            {keysLoading ? (
              <div className="p-6 text-center text-white/50">Loading keys…</div>
            ) : keys.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-xs text-white/50">
                No active API keys found. Generate one above to integrate external agents.
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((k) => (
                  <div
                    key={k.keyId}
                    className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{k.name}</span>
                        <span className="text-[10px] font-mono text-white/40">ID: {k.keyId}</span>
                      </div>
                      <div className="text-xs font-mono text-white/50">
                        Prefix: <span className="text-indigo-300">{k.keyPrefix}</span> · Created:{' '}
                        {new Date(k.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(k.keyId)}
                      className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Revoke API Key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quickstart Code Snippets */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileCode className="h-4 w-4 text-indigo-400" />
              Agent Autonomous Integration Protocol (x402)
            </h3>
            <p className="text-xs text-white/60">
              External agents query paid resources, receive an HTTP 402 with conditional escrow instructions, settle via their Smart Wallet within mandate limits, and present proof to claim access.
            </p>

            <div className="bg-black/50 rounded-xl p-4 border border-white/5 font-mono text-xs text-white/80 space-y-4">
              <div>
                <span className="text-white/40 block mb-1"># Step 1: Agent requests resource without proof (returns HTTP 402)</span>
                <p className="text-emerald-400">curl -i https://trust-pay-pi.vercel.app/api/gateway/resource/ai-inference-alpha</p>
              </div>
              <div>
                <span className="text-white/40 block mb-1"># Step 2: Agent executes conditional payment via Smart Wallet & gets Escrow ID</span>
                <p className="text-emerald-400">
                  curl -X POST https://trust-pay-pi.vercel.app/api/gateway/pay \<br />
                  &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
                  &nbsp;&nbsp;-d &apos;{JSON.stringify({ resourceId: 'ai-inference-alpha', agentAddress: 'G...AGENT_SMART_WALLET' })}&apos;
                </p>
              </div>
              <div>
                <span className="text-white/40 block mb-1"># Step 3: Agent replays request with escrow proof (returns HTTP 200 OK)</span>
                <p className="text-emerald-400">
                  curl -i https://trust-pay-pi.vercel.app/api/gateway/resource/ai-inference-alpha \<br />
                  &nbsp;&nbsp;-H &quot;X-Escrow-Id: escrow_agent_abc123&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: INTERACTIVE 402 SIMULATOR ─────────────────────────────────── */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Interactive 402 Gateway Simulator</h2>
            <p className="text-xs text-white/50">
              Test and visualize the complete end-to-end autonomous paywall flow: Challenge → Mandate Check → Escrow Lock → Content Delivery.
            </p>
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { num: 1, label: '1. Request Resource' },
              { num: 2, label: '2. 402 Challenge' },
              { num: 3, label: '3. Mandate Escrow' },
              { num: 4, label: '4. Resource Unlocked' },
            ].map((s) => (
              <div
                key={s.num}
                className={`py-2 px-3 rounded-xl border font-medium transition-all ${
                  simStep === s.num
                    ? 'border-indigo-500 bg-indigo-500/20 text-white'
                    : simStep > s.num
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/5 bg-white/[0.02] text-white/40'
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          {/* Resource selector */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4">
            <label className="block text-xs font-semibold text-white">Select Protected Gateway Resource:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {resources.map((r) => {
                const isSel = selectedResourceId === r.id;
                const priceFormatted = (parseInt(r.price, 10) / 1000000).toFixed(2);
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedResourceId(r.id);
                      setSimStep(1);
                      setSim402Response(null);
                      setSimPaymentResult(null);
                      setSimSettledPayload(null);
                      setSimError(null);
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      isSel
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                      {r.category}
                    </span>
                    <span className="text-sm font-bold text-white block mt-1">{r.name}</span>
                    <span className="text-xs font-mono text-emerald-300 mt-2 block">
                      {priceFormatted} {r.asset}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error display */}
          {simError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{simError}</span>
            </div>
          )}

          {/* Flow Actions */}
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-6">
            {simStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white">
                  <Play className="h-4 w-4 text-indigo-400" />
                  <span className="font-semibold text-sm">Step 1: Agent queries protected resource (No Payment Header)</span>
                </div>
                <p className="text-xs text-white/60">
                  The client makes an initial request to <code>/api/gateway/resource/{selectedResourceId}</code> without proof of payment.
                </p>
                <button
                  onClick={runSimStep1}
                  disabled={simLoading}
                  className="btn-primary !py-2.5 !px-6 text-xs flex items-center gap-2"
                >
                  {simLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Execute Agent GET Request
                </button>
              </div>
            )}

            {simStep === 2 && sim402Response && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-xs">
                      HTTP 402 Payment Required
                    </span>
                    <span>Received Machine-Readable Escrow Challenge</span>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-amber-200">
                    {JSON.stringify(sim402Response, null, 2)}
                  </pre>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
                  ⚡ The agent analyzes the <code>x402</code> condition (Amount: {sim402Response.x402.amount} units, Timeout: 86400s, Fallback: Refund). It verifies that this fits within its Smart Wallet Mandate limits.
                </div>

                <button
                  onClick={runSimStep2}
                  disabled={simLoading}
                  className="btn-primary !py-2.5 !px-6 text-xs flex items-center gap-2"
                >
                  {simLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Execute Payment within Mandate Policy
                </button>
              </div>
            )}

            {simStep === 3 && simPaymentResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Escrow Payment Created & Authorized by Policy Engine</span>
                  </div>
                </div>

                <div className="bg-black/50 border border-white/10 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-indigo-200">
                    {JSON.stringify(simPaymentResult, null, 2)}
                  </pre>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  🎉 Escrow ID <code>{simPaymentResult.escrowId}</code> created and funds held conditionally on Soroban. The agent can now replay the GET request with <code>X-Escrow-Id: {simPaymentResult.escrowId}</code>.
                </div>

                <button
                  onClick={runSimStep3}
                  disabled={simLoading}
                  className="btn-primary !py-2.5 !px-6 text-xs flex items-center gap-2"
                >
                  {simLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Replay GET with Escrow Proof Header
                </button>
              </div>
            )}

            {simStep === 4 && simSettledPayload && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>HTTP 200 OK — Protected Resource Delivered</span>
                  </div>
                  <button
                    onClick={() => {
                      setSimStep(1);
                      setSim402Response(null);
                      setSimPaymentResult(null);
                      setSimSettledPayload(null);
                    }}
                    className="btn-secondary !py-1.5 !px-3 text-xs"
                  >
                    Reset Test Run
                  </button>
                </div>

                <div className="bg-black/50 border border-emerald-500/30 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-emerald-200">
                    {JSON.stringify(simSettledPayload, null, 2)}
                  </pre>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                  <div className="font-semibold">Full Cycle Complete!</div>
                  <div className="text-white/60">
                    Payment verified against the Soroban Escrow contract; protected resource unlocked autonomously without manual intervention.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
