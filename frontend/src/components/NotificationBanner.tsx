'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NotificationBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner
    const dismissed = localStorage.getItem('trustpay_walletless_banner_dismissed');
    if (!dismissed) {
      // Delay showing the banner slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('trustpay_walletless_banner_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="bg-indigo-600 border-b border-indigo-500 shadow-lg relative z-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/50">
                <Info className="h-5 w-5 text-white" />
              </span>
              <p className="text-sm font-medium text-indigo-50">
                Received a secret word? Connect your Freighter wallet to claim your funds!
                <Link href="/dashboard" className="ml-2 inline-flex items-center text-white font-bold hover:underline">
                  Learn more <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </p>
            </div>
            <button
              onClick={dismiss}
              className="flex-shrink-0 rounded-lg p-1.5 text-indigo-200 hover:bg-indigo-500/50 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
