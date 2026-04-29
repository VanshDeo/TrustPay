'use client';

import { Code2, Globe, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-bold text-white mb-2">
              Trust<span className="gradient-text">Pay</span>
            </h3>
            <p className="text-white/40 text-sm max-w-md">
              Trustless conditional payments on the Stellar blockchain.
              Powered by Soroban smart contracts for secure escrow-based transactions.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/create" className="text-sm text-white/40 hover:text-white transition-colors">Create Payment</Link></li>
              <li><Link href="/dashboard" className="text-sm text-white/40 hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link href="/metrics" className="text-sm text-white/40 hover:text-white transition-colors">Metrics</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Network</h4>
            <ul className="space-y-2">
              <li>
                <a href="https://stellar.org" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1">
                  Stellar <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a href="https://stellar.expert" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1">
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-white/30">
            © 2026 TrustPay. Built on Stellar.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-white/30 hover:text-white transition-colors">
              <Code2 className="h-5 w-5" />
            </a>
            <a href="#" className="text-white/30 hover:text-white transition-colors">
              <Globe className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
