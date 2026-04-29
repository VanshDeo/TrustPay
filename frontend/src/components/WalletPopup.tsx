'use client';

/**
 * WalletPopup — Animated success card shown when wallet connects.
 *
 * Features:
 * - "Wallet Connected 🎉" title
 * - "You are successfully connected" message
 * - Framer Motion slide-in + scale animation
 * - Glassmorphism card with gradient border
 * - Animated checkmark SVG
 * - Auto-closes after 2 seconds
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/context/WalletContext';

export default function WalletPopup() {
  const { showPopup, publicKey, setShowPopup } = useWallet();

  return (
    <AnimatePresence>
      {showPopup && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPopup(false)}
          />

          {/* Popup Card */}
          <motion.div
            className="fixed top-1/2 left-1/2 z-50 w-[90%] max-w-md"
            initial={{ opacity: 0, scale: 0.7, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 0.7, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="relative overflow-hidden rounded-3xl p-[1px]"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899, #6366f1)',
                backgroundSize: '300% 300%',
                animation: 'gradient-border 3s ease infinite',
              }}
            >
              <div className="relative rounded-3xl bg-[#0f1629] p-8 text-center">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-3xl"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)',
                  }}
                />

                {/* Animated Checkmark */}
                <motion.div
                  className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))' }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                    />
                  </motion.svg>
                </motion.div>

                {/* Title */}
                <motion.h2
                  className="relative mb-2 text-2xl font-bold text-white"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  Wallet Connected 🎉
                </motion.h2>

                {/* Message */}
                <motion.p
                  className="relative mb-4 text-white/60"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  You are successfully connected
                </motion.p>

                {/* Wallet address */}
                {publicKey && (
                  <motion.div
                    className="relative mx-auto max-w-xs rounded-xl bg-white/5 px-4 py-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <p className="truncate text-sm font-mono text-indigo-300">
                      {publicKey}
                    </p>
                  </motion.div>
                )}

                {/* Particle dots */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-1 w-1 rounded-full bg-indigo-400/60"
                      style={{
                        left: `${20 + i * 12}%`,
                        top: `${30 + (i % 3) * 20}%`,
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                        y: [0, -20, -40],
                      }}
                      transition={{
                        delay: 0.5 + i * 0.1,
                        duration: 1,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Gradient border animation keyframes */}
          <style jsx global>{`
            @keyframes gradient-border {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
