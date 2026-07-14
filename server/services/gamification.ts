import { storage } from "../storage";
import { treasuryService } from "./treasury";
import { db } from "../db";
import { getEasternDateStr, getEasternDayStart } from "../utils/dateUtils";
import { eq } from "drizzle-orm";
import { rewardSettings } from "@shared/schema";
import type {
  EmployeeStats, 
  InsertEmployeeStats, 
  AchievementType, 
  EmployeeAchievement,
  PointTransaction,
  WeeklyLeaderboard,
  GamificationConfig,
  User
} from "@shared/schema";

// Constants for gamification rewards
export const GAMIFICATION_REWARDS = {
  DAILY_CHECKIN: {
    BASE_POINTS: 50,
    BASE_TOKENS: "1.5", // JCMOVES tokens
    STREAK_MULTIPLIER: 1.1, // 10% bonus per day in streak
    MAX_STREAK_BONUS: 3.0, // Max 3x multiplier at 20+ day streak
  },
  JOB_COMPLETION: {
    BASE_POINTS: 100,
    BASE_TOKENS: "500.0",
    ON_TIME_BONUS: 0.2, // 20% bonus for on-time completion
    QUALITY_BONUS: 0.3, // 30% bonus for high customer rating (4.0+)
  },
  ACHIEVEMENTS: {
    FIRST_WEEK_STREAK: { points: 250, tokens: "10.0" },
    JOB_MASTER_5: { points: 500, tokens: "25.0" },
    CUSTOMER_CHAMPION: { points: 750, tokens: "50.0" },
    SPEED_DEMON: { points: 300, tokens: "15.0" },
  },
  WEEKLY_LEADERBOARD: {
    FIRST_PLACE: { tokens: "100.0" },
    SECOND_PLACE: { tokens: "50.0" },
    THIRD_PLACE: { tokens: "25.0" },
  }
};

async function getRewardSettingAmount(settingKey: string, fallback: number): Promise<number> {
  try {
    const [setting] = await db
      .select()
      .from(rewardSettings)
      .where(eq(rewardSettings.settingKey, settingKey))
      .limit(1);
    if (!setting) return fallback;
    if (!setting.isActive) return 0;
    const amount = Number(setting.tokenAmount);
    return Number.isFinite(amount) ? amount : fallback;
  } catch {
    return fallback;
  }
}

export interface DailyCheckInResult {
  success: boolean;
  points: number;
  tokens: string;
  streak: number;
  isNewRecord: boolean;
  treasuryBalance: number;
  error?: string;
}

export interface EmployeeGamificationData {
  stats: EmployeeStats;
  recentAchievements: (EmployeeAchievement & { achievementType: AchievementType })[];
  weeklyRank: { rank: number; totalEmployees: number; weeklyPoints: number } | null;
  canCheckIn: boolean;
  lastCheckIn: Date | null;
  nextCheckInAt: Date | null;
  nextLevelThreshold: number;
  tokenBalance: number;
}

export class GamificationService {
  // NOTE: The previous `performDailyCheckIn` method on this class has been
  // removed. The single source of truth for daily check-ins is now
  // `dailyRewardsService.checkIn` in server/services/daily-rewards.ts. That
  // service handles fraud detection, streak math, treasury distribution,
  // wallet credit (tokens only — never cash_balance), the rewards-history
  // row, the points transaction, the employee-stats roll-up, and the
  // achievement check below.
  //
  // The `checkAndAwardAchievements` method on this class is still called
  // by the unified service for the `daily_checkin` activity type so the
  // 7-day-streak achievement keeps firing.

  /**
   * Get comprehensive gamification data for an employee
   */
  async getEmployeeGamificationData(userId: string): Promise<EmployeeGamificationData> {
    // Get or create employee stats
    let stats = await storage.getEmployeeStats(userId);
    if (!stats) {
      stats = await storage.createEmployeeStats({ userId });
    }

    // Get recent achievements
    const achievements = await storage.getEmployeeAchievements(userId, 5);
    
    // Get weekly rank
    const weeklyRank = await this.getWeeklyRank(userId);
    
    // Check if can check in (once per calendar day in Eastern time)
    const todayEasternStart = getEasternDayStart();
    const recentCheckIn = await storage.getRecentCheckIn(userId, todayEasternStart);
    const canCheckIn = !recentCheckIn;

    // Next check-in is tomorrow midnight Eastern
    const nextCheckInAt = recentCheckIn
      ? new Date(todayEasternStart.getTime() + 24 * 60 * 60 * 1000)
      : null;
    
    // Get last check-in date  
    const lastCheckIn = await storage.getLastCheckIn(userId);
    
    // Calculate next level threshold
    const nextLevelThreshold = this.calculateLevelThreshold(stats.currentLevel + 1);
    
    // Get token balance
    const wallet = await storage.getWalletAccount(userId);
    const tokenBalance = wallet ? parseFloat(wallet.tokenBalance || "0") : 0;

    return {
      stats,
      recentAchievements: achievements,
      weeklyRank,
      canCheckIn,
      lastCheckIn: lastCheckIn?.checkinDate ? new Date(lastCheckIn.checkinDate) : null,
      nextCheckInAt,
      nextLevelThreshold,
      tokenBalance
    };
  }

