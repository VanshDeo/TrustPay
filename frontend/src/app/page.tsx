'use client';

/**
 * Landing Page — TrustPay hero section with feature cards and live stats.
 */
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Shield, Users, Zap, Wallet, ArrowRight, Lock, Globe, TrendingUp } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

const features = [
  {
    icon: Lock,
    title: 'Escrow Payments',
    description: 'Lock funds in a smart contract. Released only when conditions are met on-chain.',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    icon: Users,
    title: 'Multi-Sig Approval',
    description: 'Configurable M-of-N approval threshold. Multiple parties verify before release.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Zap,
    title: 'Gasless Transactions',
    description: 'Users never pay fees. Our fee sponsor covers gas costs via fee bump transactions.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Wallet,
    title: 'Smart Wallet',
    description: 'Account abstraction for simplified auth. No seed phrase management needed.',
    gradient: 'from-orange-500 to-amber-500',
  },
];

const stats = [
  { label: 'Smart Contracts', value: '4', icon: Shield },
  { label: 'Blockchain', value: 'Stellar', icon: Globe },
  { label: 'Avg Finality', value: '~5s', icon: TrendingUp },
];

export default function LandingPage() {
  const { connectWallet, isConnected } = useWallet();

  return (
    <div className="relative">
      {/* ─── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-20 pb-32 sm:px-6 lg:px-8">
        {/* Animated background orbs */}
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-indigo-500/10 blur-[100px] animate-float" />
        <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-purple-500/8 blur-[120px]" style={{ animationDelay: '1s' }} />

        <div className="relative mx-auto max-w-5xl text-center">
          {/* Badge */}
          <motion.div
            className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-4 py-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-indigo-300">Live on Stellar Testnet</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mb-6 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-7xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Trustless Payments,{' '}
            <span className="gradient-text">Verified On‑Chain</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="mx-auto mb-10 max-w-2xl text-lg text-white/50 sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Create conditional payments that release only when your rules are met.
            Multi-sig approval, gasless UX, and smart wallet — all powered by Soroban.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {isConnected ? (
              <Link href="/create" className="btn-primary text-lg flex items-center gap-2">
                Create Payment <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <button onClick={connectWallet} className="btn-primary text-lg flex items-center gap-2">
                Connect Wallet <Wallet className="h-5 w-5" />
              </button>
            )}
            <Link href="/dashboard" className="btn-secondary text-lg">
              View Dashboard
            </Link>
          </motion.div>
        </div>

        {/* Stats Strip */}
        <motion.div
          className="relative mx-auto mt-20 max-w-3xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="glass-card-static text-center !p-4">
                <stat.icon className="mx-auto mb-2 h-5 w-5 text-indigo-400" />
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── Features Section ────────────────────────────────────────────── */}
      <section className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl mb-4">
              Built for <span className="gradient-text">Trust</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Four production-grade smart contracts working together to eliminate trust issues in digital payments.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                className="glass-card group cursor-default"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} opacity-80`}>
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────────────────────── */}
      <section className="relative px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-white sm:text-4xl mb-4">
              How It <span className="gradient-text">Works</span>
            </h2>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: '01', title: 'Create Escrow', desc: 'Set amount, beneficiary, and approval rules. Funds are locked on-chain.' },
              { step: '02', title: 'Share Link', desc: 'Get a unique payment link to share with approvers and the beneficiary.' },
              { step: '03', title: 'Collect Approvals', desc: 'Approvers sign transactions. Progress is tracked in real-time.' },
              { step: '04', title: 'Release Funds', desc: 'Once threshold is met, funds are automatically released to the beneficiary.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-6 glass-card-static !p-5"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                  <span className="text-lg font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-white/40 text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
