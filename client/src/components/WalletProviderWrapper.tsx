import { useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { useToast } from '@/hooks/use-toast';
import type { ReactNode } from 'react';
import type { WalletError } from '@solana/wallet-adapter-base';

// Validate and get RPC URL with proper fallback
const envRpcUrl = import.meta.env.VITE_SOLANA_RPC_URL?.trim();
const isValidUrl = envRpcUrl && (envRpcUrl.startsWith('http://') || envRpcUrl.startsWith('https://'));
const SOLANA_RPC_URL = isValidUrl ? envRpcUrl : 'https://api.mainnet-beta.solana.com';

if (!isValidUrl && import.meta.env.VITE_SOLANA_RPC_URL) {
  console.warn('⚠️ Invalid VITE_SOLANA_RPC_URL (must start with http:// or https://). Using fallback: https://api.mainnet-beta.solana.com');
} else if (!envRpcUrl) {
  console.warn('⚠️ VITE_SOLANA_RPC_URL not set. Using public Solana RPC endpoint (rate limited). Set VITE_SOLANA_RPC_URL in deployment secrets for better performance.');
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