  /**
   * Award custom token amount for job completion (used when tokenAllocation is set on job)
   */
  async awardJobCompletion(userId: string, jobId: string, tokenAmount: string, performance: {
    onTime: boolean;
    customerRating?: number;
  }): Promise<{ points: number; tokens: string; level: number }> {
    let points = GAMIFICATION_REWARDS.JOB_COMPLETION.BASE_POINTS;

    // Award bonus points based on performance
    if (performance.onTime) {
      points += Math.floor(points * GAMIFICATION_REWARDS.JOB_COMPLETION.ON_TIME_BONUS);
    }

    if (performance.customerRating && performance.customerRating >= 4.0) {
      points += Math.floor(points * GAMIFICATION_REWARDS.JOB_COMPLETION.QUALITY_BONUS);
    }

    // Get current token price for accurate cash value calculation
    const tokenPrice = await treasuryService.getCurrentTokenPrice();

    // Distribute the specified token amount from Treasury
    const distributionResult = await treasuryService.distributeTokens(
      parseFloat(tokenAmount),
      `Job completion reward - Job #${jobId}`,
      "job_completion",
      userId
    );

    // Check if distribution was successful
    if (!distributionResult.success) {
      throw new Error(`Token distribution failed: ${distributionResult.error || 'Unknown error'}`);
    }

    // Credit the user's wallet balance with the tokens
    await storage.creditWalletTokens(userId, parseFloat(tokenAmount), { skipRewardLedger: true });

    // Create reward record for history tracking (use actual cash value from distribution)
    await storage.createReward({
      userId,
      rewardType: 'job_completion',
      tokenAmount,
      cashValue: distributionResult.cashValue.toFixed(4),
      status: 'confirmed',
      referenceId: jobId,
      metadata: {
        onTime: performance.onTime,
        customerRating: performance.customerRating,
        points
      }
    });

    // Add points transaction
    await storage.createPointTransaction({
      userId,
      points,
      transactionType: "job_completion",
      relatedEntityType: "lead",
      relatedEntityId: jobId,
      description: `Job completion reward - Job #${jobId}`,
      metadata: {
        onTime: performance.onTime,
        customerRating: performance.customerRating,
        tokenAmount
      }
    });

    // Update employee stats
    const stats = await storage.getEmployeeStats(userId);
    if (stats) {
      const newTotalPoints = (stats.totalPoints || 0) + points;
      const newLevel = this.calculateLevel(newTotalPoints);
      
      await storage.updateEmployeeStats(userId, {
        totalPoints: newTotalPoints,
        currentLevel: newLevel,
        jobsCompleted: (stats.jobsCompleted || 0) + 1,
        onTimeCompletions: (stats.onTimeCompletions || 0) + (performance.onTime ? 1 : 0),
        totalEarnedTokens: (parseFloat(stats.totalEarnedTokens || "0") + parseFloat(tokenAmount)).toFixed(8),
        lastActivityDate: new Date()
      });

      // Check for achievements
      await this.checkAndAwardAchievements(userId, {
        type: 'job_completion',
        totalJobs: stats.jobsCompleted + 1,
        onTimeCompletions: stats.onTimeCompletions + (performance.onTime ? 1 : 0),
        newLevel,
        customerRating: performance.customerRating
      });
    }

    return { points, tokens: tokenAmount, level: stats ? this.calculateLevel((stats.totalPoints || 0) + points) : 1 };
  }

