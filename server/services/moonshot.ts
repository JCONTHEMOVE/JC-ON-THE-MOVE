// Moonshot DEX API integration for token data and pricing
import axios from 'axios';

const MOONSHOT_API_BASE = 'https://api.moonshot.cc';

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
      // Return fallback price if API fails
      return 0.001; // $0.001 per token as fallback
    }
  }

  async getTokenData(): Promise<TokenData | null> {
    try {
      if (!this.tokenAddress) {
        throw new Error('Moonshot token address not configured');
      }

      const response = await axios.get<TokenData>(
        `${MOONSHOT_API_BASE}/token/v1/solana/${this.tokenAddress}`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching Moonshot token data:', error);
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
}

export const moonshotService = new MoonshotService();