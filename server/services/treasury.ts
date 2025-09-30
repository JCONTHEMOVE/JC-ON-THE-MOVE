import { storage } from "../storage";
import type { TreasuryAccount, FundingDeposit, ReserveTransaction, InsertFundingDeposit } from "@shared/schema";
import { TREASURY_CONFIG } from "../constants";
import { cryptoService, type TokenMarketData, type TokenBalance } from "./crypto";

export interface TreasuryStats {
  totalFunding: number;
  totalDistributed: number;
  availableFunding: number; // Historical USD book value
  tokenReserve: number;
  currentMarketValueUsd: number; // Real-time USD value of token reserve
  currentTokenPrice: number; // Current JCMOVES price
  priceSource: string; // Source of price data
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
    const tokenReserve = parseFloat(treasury.tokenReserve);
    
    // Calculate actual available funding (not the historical book value stored in DB)
    const actualAvailableFunding = totalFunding - totalDistributed;

    // Get current market price to calculate real-time value
    const priceData = await this.getCurrentTokenPrice();
    const currentMarketValueUsd = tokenReserve * priceData.price;

    const liabilityRatio = totalFunding > 0 ? (totalDistributed / totalFunding) * 100 : 0;
    const isHealthy = actualAvailableFunding >= TreasuryService.MINIMUM_BALANCE;

