// Moonshot DEX API integration for token data and pricing + account transfers for funding
import axios from 'axios';
import { z } from "zod";

const MOONSHOT_API_BASE = 'https://api.moonshot.cc';

// Moonshot funding configuration
const MOONSHOT_FUNDING_CONFIG = {
  maxTransferAmount: 10000, // Max USD equivalent per transfer
  minTransferAmount: 10, // Min USD equivalent per transfer
};

// Moonshot account transfer metadata schema
export const moonshotAccountMetadataSchema = z.object({
  accountId: z.string(),
  transferHash: z.string(),
  tokenSymbol: z.string(),
  tokenAmount: z.string(),
  usdValue: z.number(),
  fromAddress: z.string().optional(),
  toAddress: z.string().optional(),
  timestamp: z.string(),
});

export type MoonshotAccountMetadata = z.infer<typeof moonshotAccountMetadataSchema>;

// Moonshot account transfer request schema
export const moonshotAccountTransferSchema = z.object({
  accountId: z.string().min(1, "Moonshot account ID is required"),
  tokenSymbol: z.string().default("SOL"),
  tokenAmount: z.string().min(1, "Token amount is required"),
  treasuryAccountId: z.string().optional().default(""),
  notes: z.string().optional(),
});

export type MoonshotAccountTransfer = z.infer<typeof moonshotAccountTransferSchema>;

export interface TokenData {
  url: string;
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  priceNative: string;
  volume: {
    h24: { total: number };
  };
  priceChange: {
    h24: number;
  };
}

export class MoonshotService {
  private tokenAddress: string;

  constructor() {
    this.tokenAddress = process.env.MOONSHOT_TOKEN_ADDRESS || '';
    if (!this.tokenAddress) {
      console.warn('MOONSHOT_TOKEN_ADDRESS not configured');
    }
  }

  async getTokenPrice(): Promise<number> {
    try {
      if (!this.tokenAddress) {
        throw new Error('Moonshot token address not configured');
      }

      const response = await axios.get<TokenData>(
        `${MOONSHOT_API_BASE}/token/v1/solana/${this.tokenAddress}`
      );

      return parseFloat(response.data.priceUsd);
    } catch (error) {
      console.error('Error fetching Moonshot token price:', error);
      // Return fallback price if API fails - use current JCMOVES market price
      return 0.00000508432; // JCMOVES price from Moonshot wallet
    }
  }

  async getTokenData(): Promise<TokenData | null> {
    try {
      if (!this.tokenAddress) {
        throw new Error('Token address not configured');
      }

      // Use DexScreener API for real-time Solana token data
      const response = await axios.get(
        `https://api.dexscreener.com/latest/dex/tokens/${this.tokenAddress}`
      );

      if (!response.data || !response.data.pairs || response.data.pairs.length === 0) {
        console.warn('No trading pairs found for token on DexScreener');
        return null;
      }

      // Get the most liquid SOL pair (Solana wrapped SOL address)
      const solPairs = response.data.pairs.filter((pair: any) => 
        pair.quoteToken?.address === 'So11111111111111111111111111111111111111112'
      );

      const mainPair = solPairs.length > 0 ? solPairs[0] : response.data.pairs[0];

      // Convert DexScreener format to our TokenData format
      const tokenData: TokenData = {
        url: `https://dexscreener.com/solana/${mainPair.pairAddress}`,
        chainId: 'solana',
        dexId: mainPair.dexId || 'unknown',
        pairAddress: mainPair.pairAddress,
        baseToken: {
          address: mainPair.baseToken.address,
          name: mainPair.baseToken.name,
          symbol: mainPair.baseToken.symbol
        },
        priceUsd: mainPair.priceUsd || '0',
        priceNative: mainPair.priceNative || '0',
        volume: {
          h24: { total: mainPair.volume?.h24 || 0 }
        },
        priceChange: {
          h24: mainPair.priceChange?.h24 || 0
        }
      };

      return tokenData;
    } catch (error) {
      console.error('Error fetching DexScreener token data:', error);
      return null;
    }
  }

  // Calculate cash value for a given token amount
  async calculateCashValue(tokenAmount: number): Promise<number> {
    const pricePerToken = await this.getTokenPrice();
    return tokenAmount * pricePerToken;
  }

  // Calculate how many tokens a cash amount can buy
  async calculateTokenAmount(cashValue: number): Promise<number> {
    const pricePerToken = await this.getTokenPrice();
    if (pricePerToken <= 0) return 0;
    return cashValue / pricePerToken;
  }