  /**
   * Award points for job completion (calculates token amount from base rewards)
   */
  async awardJobCompletionPoints(userId: string, jobId: string, performance: {
    onTime: boolean;
    customerRating?: number;
  }): Promise<{ points: number; tokens: string; level: number }> {
    let points = GAMIFICATION_REWARDS.JOB_COMPLETION.BASE_POINTS;
    let tokenMultiplier = 1.0;

    // On-time bonus
    if (performance.onTime) {
      tokenMultiplier += GAMIFICATION_REWARDS.JOB_COMPLETION.ON_TIME_BONUS;
      points += Math.floor(points * GAMIFICATION_REWARDS.JOB_COMPLETION.ON_TIME_BONUS);
    }

    // Quality bonus based on customer rating
    if (performance.customerRating && performance.customerRating >= 4.0) {
      tokenMultiplier += GAMIFICATION_REWARDS.JOB_COMPLETION.QUALITY_BONUS;
      points += Math.floor(points * GAMIFICATION_REWARDS.JOB_COMPLETION.QUALITY_BONUS);
    }

    const tokenAmount = (parseFloat(GAMIFICATION_REWARDS.JOB_COMPLETION.BASE_TOKENS) * tokenMultiplier).toFixed(8);

    // Distribute tokens from Treasury
    await treasuryService.distributeTokens(
      parseFloat(tokenAmount),
      `Job completion reward - Job #${jobId}`,
      "job_completion",
      userId
    );

    // Create reward record for history tracking
    const tokenPrice = 0.00000508432; // Default token price
    await storage.createReward({
      userId,
      rewardType: 'job_completion',
      tokenAmount,
      cashValue: (parseFloat(tokenAmount) * tokenPrice).toFixed(4),
      status: 'confirmed',
      referenceId: jobId,
      metadata: {
        onTime: performance.onTime,
        customerRating: performance.customerRating,
        points
      }
    });

    // Add points transaction
    await storage.createPointTransaction({
      userId,
      points,
      transactionType: "job_completion",
      relatedEntityType: "lead",
      relatedEntityId: jobId,
      description: `Job completion reward - Job #${jobId}`,
      metadata: {
        onTime: performance.onTime,
        customerRating: performance.customerRating,
        tokenAmount
      }
    });

    // Update employee stats
    const stats = await storage.getEmployeeStats(userId);
    if (stats) {
      const newTotalPoints = (stats.totalPoints || 0) + points;
      const newLevel = this.calculateLevel(newTotalPoints);
      
      await storage.updateEmployeeStats(userId, {
        totalPoints: newTotalPoints,
        currentLevel: newLevel,
        jobsCompleted: (stats.jobsCompleted || 0) + 1,
        onTimeCompletions: (stats.onTimeCompletions || 0) + (performance.onTime ? 1 : 0),
        totalEarnedTokens: (parseFloat(stats.totalEarnedTokens || "0") + parseFloat(tokenAmount)).toFixed(8),
        lastActivityDate: new Date()
      });

      // Check for achievements
      await this.checkAndAwardAchievements(userId, {
        type: 'job_completion',
        totalJobs: stats.jobsCompleted + 1,
        onTimeCompletions: stats.onTimeCompletions + (performance.onTime ? 1 : 0),
        newLevel,
        customerRating: performance.customerRating
      });
    }

    return { points, tokens: tokenAmount, level: stats ? this.calculateLevel((stats.totalPoints || 0) + points) : 1 };
  }

