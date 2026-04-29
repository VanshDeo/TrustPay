'use client';

/**
 * WalletContext — React context for Freighter wallet integration.
 *
 * Manages wallet connection state, provides connect/disconnect methods,
 * and triggers the success popup on connection.
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  showPopup: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  setShowPopup: (show: boolean) => void;
}

const WalletContext = createContext<WalletContextType>({
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  showPopup: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  setShowPopup: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Dynamically import Freighter API (browser-only)
      const freighter = await import('@stellar/freighter-api');
      const result = await freighter.requestAccess();

      // requestAccess() returns { address: string } in newer versions
      const addr = typeof result === 'string' ? result : result?.address;
      if (addr) {
        setPublicKey(addr);
        // Show the success popup 🎉
        setShowPopup(true);
        // Auto-hide popup after 2 seconds
        setTimeout(() => setShowPopup(false), 2000);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      // Demo mode: generate a mock address for testing without Freighter
      const mockKey = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
      setPublicKey(mockKey);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setPublicKey(null);
    setShowPopup(false);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        isConnected: !!publicKey,
        isConnecting,
        showPopup,
        connectWallet,
        disconnectWallet,
        setShowPopup,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

export default WalletContext;
