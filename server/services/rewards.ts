// Rewards calculation and distribution service
import { moonshotService } from './moonshot';
import { cryptoCashoutService } from './crypto-cashout';

export interface RewardConfig {
  dailyCheckinTokens: number; // Base amount for daily check-in
  streakMultiplier: number;   // Multiplier for consecutive days
  maxStreakBonus: number;     // Cap on streak bonus
  bookingRewardPercentage: number; // Percentage of job value as reward
  referralTokens: number;     // Fixed amount for successful referrals
  jobCompletionTokens: number; // Base amount for job completion
}

export class RewardsService {
  private config: RewardConfig;

  constructor() {
    this.config = {
      dailyCheckinTokens: 0.01,    // 0.01 tokens per check-in
      streakMultiplier: 1.1,       // 10% bonus per consecutive day
      maxStreakBonus: 3.0,         // Max 3x bonus (at 30 day streak)
      bookingRewardPercentage: 0.02, // 2% of booking value
      referralTokens: 0.5,         // 0.5 tokens per referral
      jobCompletionTokens: 0.1,    // 0.1 tokens base completion bonus
    };
  }

  // Calculate daily check-in reward with streak bonus
  async calculateDailyReward(streakCount: number): Promise<{ tokenAmount: number; cashValue: number }> {
    let tokenAmount = this.config.dailyCheckinTokens;
    
    // Apply streak bonus (capped)
    const streakMultiplier = Math.min(
      Math.pow(this.config.streakMultiplier, streakCount - 1),
      this.config.maxStreakBonus
    );
    
    tokenAmount *= streakMultiplier;
    
    const cashValue = await moonshotService.calculateCashValue(tokenAmount);
    
    return { tokenAmount, cashValue };
  }

  // Calculate booking reward based on job value
  async calculateBookingReward(jobValueUSD: number): Promise<{ tokenAmount: number; cashValue: number }> {
    const rewardCashValue = jobValueUSD * this.config.bookingRewardPercentage;
    const tokenAmount = await moonshotService.calculateTokenAmount(rewardCashValue);
    
    return { 
      tokenAmount, 
      cashValue: rewardCashValue 
    };
  }

  // Calculate referral reward
  async calculateReferralReward(): Promise<{ tokenAmount: number; cashValue: number }> {
    const tokenAmount = this.config.referralTokens;
    const cashValue = await moonshotService.calculateCashValue(tokenAmount);
    
    return { tokenAmount, cashValue };
  }

  // Calculate job completion reward for employees
  async calculateJobCompletionReward(jobValueUSD: number, performanceRating?: number): Promise<{ tokenAmount: number; cashValue: number }> {
    let tokenAmount = this.config.jobCompletionTokens;
    
    // Base reward plus percentage of job value
    const valueBonus = await moonshotService.calculateTokenAmount(jobValueUSD * 0.01); // 1% of job value
    tokenAmount += valueBonus;
    
    // Performance bonus (if rated 5 stars, get 50% more)
    if (performanceRating && performanceRating >= 5) {
      tokenAmount *= 1.5;
    }
    
    const cashValue = await moonshotService.calculateCashValue(tokenAmount);
    
    return { tokenAmount, cashValue };
  }

  // Validate cashout eligibility
  async validateCashoutEligibility(
    tokenBalance: number, 
    requestedTokenAmount: number
  ): Promise<{ eligible: boolean; reason?: string }> {
    const minCashoutTokens = 1.0; // Minimum 1 token to cash out
    const maxCashoutTokens = 100.0; // Maximum 100 tokens per transaction
    
    if (requestedTokenAmount < minCashoutTokens) {
      return {
        eligible: false,
        reason: `Minimum cashout is ${minCashoutTokens} tokens`
      };
    }
    
    if (requestedTokenAmount > maxCashoutTokens) {
      return {
        eligible: false,
        reason: `Maximum cashout is ${maxCashoutTokens} tokens per transaction`
      };
    }
    
    if (tokenBalance < requestedTokenAmount) {
      return {
        eligible: false,
        reason: 'Insufficient token balance'
      };
    }
    
    return { eligible: true };
  }

  // Get current reward configuration
  getRewardConfig(): RewardConfig {
    return { ...this.config };
  }

  // Update reward configuration (business owner only)
  updateRewardConfig(newConfig: Partial<RewardConfig>): RewardConfig {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }
}

export const rewardsService = new RewardsService();