  /**
   * Award bonus tokens for high customer ratings (4 or 5 stars)
   */
  async awardHighRatingBonus(userId: string, reviewId: string, rating: number): Promise<{ success: boolean; tokensAwarded: string; points: number; error?: string }> {
    try {
      // Calculate bonus based on rating
      const tokenSettingKey = rating >= 5 ? "worker_5_star_review_bonus" : "worker_4_star_review_bonus";
      const tokenAmountNumber = await getRewardSettingAmount(tokenSettingKey, rating >= 5 ? 500 : 250);
      const tokenAmount = tokenAmountNumber.toFixed(8);
      const points = rating === 5 ? 100 : 50; // Bonus points

      if (tokenAmountNumber <= 0) {
        return {
          success: true,
          tokensAwarded: "0",
          points: 0
        };
      }

      // Get current token price for accurate cash value calculation
      const tokenPrice = await treasuryService.getCurrentTokenPrice();

      // Distribute tokens from Treasury
      const distributionResult = await treasuryService.distributeTokens(
        parseFloat(tokenAmount),
        `High rating bonus - ${rating} stars (Review #${reviewId})`,
        "customer_rating_bonus",
        userId
      );

      // Check if distribution was successful
      if (!distributionResult.success) {
        return {
          success: false,
          tokensAwarded: "0",
          points: 0,
          error: distributionResult.error || 'Token distribution failed'
        };
      }

      // Create reward record for history tracking
      await storage.createReward({
        userId,
        rewardType: 'customer_rating_bonus',
        tokenAmount,
        cashValue: distributionResult.cashValue.toFixed(4),
        status: 'confirmed',
        referenceId: reviewId,
        metadata: {
          rating,
          points
        }
      });
      await storage.creditWalletTokens(userId, parseFloat(tokenAmount), { skipRewardLedger: true });

      // Add points transaction
      await storage.createPointTransaction({
        userId,
        points,
        transactionType: "customer_rating_bonus",
        relatedEntityType: "review",
        relatedEntityId: reviewId,
        description: `High rating bonus - ${rating} stars`,
        metadata: {
          rating,
          tokenAmount
        }
      });

      // Update employee stats
      const stats = await storage.getEmployeeStats(userId);
      if (stats) {
        await storage.updateEmployeeStats(userId, {
          totalPoints: (stats.totalPoints || 0) + points,
          totalEarnedTokens: (parseFloat(stats.totalEarnedTokens || "0") + parseFloat(tokenAmount)).toFixed(8),
          lastActivityDate: new Date()
        });
      }

      return {
        success: true,
        tokensAwarded: tokenAmount,
        points
      };
    } catch (error) {
      console.error('High rating bonus error:', error);
      return {
        success: false,
        tokensAwarded: "0",
        points: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get weekly leaderboard
   */
  async getWeeklyLeaderboard(): Promise<WeeklyLeaderboard[]> {
    return await storage.getWeeklyLeaderboard();
  }

  /**
   * Get weekly rank for a specific user
   */
  async getWeeklyRank(userId: string): Promise<{ rank: number; totalEmployees: number; weeklyPoints: number } | null> {
    return await storage.getWeeklyRank(userId);
  }

  /**
   * Calculate level based on total points
   */
  private calculateLevel(totalPoints: number): number {
    // Level formula: Level = floor(sqrt(totalPoints / 100)) + 1
    // Level 1: 0-99 points, Level 2: 100-399 points, Level 3: 400-899 points, etc.
    return Math.floor(Math.sqrt(totalPoints / 100)) + 1;
  }

  /**
   * Calculate points needed for a specific level
   */
  private calculateLevelThreshold(level: number): number {
    // Inverse of level formula: Points = (level - 1)^2 * 100
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Check and award achievements based on activities
   */
  async checkAndAwardAchievements(userId: string, activity: any): Promise<void> {
    const stats = await storage.getEmployeeStats(userId);
    if (!stats) return;

    const achievementsToAward: string[] = [];

    // Check different achievement types based on activity
    switch (activity.type) {
      case 'daily_checkin':
        if (activity.streak === 7) {
          achievementsToAward.push('first_week_streak');
        }
        break;
        
      case 'job_completion':
        if (activity.totalJobs === 5) {
          achievementsToAward.push('job_master_5');
        }
        if (activity.customerRating && activity.customerRating >= 5.0) {
          achievementsToAward.push('customer_champion');
        }
        break;
    }

    // Award achievements
    for (const achievementKey of achievementsToAward) {
      await this.awardAchievement(userId, achievementKey);
    }
  }

  /**
   * Award a specific achievement to a user
   */
  private async awardAchievement(userId: string, achievementKey: string): Promise<void> {
    const achievement = await storage.getAchievementByKey(achievementKey);
    if (!achievement) return;

    // Check if user already has this achievement
    const existing = await storage.getUserAchievement(userId, achievement.id);
    if (existing) return;

    // Award the achievement
    await storage.createEmployeeAchievement({
      userId,
      achievementTypeId: achievement.id
    });

    // Award achievement points and tokens
    if ((achievement.pointsAwarded || 0) > 0) {
      await storage.createPointTransaction({
        userId,
        points: achievement.pointsAwarded || 0,
        transactionType: "achievement",
        relatedEntityType: "achievement",
        relatedEntityId: achievement.id,
        description: `Achievement unlocked: ${achievement.name}`
      });
    }

    if (parseFloat(achievement.tokenReward || "0") > 0) {
      await treasuryService.distributeTokens(
        parseFloat(achievement.tokenReward || "0"),
        `Achievement reward: ${achievement.name}`,
        "achievement",
        userId
      );
    }

    // Update employee stats
    const stats = await storage.getEmployeeStats(userId);
    if (stats) {
      await storage.updateEmployeeStats(userId, {
        totalPoints: (stats.totalPoints || 0) + (achievement.pointsAwarded || 0),
        totalEarnedTokens: (parseFloat(stats.totalEarnedTokens || "0") + parseFloat(achievement.tokenReward || "0")).toFixed(8)
      });
    }
  }
}

export const gamificationService = new GamificationService();
