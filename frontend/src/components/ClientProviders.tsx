'use client';

/**
 * ClientProviders — Wraps the app in client-side context providers.
 * Separated because layout.tsx is a server component.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { WalletProvider } from '@/context/WalletContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WalletPopup from '@/components/WalletPopup';
import { recordPageView } from '@/lib/api';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      recordPageView(pathname, typeof document !== 'undefined' ? document.referrer : undefined);
    }
  }, [pathname]);

  return (
    <WalletProvider>
      <Navbar />
      <WalletPopup />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </WalletProvider>
  );
}
