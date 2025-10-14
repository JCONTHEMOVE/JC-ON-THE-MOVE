import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import type { ReactNode } from 'react';
import type { WalletError } from '@solana/wallet-adapter-base';

const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL;

if (!SOLANA_RPC_URL) {
  throw new Error('VITE_SOLANA_RPC_URL environment variable is required for Solana blockchain integration');
}

export function WalletProviderWrapper({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const wallets = useMemo(() => [], []);

  const onError = (error: WalletError) => {
    console.error('Wallet error:', error);
    toast({
      title: "Wallet Error",
      description: error.message || "An error occurred with your wallet connection",
      variant: "destructive",
    });
  };

  return (
    <ConnectionProvider 
      endpoint={SOLANA_RPC_URL}
      config={{
        commitment: 'confirmed',
      }}
    >
      <WalletProvider wallets={wallets} onError={onError} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
