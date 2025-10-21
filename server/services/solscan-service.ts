/**
 * Solscan.io API Integration Service
 * Provides detailed transaction history and verification for Solana wallets
 * API Docs: https://public-api.solscan.io/docs/
 */

interface SolscanTransaction {
  signature: string;
  blockTime: number;
  slot: number;
  fee: number;
  status: string;
  lamport: number;
  signer: string[];
  parsedInstruction?: any[];
}

interface SolscanTokenTransfer {
  signature: string;
  blockTime: number;
  from: string;
  to: string;
  amount: number;
  decimals: number;
  tokenAddress: string;
  symbol: string;
  type: 'in' | 'out';
}

interface SolscanAccountInfo {
  lamports: number;
  tokenAccounts: {
    tokenAddress: string;
    tokenAmount: {
      amount: string;
      decimals: number;
      uiAmount: number;
    };
    tokenAccount: string;
  }[];
}

export class SolscanService {
  private baseUrl = 'https://public-api.solscan.io';
  private treasuryAddress: string;
  private jcmovesTokenAddress: string;

  constructor(treasuryAddress: string, jcmovesTokenAddress: string) {
    this.treasuryAddress = treasuryAddress;
    this.jcmovesTokenAddress = jcmovesTokenAddress;
  }

  /**
   * Get account information including token balances
   */
  async getAccountInfo(): Promise<{
    success: boolean;
    data?: SolscanAccountInfo;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/account/${this.treasuryAddress}`
      );

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        data: data as SolscanAccountInfo
      };
    } catch (error) {
      console.error('Error fetching account info from Solscan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transaction history for the treasury wallet
   */
  async getTransactionHistory(limit: number = 50): Promise<{
    success: boolean;
    transactions?: SolscanTransaction[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/account/transactions?account=${this.treasuryAddress}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        transactions: data as SolscanTransaction[]
      };
    } catch (error) {
      console.error('Error fetching transaction history from Solscan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get token transfer history (in and out)
   */
  async getTokenTransfers(limit: number = 50): Promise<{
    success: boolean;
    transfers?: SolscanTokenTransfer[];
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/account/token/txs?account=${this.treasuryAddress}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`);
      }

      const data = await response.json();

      // Filter for JCMOVES token only
      const jcmovesTransfers = data.filter((tx: any) => 
        tx.tokenAddress === this.jcmovesTokenAddress
      );

      return {
        success: true,
        transfers: jcmovesTransfers as SolscanTokenTransfer[]
      };
    } catch (error) {
      console.error('Error fetching token transfers from Solscan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get detailed transaction information
   */
  async getTransactionDetails(signature: string): Promise<{
    success: boolean;
    transaction?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/${signature}`
      );

      if (!response.ok) {
        throw new Error(`Solscan API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        transaction: data
      };
    } catch (error) {
      console.error('Error fetching transaction details from Solscan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get JCMOVES token balance from Solscan
   */
  async getJCMOVESBalance(): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
  }> {
    try {
      const accountInfo = await this.getAccountInfo();

      if (!accountInfo.success || !accountInfo.data) {
        return {
          success: false,
          error: accountInfo.error || 'Failed to fetch account info'
        };
      }

      // Find JCMOVES token account
      const jcmovesAccount = accountInfo.data.tokenAccounts.find(
        acc => acc.tokenAddress === this.jcmovesTokenAddress
      );

      if (!jcmovesAccount) {
        return {
          success: true,
          balance: 0
        };
      }

      return {
        success: true,
        balance: jcmovesAccount.tokenAmount.uiAmount
      };
    } catch (error) {
      console.error('Error fetching JCMOVES balance from Solscan:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify a transaction exists on-chain
   */
  async verifyTransaction(signature: string): Promise<{
    success: boolean;
    verified: boolean;
    details?: any;
    error?: string;
  }> {
    try {
      const result = await this.getTransactionDetails(signature);

      if (!result.success) {
        return {
          success: false,
          verified: false,
          error: result.error
        };
      }

      return {
        success: true,
        verified: true,
        details: result.transaction
      };
    } catch (error) {
      console.error('Error verifying transaction:', error);
      return {
        success: false,
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get incoming JCMOVES deposits
   */
  async getIncomingDeposits(limit: number = 50): Promise<{
    success: boolean;
    deposits?: Array<{
      signature: string;
      amount: number;
      from: string;
      timestamp: number;
      verified: boolean;
    }>;
    error?: string;
  }> {
    try {
      const result = await this.getTokenTransfers(limit);

      if (!result.success || !result.transfers) {
        return {
          success: false,
          error: result.error || 'Failed to fetch transfers'
        };
      }

      // Filter for incoming transfers only
      const deposits = result.transfers
        .filter(tx => tx.type === 'in' && tx.to === this.treasuryAddress)
        .map(tx => ({
          signature: tx.signature,
          amount: tx.amount,
          from: tx.from,
          timestamp: tx.blockTime,
          verified: true // Solscan data is verified on-chain
        }));

      return {
        success: true,
        deposits
      };
    } catch (error) {
      console.error('Error fetching incoming deposits:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get outgoing JCMOVES withdrawals
   */
  async getOutgoingWithdrawals(limit: number = 50): Promise<{
    success: boolean;
    withdrawals?: Array<{
      signature: string;
      amount: number;
      to: string;
      timestamp: number;
      verified: boolean;
    }>;
    error?: string;
  }> {
    try {
      const result = await this.getTokenTransfers(limit);

      if (!result.success || !result.transfers) {
        return {
          success: false,
          error: result.error || 'Failed to fetch transfers'
        };
      }

      // Filter for outgoing transfers only
      const withdrawals = result.transfers
        .filter(tx => tx.type === 'out' && tx.from === this.treasuryAddress)
        .map(tx => ({
          signature: tx.signature,
          amount: tx.amount,
          to: tx.to,
          timestamp: tx.blockTime,
          verified: true
        }));

      return {
        success: true,
        withdrawals
      };
    } catch (error) {
      console.error('Error fetching outgoing withdrawals:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default SolscanService;
