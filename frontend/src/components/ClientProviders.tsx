'use client';

/**
 * ClientProviders — Wraps the app in client-side context providers.
 * Separated because layout.tsx is a server component.
 */
import { WalletProvider } from '@/context/WalletContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WalletPopup from '@/components/WalletPopup';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <Navbar />
      <WalletPopup />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </WalletProvider>
  );
}