    return {
      totalFunding,
      totalDistributed,
      availableFunding: actualAvailableFunding, // Calculated available funding
      tokenReserve,
      currentMarketValueUsd, // Real-time market value
      currentTokenPrice: priceData.price,
      priceSource: priceData.source,
      liabilityRatio,
      isHealthy
    };
  }

  /**
   * Check current funding status and distribution capability
   */
  async getFundingStatus(): Promise<FundingStatus> {
    const treasury = await storage.getMainTreasuryAccount();
    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const currentBalance = totalFunding - totalDistributed;

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
    
    // Check current treasury balance - calculate from totalFunding - totalDistributed
    const treasury = await storage.getMainTreasuryAccount();
    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const availableBalance = totalFunding - totalDistributed;
    
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
      // CRITICAL: Advanced risk assessment with circuit breaker checks
      const riskAssessment = await this.getAdvancedRiskAssessment();
      
      // Halt distributions if extreme volatility detected
      if (riskAssessment.shouldHaltDistributions) {
        return {
          success: false,
          tokensDistributed: 0,
          cashValue: 0,
          remainingBalance: 0,
          transactionId: "",
          error: `Distribution halted due to market conditions: ${riskAssessment.reasons.join('; ')}`
        };
      }
      
      // Enforce safe distribution limits based on volatility
      if (tokenAmount > riskAssessment.maxSafeDistribution.tokens) {
        return {
          success: false,
          tokensDistributed: 0,
          cashValue: 0,
          remainingBalance: 0,
          transactionId: "",
          error: `Distribution amount (${tokenAmount.toLocaleString()} tokens) exceeds safe limit (${riskAssessment.maxSafeDistribution.tokens.toLocaleString()} tokens) due to ${riskAssessment.riskLevel} volatility. ${riskAssessment.recommendations.join(' ')}`
        };
      }

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
   * Deposit JCMOVES tokens directly from Moonshot app
   */
  async depositTokensFromMoonshot(
    depositedBy: string,
    tokenAmount: number,
    transactionHash: string,
    moonshotAccountId?: string,
    notes?: string
  ): Promise<{ success: boolean; deposit?: FundingDeposit; error?: string }> {
    try {
      // Get current token price for USD value calculation
      const priceData = await this.getCurrentTokenPrice();
      const currentPrice = priceData.price;
      const usdValue = tokenAmount * currentPrice;

      // Create deposit record with Moonshot metadata
      const deposit = await storage.createFundingDeposit({
        treasuryAccountId: (await storage.getMainTreasuryAccount()).id,
        depositedBy,
        depositAmount: usdValue.toFixed(2),
        tokensPurchased: tokenAmount.toFixed(8),
        tokenPrice: currentPrice.toFixed(8),
        depositMethod: 'moonshot',
        status: 'completed',
        externalTransactionId: transactionHash,
        moonshotMetadata: {
          accountId: moonshotAccountId,
          transferHash: transactionHash,
          tokenSymbol: 'JCMOVES',
          priceSource: priceData.source,
          depositTimestamp: new Date().toISOString()
        },
        notes: notes || `Token deposit from Moonshot app`
      });

      // Update treasury balances
      await storage.addToReserve(
        tokenAmount,
        usdValue,
        `Moonshot token deposit: ${tokenAmount.toLocaleString()} JCMOVES @ $${currentPrice.toFixed(6)}`
      );

      return { success: true, deposit };
    } catch (error) {
      console.error(`Moonshot token deposit error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token deposit failed"
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

  // ====================== CRYPTO PORTFOLIO MANAGEMENT ======================

  /**
   * Get comprehensive crypto portfolio performance metrics
   */
  async getCryptoPortfolioPerformance(): Promise<{
    currentValue: { usd: number; tokens: number };
    performance: { 
      daily: { change: number; percentage: number }; 
      weekly: { change: number; percentage: number };
      allTime: { change: number; percentage: number };
    };
    marketMetrics: {
      volatility: number;
      marketCap?: string;
      volume24h?: string;
      priceChange24h?: number;
    };
    riskAssessment: 'low' | 'medium' | 'high' | 'extreme';
  }> {
    const treasury = await storage.getMainTreasuryAccount();
    const currentPrice = await this.getCurrentTokenPrice();
    const marketData = await this.getMarketData();
    const volatility = await this.checkVolatility();
    
    const tokenBalance = parseFloat(treasury.tokenReserve);
    const currentUsdValue = tokenBalance * currentPrice.price;
    
    // Calculate performance metrics (simplified - would need historical data for accurate calculation)
    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const initialValue = totalFunding - totalDistributed; // Approximate initial portfolio value
    
    const allTimeChange = currentUsdValue - initialValue;
    const allTimePercentage = initialValue > 0 ? (allTimeChange / initialValue) * 100 : 0;
    
    // Assess risk level based on volatility and market conditions
    let riskAssessment: 'low' | 'medium' | 'high' | 'extreme' = 'medium';
    if (Math.abs(volatility.changePercent) > 20) riskAssessment = 'extreme';
    else if (Math.abs(volatility.changePercent) > 10) riskAssessment = 'high';
    else if (Math.abs(volatility.changePercent) > 5) riskAssessment = 'medium';
    else riskAssessment = 'low';
    
    return {
      currentValue: {
        usd: currentUsdValue,
        tokens: tokenBalance
      },
      performance: {
        daily: { 
          change: volatility.changePercent * currentUsdValue / 100, 
          percentage: volatility.changePercent 
        },
        weekly: { 
          change: volatility.changePercent * currentUsdValue / 100 * 7, // Approximation
          percentage: volatility.changePercent * 7 
        },
        allTime: { 
          change: allTimeChange, 
          percentage: allTimePercentage 
        }
      },
      marketMetrics: {
        volatility: Math.abs(volatility.changePercent),
        marketCap: marketData?.marketCap?.toString(),
        volume24h: marketData?.volume24h?.toString(),
        priceChange24h: marketData?.priceChange24h
      },
      riskAssessment
    };
  }

  /**
   * Advanced risk management with dynamic volatility protection
   */
  async getAdvancedRiskAssessment(): Promise<{
    shouldHaltDistributions: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    reasons: string[];
    recommendations: string[];
    maxSafeDistribution: { tokens: number; usd: number };
  }> {
    const volatility = await this.checkVolatility();
    const portfolio = await this.getCryptoPortfolioPerformance();
    const stats = await this.getTreasuryStats();
    
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let shouldHalt = false;
    let maxSafeTokens = 0;
    
    // Extreme volatility check (>20% price change)
    if (Math.abs(volatility.changePercent) > 20) {
      shouldHalt = true;
      reasons.push(`Extreme price volatility detected: ${volatility.changePercent.toFixed(2)}%`);
      recommendations.push("Halt all distributions until market stabilizes");
      recommendations.push("Monitor price movements every 30 minutes");
    }
    // High volatility check (>10% price change)
    else if (Math.abs(volatility.changePercent) > 10) {
      reasons.push(`High price volatility: ${volatility.changePercent.toFixed(2)}%`);
      recommendations.push("Reduce distribution amounts by 50%");
      recommendations.push("Increase monitoring frequency");
      maxSafeTokens = stats.tokenReserve * 0.5; // Only 50% of normal distributions
    }
    // Medium volatility check (>5% price change)
    else if (Math.abs(volatility.changePercent) > 5) {
      reasons.push(`Medium price volatility: ${volatility.changePercent.toFixed(2)}%`);
      recommendations.push("Reduce distribution amounts by 25%");
      recommendations.push("Monitor market conditions closely");
      maxSafeTokens = stats.tokenReserve * 0.75; // 75% of normal distributions
    }
    else {
      maxSafeTokens = stats.tokenReserve; // Full distributions allowed
      recommendations.push("Market conditions stable - normal operations can continue");
    }
    
    // Treasury health check
    if (stats.availableFunding < TreasuryService.WARNING_THRESHOLD) {
      reasons.push("Treasury funding below warning threshold");
      recommendations.push("Prioritize funding deposits over large distributions");
      maxSafeTokens = Math.min(maxSafeTokens, stats.tokenReserve * 0.3); // Conservative limit
    }
    
    const currentPrice = await this.getCurrentTokenPrice();
    const maxSafeUsd = maxSafeTokens * currentPrice.price;
    
    return {
      shouldHaltDistributions: shouldHalt,
      riskLevel: portfolio.riskAssessment,
      reasons,
      recommendations,
      maxSafeDistribution: {
        tokens: maxSafeTokens,
        usd: maxSafeUsd
      }
    };
  }

  /**
   * Comprehensive treasury health score incorporating crypto-specific factors
   */
  async getTreasuryHealthScore(): Promise<{
    score: number; // 0-100
    grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
    factors: {
      funding: { score: number; weight: number; status: string };
      volatility: { score: number; weight: number; status: string };
      liquidity: { score: number; weight: number; status: string };
      diversification: { score: number; weight: number; status: string };
    };
    overallAssessment: string;
    urgentActions: string[];
  }> {
    const stats = await this.getTreasuryStats();
    const portfolio = await this.getCryptoPortfolioPerformance();
    const riskAssessment = await this.getAdvancedRiskAssessment();
    
    // Factor 1: Funding adequacy (40% weight)
    let fundingScore = 100;
    let fundingStatus = "Excellent";
    if (stats.availableFunding < TreasuryService.MINIMUM_BALANCE) {
      fundingScore = 20;
      fundingStatus = "Critical - Below minimum balance";
    } else if (stats.availableFunding < TreasuryService.WARNING_THRESHOLD) {
      fundingScore = 50;
      fundingStatus = "Warning - Low funding levels";
    } else if (stats.availableFunding < TreasuryService.CRITICAL_THRESHOLD) {
      fundingScore = 75;
      fundingStatus = "Good - Adequate funding";
    }
    
    // Factor 2: Volatility risk (30% weight)
    let volatilityScore = 100;
    let volatilityStatus = "Stable";
    if (riskAssessment.riskLevel === 'extreme') {
      volatilityScore = 10;
      volatilityStatus = "Extreme volatility - High risk";
    } else if (riskAssessment.riskLevel === 'high') {
      volatilityScore = 40;
      volatilityStatus = "High volatility - Elevated risk";
    } else if (riskAssessment.riskLevel === 'medium') {
      volatilityScore = 70;
      volatilityStatus = "Moderate volatility - Normal risk";
    }
    
    // Factor 3: Liquidity (20% weight)
    let liquidityScore = 80; // JCMOVES has moderate liquidity
    let liquidityStatus = "Good - Tradeable on DEX";
    if (portfolio.marketMetrics.volume24h) {
      const volume24h = parseFloat(portfolio.marketMetrics.volume24h.replace(/[^0-9.-]+/g,""));
      if (volume24h > 100000) liquidityScore = 100;
      else if (volume24h > 50000) liquidityScore = 90;
      else if (volume24h > 10000) liquidityScore = 80;
      else liquidityScore = 60;
    }
    
    // Factor 4: Diversification (10% weight) - Single token = lower score
    const diversificationScore = 30; // Single crypto asset
    const diversificationStatus = "Poor - Single asset concentration";
    
    // Calculate weighted score
    const totalScore = (
      fundingScore * 0.4 +
      volatilityScore * 0.3 +
      liquidityScore * 0.2 +
      diversificationScore * 0.1
    );
    
    // Assign letter grade
    let grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
    if (totalScore >= 95) grade = 'A+';
    else if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 80) grade = 'B+';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 65) grade = 'C+';
    else if (totalScore >= 55) grade = 'C';
    else if (totalScore >= 40) grade = 'D';
    else grade = 'F';
    
    // Generate overall assessment
    let overallAssessment = "";
    if (totalScore >= 80) overallAssessment = "Treasury is in good health with manageable crypto exposure";
    else if (totalScore >= 60) overallAssessment = "Treasury has moderate risks that should be monitored closely";
    else overallAssessment = "Treasury faces significant risks requiring immediate attention";
    
    // Identify urgent actions
    const urgentActions: string[] = [];
    if (riskAssessment.shouldHaltDistributions) urgentActions.push("HALT ALL DISTRIBUTIONS - Extreme market volatility");
    if (stats.availableFunding < TreasuryService.MINIMUM_BALANCE) urgentActions.push("URGENT: Add funding immediately");
    if (riskAssessment.riskLevel === 'extreme') urgentActions.push("Implement emergency volatility protocols");
    
    return {
      score: Math.round(totalScore),
      grade,
      factors: {
        funding: { score: Math.round(fundingScore), weight: 40, status: fundingStatus },
        volatility: { score: Math.round(volatilityScore), weight: 30, status: volatilityStatus },
        liquidity: { score: Math.round(liquidityScore), weight: 20, status: liquidityStatus },
        diversification: { score: diversificationScore, weight: 10, status: diversificationStatus }
      },
      overallAssessment,
      urgentActions
    };
  }
}

export const treasuryService = new TreasuryService();