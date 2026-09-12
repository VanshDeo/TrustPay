'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, Info, Clock, CheckCircle2, Lock, ArrowUpRight } from 'lucide-react';
import { TransactionExplanation } from '@/lib/explainer';

interface ExplainBeforeYouSignProps {
  explanation: TransactionExplanation;
  onConfirm?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  confirmLabel?: string;
  showActions?: boolean;
}

export default function ExplainBeforeYouSign({
  explanation,
  onConfirm,
  onCancel,
  isSubmitting = false,
  confirmLabel = 'Confirm & Sign',
  showActions = true,
}: ExplainBeforeYouSignProps) {
  const { summary, details, financialImpact, conditions, safety } = explanation;

  return (
    <div className="rounded-2xl bg-neutral-900/90 border border-white/10 p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header Banner */}
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Explain Before You Sign</h3>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/30">
              Plain Language Review
            </span>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed font-medium">
            {summary}
          </p>
        </div>
      </div>

      {/* Financial Impact Badge */}
      {financialImpact.amount !== '0' && (
        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
              {financialImpact.direction === 'locked' ? (
                <Lock className="h-5 w-5 text-indigo-400" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-neutral-400">
                {financialImpact.direction === 'locked' ? 'Funds Protected in Escrow' : 'Transfer Amount'}
              </p>
              <p className="text-lg font-bold text-white tracking-wide">
                {financialImpact.amount} {financialImpact.token}
              </p>
            </div>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            Self-Enforcing Policy
          </span>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {details.map((item, idx) => (
          <div key={idx} className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <p className="text-xs font-medium text-neutral-400 mb-1">{item.label}</p>
            <p className={`text-sm font-semibold truncate ${item.highlight ? 'text-indigo-300' : 'text-neutral-200'}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Conditions & Release Rules */}
      {conditions.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white/[0.02] border border-white/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-indigo-400" /> Terms of Release
          </p>
          <ul className="space-y-1.5 text-xs text-neutral-300">
            {conditions.map((cond, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                <span>{cond}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety Notice */}
      <div
        className={`flex items-start gap-3 rounded-xl p-3.5 text-xs border ${
          safety.level === 'warning'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
            : safety.level === 'info'
            ? 'bg-sky-500/10 border-sky-500/20 text-sky-200'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
        }`}
      >
        {safety.level === 'warning' ? (
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" />
        ) : (
          <Info className="h-4 w-4 flex-shrink-0 text-indigo-400 mt-0.5" />
        )}
        <span>{safety.message}</span>
      </div>

      {/* Action Buttons */}
      {showActions && onConfirm && (
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-white/10 text-neutral-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
            >
              Back to Edit
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing & Confirming...
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      )}
    </div>
  );
}
