'use client';

/**
 * Navbar — Sticky top navigation with logo, page links, and wallet button.
 * Includes mobile hamburger menu for responsive design.
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Wallet, LayoutDashboard, PlusCircle, BarChart3 } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

const navLinks = [
  { href: '/create', label: 'Create Payment', icon: PlusCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
];

export default function Navbar() {
  const { publicKey, isConnected, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  const truncatedKey = publicKey
    ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    : '';

  return (
    <nav className="sticky top-0 z-40 border-b border-white/5" style={{ background: 'rgba(10, 14, 26, 0.8)', backdropFilter: 'blur(20px)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 transition-transform group-hover:scale-110">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Trust<span className="gradient-text">Pay</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition-all hover:text-white hover:bg-white/5"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>

          {/* Wallet Button */}
          <div className="hidden md:flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-mono text-emerald-300">{truncatedKey}</span>
                </div>
                <button
                  onClick={disconnectWallet}
                  className="btn-secondary text-sm !px-4 !py-2"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="btn-primary text-sm !px-5 !py-2.5 flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/5"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden border-t border-white/5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 text-white/60 hover:text-white hover:bg-white/5"
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/5">
                {isConnected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-mono text-emerald-300">{truncatedKey}</span>
                    </div>
                    <button onClick={disconnectWallet} className="btn-secondary w-full text-sm">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
