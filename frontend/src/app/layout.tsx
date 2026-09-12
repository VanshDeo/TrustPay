import type { Metadata, Viewport } from 'next';
import './globals.css';
import ClientProviders from '@/components/ClientProviders';
import NotificationBanner from '@/components/NotificationBanner';

export const metadata: Metadata = {
  title: 'TrustPay — Conditional Smart Payments on Stellar',
  description: 'Decentralized escrow-based payments powered by Soroban smart contracts on the Stellar blockchain. Create, approve, and release payments trustlessly.',
  keywords: ['stellar', 'soroban', 'escrow', 'payments', 'blockchain', 'defi'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <NotificationBanner />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
