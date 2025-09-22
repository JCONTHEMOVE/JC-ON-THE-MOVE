// Rewards calculation and distribution service
import { cryptoService } from './crypto';
import { TREASURY_CONFIG } from '../constants';

export interface RewardConfig {
  dailyCheckinUSD: number;    // USD value for daily check-in
  streakMultiplier: number;   // Multiplier for consecutive days
  maxStreakBonus: number;     // Cap on streak bonus
  bookingRewardPercentage: number; // Percentage of job value as reward
  referralBonusUSD: number;   // Fixed USD value for successful referrals
  jobCompletionUSD: number;   // USD value for job completion per mover
}

export class RewardsService {
  private config: RewardConfig;

  constructor() {
    this.config = {
      dailyCheckinUSD: TREASURY_CONFIG.DAILY_CHECKIN_USD,    // $0.25 worth of JCMOVES
      streakMultiplier: 1.1,       // 10% bonus per consecutive day
      maxStreakBonus: 3.0,         // Max 3x bonus (at 30 day streak)
      bookingRewardPercentage: 0.02, // 2% of booking value
      referralBonusUSD: TREASURY_CONFIG.REFERRAL_BONUS_USD, // $10.00 worth of JCMOVES
      jobCompletionUSD: TREASURY_CONFIG.JOB_COMPLETION_USD, // $2.50 worth of JCMOVES
    };
  }

  // Calculate daily check-in reward with streak bonus
  async calculateDailyReward(streakCount: number): Promise<{ tokenAmount: number; cashValue: number }> {
    let cashValue = this.config.dailyCheckinUSD; // Start with $0.25 USD value
    
    // Apply streak bonus (capped) to USD value
    const streakMultiplier = Math.min(
      Math.pow(this.config.streakMultiplier, streakCount - 1),
      this.config.maxStreakBonus
    );
    
    cashValue *= streakMultiplier;
    
    // Convert USD value to JCMOVES tokens using real-time pricing
    const currentPrice = await cryptoService.getCurrentPrice();
    const tokenAmount = cashValue / currentPrice.price;
    
    return { tokenAmount, cashValue };
  }

  // Calculate booking reward based on job value (2% of booking value)
  async calculateBookingReward(jobValueUSD: number): Promise<{ tokenAmount: number; cashValue: number }> {
    const rewardCashValue = jobValueUSD * this.config.bookingRewardPercentage; // 2% of booking value in USD
    
    // Convert USD value to JCMOVES tokens using real-time pricing
    const currentPrice = await cryptoService.getCurrentPrice();
    const tokenAmount = rewardCashValue / currentPrice.price;
    
    return { 
      tokenAmount, 
      cashValue: rewardCashValue 
    };
  }

  // Calculate referral reward - $10.00 worth of JCMOVES
  async calculateReferralReward(): Promise<{ tokenAmount: number; cashValue: number }> {
    const cashValue = this.config.referralBonusUSD; // $10.00 USD value
    
    // Convert USD value to JCMOVES tokens using real-time pricing
    const currentPrice = await cryptoService.getCurrentPrice();
    const tokenAmount = cashValue / currentPrice.price;
    
    return { tokenAmount, cashValue };
  }

  // Calculate job completion reward for employees - $2.50 per mover
  async calculateJobCompletionReward(numMovers: number = 1, performanceRating?: number): Promise<{ tokenAmount: number; cashValue: number }> {
    let cashValue = this.config.jobCompletionUSD * numMovers; // $2.50 per mover
    
    // Performance bonus (if rated 5 stars, get 50% more)
    if (performanceRating && performanceRating >= 5) {
      cashValue *= 1.5;
    }
    
    // Convert USD value to JCMOVES tokens using real-time pricing
    const currentPrice = await cryptoService.getCurrentPrice();
    const tokenAmount = cashValue / currentPrice.price;
    
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