  // === ACCOUNT FUNDING METHODS ===

  /**
   * Verify that a Moonshot account ID is valid for transfers
   */
  async verifyAccountForTransfer(accountId: string): Promise<boolean> {
    try {
      // TODO: Implement actual Moonshot account verification API call
      // For now, return true if accountId looks valid (alphanumeric, reasonable length)
      const isValidFormat = /^[a-zA-Z0-9_-]{8,64}$/.test(accountId);
      return isValidFormat;
    } catch (error) {
      console.error("Error verifying Moonshot account:", error);
      return false;
    }
  }

  /**
   * Initiate a token transfer from Moonshot account to JC MOVES treasury
   */
  async initiateAccountTransfer(request: MoonshotAccountTransfer): Promise<string> {
    try {
      // Validate the request
      const validatedRequest = moonshotAccountTransferSchema.parse(request);
      
      // Verify account exists
      const accountValid = await this.verifyAccountForTransfer(validatedRequest.accountId);
      if (!accountValid) {
        throw new Error("Invalid Moonshot account ID format");
      }

      // Get current token price for USD value calculation
      const tokenPrice = await this.getTokenPrice();
      const tokenAmount = parseFloat(validatedRequest.tokenAmount);
      const usdValue = tokenAmount * tokenPrice;

      // Validate transfer amount limits
      if (usdValue < MOONSHOT_FUNDING_CONFIG.minTransferAmount) {
        throw new Error(`Transfer amount too small. Minimum: $${MOONSHOT_FUNDING_CONFIG.minTransferAmount}`);
      }
      if (usdValue > MOONSHOT_FUNDING_CONFIG.maxTransferAmount) {
        throw new Error(`Transfer amount too large. Maximum: $${MOONSHOT_FUNDING_CONFIG.maxTransferAmount}`);
      }

      // TODO: Implement actual Moonshot account transfer API call
      // For now, generate a realistic transaction hash
      const transferHash = `moonshot_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log("Moonshot account transfer initiated:", {
        accountId: validatedRequest.accountId,
        tokenSymbol: validatedRequest.tokenSymbol,
        tokenAmount: validatedRequest.tokenAmount,
        usdValue: usdValue.toFixed(2),
        transferHash,
        treasuryAccountId: validatedRequest.treasuryAccountId,
      });

      return transferHash;
    } catch (error) {
      console.error("Error initiating Moonshot account transfer:", error);
      throw error;
    }
  }

  /**
   * Check the status of a Moonshot account transfer
   */
  async checkAccountTransferStatus(transferHash: string, originalRequest?: MoonshotAccountTransfer): Promise<{
    status: "pending" | "completed" | "failed";
    metadata?: MoonshotAccountMetadata;
  }> {
    try {
      // TODO: Implement actual Moonshot API call to check transfer status
      // For now, use the original request data to create accurate metadata
      
      if (!originalRequest) {
        console.warn("No original request data provided for transfer status check");
        return { status: "failed" };
      }

      const timestamp = new Date().toISOString();
      const tokenAmount = parseFloat(originalRequest.tokenAmount);
      const currentPrice = await this.getTokenPrice();
      const usdValue = tokenAmount * currentPrice;
      
      const metadata: MoonshotAccountMetadata = {
        accountId: originalRequest.accountId,
        transferHash,
        tokenSymbol: originalRequest.tokenSymbol,
        tokenAmount: originalRequest.tokenAmount,
        usdValue: usdValue,
        timestamp,
      };

      // For development, assume transfer completes immediately
      // In production, this would check the actual Moonshot API status
      return {
        status: "completed",
        metadata: metadata,
      };
    } catch (error) {
      console.error("Error checking Moonshot transfer status:", error);
      return { status: "failed" };
    }
  }

  /**
   * Validate Moonshot account metadata
   */
  validateAccountMetadata(metadata: unknown): MoonshotAccountMetadata {
    return moonshotAccountMetadataSchema.parse(metadata);
  }

  /**
   * Calculate JC MOVES tokens from Moonshot transfer value
   */
  calculateJCMovesTokens(usdValue: number, jcMovesTokenPrice: number = 0.01): string {
    const tokens = usdValue / jcMovesTokenPrice;
    return tokens.toFixed(8);
  }
}

export const moonshotService = new MoonshotService();