import { storage } from "../storage";

// JCMOVES Token Configuration
export const JCMOVES_CONFIG = {
  TOKEN_ADDRESS: process.env.MOONSHOT_TOKEN_ADDRESS || 'BHZW4jds7NSe5Fqvw9Z4pvt423EJSx63k8MT11F2moon',
  NETWORK: 'solana',
  PLATFORM: 'moonshot',
  // API endpoints
  DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex/tokens',
  BACKUP_API: 'https://api.moonshot.cc/token/v1/solana', // Moonshot API v1
  // Price caching
  PRICE_CACHE_TTL: 30 * 1000, // 30 seconds
  MAX_PRICE_AGE: 5 * 60 * 1000, // 5 minutes max age
  // Volatility management
  MAX_PRICE_CHANGE_PERCENT: 50, // Maximum 50% price change before alerts
  PRICE_SMOOTHING_FACTOR: 0.1, // Exponential moving average factor
} as const;

export interface TokenMarketData {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  fdv: number; // Fully diluted valuation
  timestamp: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
  source: 'dexscreener' | 'moonshot' | 'fallback';
}

export interface TokenBalance {
  tokenAmount: string; // Actual JCMOVES tokens (high precision)
  usdValue: number;    // Current USD value
  priceAtTime: number; // Price when calculated
  timestamp: number;
}

export interface CryptoPortfolio {
  totalTokens: string;      // Total JCMOVES balance
  currentValue: number;     // Current USD value
  totalEarned: string;      // Total tokens earned
  totalValueEarned: number; // USD value of earnings
  priceHistory: PricePoint[];
  lastUpdated: number;
}

class CryptoService {
  private priceCache: Map<string, { price: number; timestamp: number; data: TokenMarketData }> = new Map();
  private priceHistory: PricePoint[] = [];
  private smoothedPrice: number = 0;
  
  /**
   * Get current JCMOVES token price from multiple sources
   */
  async getCurrentPrice(): Promise<{ price: number; source: string; marketData?: TokenMarketData }> {
    const cacheKey = JCMOVES_CONFIG.TOKEN_ADDRESS;
    const cached = this.priceCache.get(cacheKey);
    
    // Return cached price if still fresh
    if (cached && (Date.now() - cached.timestamp) < JCMOVES_CONFIG.PRICE_CACHE_TTL) {
      return { price: cached.price, source: 'cache', marketData: cached.data };
    }
    
    // Try DexScreener API first
    try {
      const dexData = await this.fetchFromDexScreener();
      if (dexData) {
        this.updatePriceCache(dexData);
        this.addToPriceHistory(dexData.priceUsd, 'dexscreener');
        return { price: dexData.priceUsd, source: 'dexscreener', marketData: dexData };
      }
    } catch (error) {
      console.warn('DexScreener API failed:', error);
    }
    
    // Fallback to Moonshot API
    try {
      const moonshotData = await this.fetchFromMoonshot();
      if (moonshotData) {
        this.updatePriceCache(moonshotData);
        this.addToPriceHistory(moonshotData.priceUsd, 'moonshot');
        return { price: moonshotData.priceUsd, source: 'moonshot', marketData: moonshotData };
      }
    } catch (error) {
      console.warn('Moonshot API failed:', error);
    }
    
    // Use cached price if available (even if stale)
    if (cached) {
      console.warn('Using stale cached price for JCMOVES');
      return { price: cached.price, source: 'cache_stale', marketData: cached.data };
    }
    
    // Emergency fallback to fixed price if all APIs fail
    console.error('All price APIs failed, using emergency fallback price');
    const fallbackPrice = 0.000005034116; // Real Moonshot price fallback
    this.addToPriceHistory(fallbackPrice, 'fallback');
    return { price: fallbackPrice, source: 'fallback' };
  }
  
