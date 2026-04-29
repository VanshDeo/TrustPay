'use client';

/**
 * Metrics Page — Aggregated platform statistics with animated counters
 * and a recent activity feed from indexed blockchain events.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowLeftRight, Lock, FileCode, Activity, TrendingUp } from 'lucide-react';
import { getMetrics } from '@/lib/api';
import { stroopsToXlm } from '@/lib/stellar';

interface Metrics {
  totalUsers: number;
  totalTransactions: number;
  totalVolumeLocked: number;
  totalVolumeReleased: number;
  activeContracts: number;
}

interface ActivityItem {
  _id: string;
  eventType: string;
  contractId: string;
  createdAt: string;
  data: any;
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display.toLocaleString()}{suffix}</span>;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMetrics();
        if (data.success) {
          setMetrics(data.metrics);
          setActivity(data.recentActivity || []);
        }
      } catch (error) {
        console.error('Error loading metrics:', error);
        // Set defaults for demo
        setMetrics({
          totalUsers: 0,
          totalTransactions: 0,
          totalVolumeLocked: 0,
          totalVolumeReleased: 0,
          activeContracts: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statCards = metrics ? [
    {
      label: 'Total Users',
      value: metrics.totalUsers,
      icon: Users,
      gradient: 'from-blue-500 to-indigo-500',
      suffix: '',
    },
    {
      label: 'Total Transactions',
      value: metrics.totalTransactions,
      icon: ArrowLeftRight,
      gradient: 'from-purple-500 to-pink-500',
      suffix: '',
    },
    {
      label: 'Volume Locked (XLM)',
      value: Math.round(metrics.totalVolumeLocked / 10_000_000),
      icon: Lock,
      gradient: 'from-emerald-500 to-teal-500',
      suffix: ' XLM',
    },
    {
      label: 'Active Contracts',
      value: metrics.activeContracts,
      icon: FileCode,
      gradient: 'from-orange-500 to-amber-500',
      suffix: '',
    },
  ] : [];

  const eventLabel = (type: string) => {
    if (type.includes('created')) return { label: 'Escrow Created', color: 'text-blue-400' };
    if (type.includes('released')) return { label: 'Funds Released', color: 'text-emerald-400' };
    if (type.includes('cancel')) return { label: 'Escrow Cancelled', color: 'text-red-400' };
    if (type.includes('approval') || type.includes('given')) return { label: 'Approval Given', color: 'text-purple-400' };
    if (type.includes('sponsor')) return { label: 'Fee Sponsored', color: 'text-amber-400' };
    return { label: type, color: 'text-white/40' };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-indigo-400" />
            Platform Metrics
          </h1>
          <p className="text-white/40 mt-1">Real-time statistics from the TrustPay protocol</p>
        </div>

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card-static !p-6 shimmer h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {statCards.map((card, i) => (
              <motion.div
                key={i}
                className="glass-card text-center !p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} opacity-80`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">
                  <AnimatedCounter value={card.value} suffix={card.suffix} />
                </p>
                <p className="text-sm text-white/40">{card.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-400" />
            Recent Activity
          </h2>

          {activity.length === 0 ? (
            <div className="glass-card-static text-center !p-8">
              <p className="text-white/40">No activity yet. Events will appear here once contracts are deployed and active.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item, i) => {
                const { label, color } = eventLabel(item.eventType);
                return (
                  <motion.div
                    key={item._id}
                    className="glass-card-static !p-4 flex items-center justify-between"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-indigo-400" />
                      <span className={`text-sm font-medium ${color}`}>{label}</span>
                    </div>
                    <span className="text-xs text-white/30">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
