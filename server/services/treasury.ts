import { storage } from "../storage";
import type { TreasuryAccount, FundingDeposit, ReserveTransaction, InsertFundingDeposit } from "@shared/schema";
import { TREASURY_CONFIG } from "../constants";
import { cryptoService, type TokenMarketData, type TokenBalance } from "./crypto";

export interface TreasuryStats {
  totalFunding: number;
  totalDistributed: number;
  availableFunding: number;
  tokenReserve: number;
  liabilityRatio: number; // Percentage of funds distributed vs total funding
  isHealthy: boolean; // Whether the treasury has sufficient funds
}

export interface FundingStatus {
  canDistributeRewards: boolean;
  currentBalance: number;
  minimumBalance: number; // Safety threshold
  warningThreshold: number; // When to warn about low funds
}

export interface TokenDistributionResult {
  success: boolean;
  tokensDistributed: number;
  cashValue: number;
  remainingBalance: number;
  transactionId: string;
  error?: string;
}

export class TreasuryService {
  // Use centralized constants (removed TOKEN_PRICE - now dynamic)
  private static readonly MINIMUM_BALANCE = TREASURY_CONFIG.MINIMUM_BALANCE;
  private static readonly WARNING_THRESHOLD = TREASURY_CONFIG.WARNING_THRESHOLD;
  private static readonly CRITICAL_THRESHOLD = TREASURY_CONFIG.CRITICAL_THRESHOLD;

  /**
   * Get current JCMOVES token price
   */
  async getCurrentTokenPrice(): Promise<{ price: number; source: string; marketData?: TokenMarketData }> {
    return await cryptoService.getCurrentPrice();
  }

  /**
   * Get comprehensive market data for JCMOVES
   */
  async getMarketData(): Promise<TokenMarketData | null> {
    return await cryptoService.getMarketData();
  }

  /**
   * Check for price volatility and get recommendations
   */
  async checkVolatility(): Promise<{
    isVolatile: boolean;
    changePercent: number;
    recommendation: string;
  }> {
    return await cryptoService.checkPriceVolatility();
  }

  /**
   * Convert USD amount to JCMOVES tokens at current price
   */
  async convertUsdToTokens(usdAmount: number): Promise<{
    tokenAmount: string;
    price: number;
    source: string;
  }> {
    return await cryptoService.usdToTokens(usdAmount);
  }

  /**
   * Convert JCMOVES tokens to USD at current price
   */
  async convertTokensToUsd(tokenAmount: string): Promise<{
    usdValue: number;
    price: number;
    source: string;
  }> {
    return await cryptoService.tokensToUsd(tokenAmount);
  }

  /**
   * Get comprehensive treasury statistics with real-time crypto data
   */
  async getTreasuryStats(): Promise<TreasuryStats> {
    const treasury = await storage.getMainTreasuryAccount();
    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const availableFunding = parseFloat(treasury.availableFunding);
    const tokenReserve = parseFloat(treasury.tokenReserve);

    const liabilityRatio = totalFunding > 0 ? (totalDistributed / totalFunding) * 100 : 0;
    const isHealthy = availableFunding >= TreasuryService.MINIMUM_BALANCE;

    return {
      totalFunding,
      totalDistributed,
      availableFunding,
      tokenReserve,
      liabilityRatio,
      isHealthy
    };
  }

  /**
   * Check current funding status and distribution capability
   */
  async getFundingStatus(): Promise<FundingStatus> {
    const treasury = await storage.getMainTreasuryAccount();
    const currentBalance = parseFloat(treasury.availableFunding);

    return {
      canDistributeRewards: currentBalance >= TreasuryService.MINIMUM_BALANCE,
      currentBalance,
      minimumBalance: TreasuryService.MINIMUM_BALANCE,
      warningThreshold: TreasuryService.WARNING_THRESHOLD
    };
  }

  /**
   * Check if specific token amount can be distributed using real-time crypto pricing
   */
  async canDistributeTokens(tokenAmount: number): Promise<{ canDistribute: boolean; reason?: string; currentPrice?: number }> {
    // Get current JCMOVES price
    const priceData = await this.getCurrentTokenPrice();
    const currentPrice = priceData.price;
    const requiredUsdValue = tokenAmount * currentPrice;
    
    // Check current treasury balance
    const treasury = await storage.getMainTreasuryAccount();
    const availableBalance = parseFloat(treasury.availableFunding);
    
    if (availableBalance < requiredUsdValue) {
      return {
        canDistribute: false,
        reason: `Insufficient funding. Required: $${requiredUsdValue.toFixed(2)} (${tokenAmount.toLocaleString()} JCMOVES @ $${currentPrice.toFixed(6)}), Available: $${availableBalance.toFixed(2)}`,
        currentPrice
      };
    }

    // Check if distribution would leave us below minimum balance
    const remainingBalance = availableBalance - requiredUsdValue;
    if (remainingBalance < TreasuryService.MINIMUM_BALANCE) {
      return {
        canDistribute: false,
        reason: `Distribution would leave balance below minimum threshold ($${TreasuryService.MINIMUM_BALANCE}). Remaining would be: $${remainingBalance.toFixed(2)}`,
        currentPrice
      };
    }

    return { canDistribute: true, currentPrice };
  }