  /**
   * Fetch JCMOVES data from DexScreener API
   */
  private async fetchFromDexScreener(): Promise<TokenMarketData | null> {
    const url = `${JCMOVES_CONFIG.DEXSCREENER_API}/${JCMOVES_CONFIG.TOKEN_ADDRESS}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JC-ON-THE-MOVE/1.0',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // DexScreener returns pairs array
    if (!data.pairs || !data.pairs[0]) {
      return null;
    }
    
    const pair = data.pairs[0];
    return {
      address: JCMOVES_CONFIG.TOKEN_ADDRESS,
      symbol: pair.baseToken?.symbol || 'JCMOVES',
      name: pair.baseToken?.name || 'JCMOVES Token',
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
      volume24h: parseFloat(pair.volume?.h24) || 0,
      marketCap: parseFloat(pair.marketCap) || 0,
      liquidity: parseFloat(pair.liquidity?.usd) || 0,
      fdv: parseFloat(pair.fdv) || 0,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Fetch JCMOVES data from Moonshot API (backup)
   */
  private async fetchFromMoonshot(): Promise<TokenMarketData | null> {
    const url = `${JCMOVES_CONFIG.BACKUP_API}/${JCMOVES_CONFIG.TOKEN_ADDRESS}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JC-ON-THE-MOVE/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      throw new Error(`Moonshot API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      address: JCMOVES_CONFIG.TOKEN_ADDRESS,
      symbol: data.symbol || 'JCMOVES',
      name: data.name || 'JCMOVES Token',
      priceUsd: parseFloat(data.price) || parseFloat(data.priceUsd) || 0,
      priceChange24h: parseFloat(data.priceChange24h) || 0,
      volume24h: parseFloat(data.volume24h) || 0,
      marketCap: parseFloat(data.marketCap) || 0,
      liquidity: parseFloat(data.liquidity) || 0,
      fdv: parseFloat(data.fdv) || 0,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Update price cache with market data
   */
  private updatePriceCache(data: TokenMarketData): void {
    this.priceCache.set(JCMOVES_CONFIG.TOKEN_ADDRESS, {
      price: data.priceUsd,
      timestamp: data.timestamp,
      data,
    });
    
    // Update smoothed price using exponential moving average
    if (this.smoothedPrice === 0) {
      this.smoothedPrice = data.priceUsd;
    } else {
      this.smoothedPrice = (JCMOVES_CONFIG.PRICE_SMOOTHING_FACTOR * data.priceUsd) + 
                          ((1 - JCMOVES_CONFIG.PRICE_SMOOTHING_FACTOR) * this.smoothedPrice);
    }
  }
  
  /**
   * Add price point to history
   */
  private addToPriceHistory(price: number, source: PricePoint['source']): void {
    this.priceHistory.push({
      timestamp: Date.now(),
      price,
      source,
    });
    
    // Keep only last 24 hours of price history
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.priceHistory = this.priceHistory.filter(point => point.timestamp > cutoff);
  }
  
  /**
   * Convert USD amount to JCMOVES tokens at current price
   */
  async usdToTokens(usdAmount: number): Promise<{ tokenAmount: string; price: number; source: string }> {
    const priceData = await this.getCurrentPrice();
    const tokenAmount = (usdAmount / priceData.price).toFixed(8); // 8 decimal precision
    
    return {
      tokenAmount,
      price: priceData.price,
      source: priceData.source,
    };
  }
  
  /**
   * Convert JCMOVES tokens to USD at current price
   */
  async tokensToUsd(tokenAmount: string): Promise<{ usdValue: number; price: number; source: string }> {
    const priceData = await this.getCurrentPrice();
    const usdValue = parseFloat(tokenAmount) * priceData.price;
    
    return {
      usdValue,
      price: priceData.price,
      source: priceData.source,
    };
  }
  
  /**
   * Get comprehensive market data for JCMOVES
   */
  async getMarketData(): Promise<TokenMarketData | null> {
    const priceData = await this.getCurrentPrice();
    return priceData.marketData || null;
  }
  
  /**
   * Get price history for charts and analytics
   */
  getPriceHistory(hours: number = 24): PricePoint[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.priceHistory.filter(point => point.timestamp > cutoff);
  }
  
  /**
   * Check for significant price movements
   */
  async checkPriceVolatility(): Promise<{ 
    isVolatile: boolean; 
    changePercent: number; 
    recommendation: string;
  }> {
    if (this.priceHistory.length < 2) {
      return { isVolatile: false, changePercent: 0, recommendation: 'Insufficient data' };
    }
    
    const current = this.priceHistory[this.priceHistory.length - 1];
    const oneHourAgo = this.priceHistory.find(p => 
      p.timestamp <= (Date.now() - 60 * 60 * 1000)
    ) || this.priceHistory[0];
    
    const changePercent = ((current.price - oneHourAgo.price) / oneHourAgo.price) * 100;
    const isVolatile = Math.abs(changePercent) > JCMOVES_CONFIG.MAX_PRICE_CHANGE_PERCENT;
    
    let recommendation = 'Price stable';
    if (isVolatile) {
      if (changePercent > 0) {
        recommendation = 'High upward volatility - consider reducing reward distributions';
      } else {
        recommendation = 'High downward volatility - consider increasing treasury reserves';
      }
    }
    
    return { isVolatile, changePercent, recommendation };
  }
  
  /**
   * Get smoothed price for stable calculations
   */
  getSmoothedPrice(): number {
    return this.smoothedPrice || 0.001; // Fallback to $0.001
  }
  
  /**
   * Calculate token balance with current market value
   */
  async calculatePortfolio(tokenAmount: string): Promise<TokenBalance> {
    const tokens = parseFloat(tokenAmount);
    const priceData = await this.getCurrentPrice();
    
    return {
      tokenAmount,
      usdValue: tokens * priceData.price,
      priceAtTime: priceData.price,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const cryptoService = new CryptoService();