  /**
   * Safely distribute JCMOVES tokens with real-time pricing and comprehensive checks
   */
  async distributeTokens(
    tokenAmount: number, 
    description: string, 
    relatedEntityType?: string, 
    relatedEntityId?: string
  ): Promise<TokenDistributionResult> {
    try {
      // Pre-distribution checks with real-time pricing
      const canDistribute = await this.canDistributeTokens(tokenAmount);
      if (!canDistribute.canDistribute) {
        return {
          success: false,
          tokensDistributed: 0,
          cashValue: 0,
          remainingBalance: 0,
          transactionId: "",
          error: canDistribute.reason
        };
      }

      // Calculate cash value using real-time JCMOVES price
      const currentPrice = canDistribute.currentPrice || 0;
      const cashValue = tokenAmount * currentPrice;

      // Execute the distribution with crypto pricing
      const transaction = await storage.deductFromReserve(
        tokenAmount,
        description,
        currentPrice, // Pass the real-time JCMOVES price
        relatedEntityType,
        relatedEntityId
      );

      return {
        success: true,
        tokensDistributed: tokenAmount,
        cashValue: parseFloat(transaction.cashValue),
        remainingBalance: parseFloat(transaction.balanceAfter),
        transactionId: transaction.id
      };
    } catch (error) {
      console.error(`Treasury distribution error:`, error);
      return {
        success: false,
        tokensDistributed: 0,
        cashValue: 0,
        remainingBalance: 0,
        transactionId: "",
        error: error instanceof Error ? error.message : "Unknown distribution error"
      };
    }
  }

  /**
   * Add funds to the treasury (business owner deposit)
   */
  async depositFunds(
    depositedBy: string,
    usdAmount: number,
    depositMethod: string = 'manual',
    notes?: string
  ): Promise<{ success: boolean; deposit?: FundingDeposit; error?: string }> {
    try {
      // Use the atomic deposit method from storage layer
      const deposit = await storage.atomicDepositFunds(
        depositedBy,
        usdAmount,
        depositMethod,
        notes
      );

      return { success: true, deposit };
    } catch (error) {
      console.error(`Treasury deposit error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown deposit error"
      };
    }
  }

  /**
   * Get recent treasury transactions
   */
  async getRecentTransactions(limit: number = 50): Promise<ReserveTransaction[]> {
    return await storage.getReserveTransactions(undefined, limit);
  }

  /**
   * Get all funding deposits
   */
  async getFundingHistory(): Promise<FundingDeposit[]> {
    return await storage.getFundingDeposits();
  }

  /**
   * Check treasury health and get warnings
   */
  async getHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
  }> {
    const stats = await this.getTreasuryStats();
    
    if (stats.availableFunding < TreasuryService.MINIMUM_BALANCE) {
      return {
        status: 'critical',
        message: `Treasury balance critically low: $${stats.availableFunding.toFixed(2)}`,
        recommendations: [
          "Deposit funds immediately to continue reward distributions",
          "Consider temporarily disabling signup bonuses to preserve funds",
          "Review and optimize reward amounts if necessary"
        ]
      };
    }
    
    if (stats.availableFunding < TreasuryService.WARNING_THRESHOLD) {
      return {
        status: 'warning',
        message: `Treasury balance is low: $${stats.availableFunding.toFixed(2)}`,
        recommendations: [
          "Plan to deposit additional funds soon",
          "Monitor daily distribution rates closely",
          "Consider adjusting reward amounts if needed"
        ]
      };
    }

    return {
      status: 'healthy',
      message: `Treasury is well-funded: $${stats.availableFunding.toFixed(2)} available`,
      recommendations: [
        "Continue monitoring treasury balance regularly",
        "Maintain funding levels based on business growth"
      ]
    };
  }

  /**
   * Calculate estimated days of funding remaining
   */
  async getEstimatedFundingDays(): Promise<{
    estimatedDays: number;
    basedOnDailyAverage: number;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const stats = await this.getTreasuryStats();
    const recentTransactions = await storage.getReserveTransactions(undefined, 30); // Last 30 transactions
    
    // Calculate daily average distribution over last 30 days
    const distributionTransactions = recentTransactions.filter(t => t.transactionType === 'distribution');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentDistributions = distributionTransactions.filter(
      t => new Date(t.createdAt) >= thirtyDaysAgo
    );
    
    let dailyAverage = 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    
    if (recentDistributions.length > 0) {
      const totalDistributed = recentDistributions.reduce((sum, t) => sum + parseFloat(t.cashValue), 0);
      const daysWithActivity = Math.max(1, recentDistributions.length / 2); // Rough estimate
      dailyAverage = totalDistributed / Math.min(30, daysWithActivity);
      
      confidence = recentDistributions.length > 10 ? 'high' : 
                  recentDistributions.length > 5 ? 'medium' : 'low';
    }
    
    const estimatedDays = dailyAverage > 0 ? stats.availableFunding / dailyAverage : Infinity;
    
    return {
      estimatedDays: Math.floor(estimatedDays),
      basedOnDailyAverage: dailyAverage,
      confidence
    };
  }
}

export const treasuryService = new TreasuryService();