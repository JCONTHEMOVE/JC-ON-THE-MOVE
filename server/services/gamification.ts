import { storage } from "../storage";
import { treasuryService } from "./treasury";
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
  /**
   * Perform check-in for an employee (claimable 4 times per day - every 6 hours)
   */
  async performDailyCheckIn(userId: string): Promise<DailyCheckInResult> {
    try {
      // Check if user already checked in within the last 6 hours
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
      
      const recentCheckIn = await storage.getRecentCheckIn(userId, sixHoursAgo);
      
      if (recentCheckIn) {
        const nextClaimTime = new Date(recentCheckIn.createdAt.getTime() + (6 * 60 * 60 * 1000));
        const hoursRemaining = Math.ceil((nextClaimTime.getTime() - now.getTime()) / (60 * 60 * 1000));
        
        return {
          success: false,
          points: 0,
          tokens: "0",
          streak: recentCheckIn.streakCount || 1,
          isNewRecord: false,
          treasuryBalance: 0,
          error: `Next check-in available in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`
        };
      }

      // Get or create employee stats
      let employeeStats = await storage.getEmployeeStats(userId);
      if (!employeeStats) {
        employeeStats = await storage.createEmployeeStats({ userId });
      }

      // Calculate streak - only advance once per day, not every 6 hours
      const today = now.toISOString().split('T')[0];
      const lastCheckIn = await storage.getLastCheckIn(userId);
      
      let newStreak = 1;
      let isNewRecord = false;
      
      if (lastCheckIn) {
        const lastCheckInDate = lastCheckIn.checkinDate;
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (lastCheckInDate === today) {
          // Already checked in today, maintain current streak
          newStreak = lastCheckIn.streakCount || 1;
        } else if (lastCheckInDate === yesterdayStr) {
          // Last check-in was yesterday, increment streak
          newStreak = (lastCheckIn.streakCount || 0) + 1;
          isNewRecord = newStreak > (employeeStats.longestStreak || 0);
        } else {
          // Streak broken, reset to 1
          newStreak = 1;
        }
      }

      // Calculate rewards: FIXED $0.25 USD worth of JCMOVES tokens per check-in
      const usdValue = 0.25; // Always exactly $0.25 per check-in
      
      // Streak multiplier only affects points, NOT token payout
      const streakMultiplier = Math.min(
        Math.pow(GAMIFICATION_REWARDS.DAILY_CHECKIN.STREAK_MULTIPLIER, newStreak - 1),
        GAMIFICATION_REWARDS.DAILY_CHECKIN.MAX_STREAK_BONUS
      );
      
      const points = Math.floor(GAMIFICATION_REWARDS.DAILY_CHECKIN.BASE_POINTS * streakMultiplier);
      
      // Get current token price to calculate token amount from FIXED USD value
      const currentPrice = await treasuryService.getCurrentTokenPrice();
      const tokenAmount = (usdValue / currentPrice.price).toFixed(8); // No streak multiplier on tokens

      // Check Treasury balance and distribute tokens
      const treasuryStats = await treasuryService.getTreasuryStats();
      const tokenValue = usdValue; // Always exactly $0.25 worth of tokens
      
      if (treasuryStats.availableFunding < tokenValue) {
        return {
          success: false,
          points: 0,
          tokens: "0",
          streak: newStreak,
          isNewRecord,
          treasuryBalance: treasuryStats.availableFunding,
          error: "Insufficient Treasury funds for token distribution"
        };
      }

      // Distribute tokens from Treasury
      const distributionResult = await treasuryService.distributeTokens(
        parseFloat(tokenAmount),
        `Daily check-in reward - ${newStreak} day streak`,
        "daily_checkin",
        userId
      );

      if (!distributionResult.success) {
        return {
          success: false,
          points: 0,
          tokens: "0",
          streak: newStreak,
          isNewRecord,
          treasuryBalance: treasuryStats.availableFunding,
          error: distributionResult.error || "Token distribution failed"
        };
      }

      // Create or update user's wallet account with the distributed tokens
      try {
        const existingWallet = await storage.getWalletAccount(userId);
        
        if (existingWallet) {
          // Update existing wallet
          await storage.updateWalletAccount(userId, {
            tokenBalance: (parseFloat(existingWallet.tokenBalance || "0") + parseFloat(tokenAmount)).toFixed(8),
            cashBalance: (parseFloat(existingWallet.cashBalance || "0") + distributionResult.cashValue).toFixed(2),
            totalEarned: (parseFloat(existingWallet.totalEarned || "0") + parseFloat(tokenAmount)).toFixed(8),
          });
        } else {
          // Create new wallet account
          await storage.createWalletAccount({
            userId,
            walletAddress: `0xJCMOVES_${userId.substring(0, 8)}`,
          });
          
          // Update with the token amounts
          await storage.updateWalletAccount(userId, {
            tokenBalance: tokenAmount,
            cashBalance: distributionResult.cashValue.toFixed(2),
            totalEarned: tokenAmount,
          });
        }
      } catch (walletError) {
        console.error(`Wallet update error:`, walletError);
        // Continue with check-in even if wallet update fails
      }

      // Record the check-in
      await storage.createDailyCheckIn({
        userId,
        checkinDate: now.toISOString().split('T')[0], // Current date for tracking
        streakCount: newStreak
      });

      // Add points transaction
      await storage.createPointTransaction({
        userId,
        points,
        transactionType: "daily_checkin",
        description: `Check-in reward (4x daily) - ${newStreak} day streak`,
        metadata: {
          streak: newStreak,
          tokenAmount,
          streakMultiplier: streakMultiplier.toFixed(2)
        }
      });

      // Update employee stats
      await storage.updateEmployeeStats(userId, {
        totalPoints: (employeeStats.totalPoints || 0) + points,
        currentStreak: newStreak,
        longestStreak: Math.max(employeeStats.longestStreak || 0, newStreak),
        totalEarnedTokens: (parseFloat(employeeStats.totalEarnedTokens || "0") + parseFloat(tokenAmount)).toFixed(8),
        lastActivityDate: new Date()
      });

      // Check for achievements
      await this.checkAndAwardAchievements(userId, {
        type: 'daily_checkin',
        streak: newStreak,
        isNewRecord
      });

      return {
        success: true,
        points,
        tokens: tokenAmount,
        streak: newStreak,
        isNewRecord,
        treasuryBalance: distributionResult.remainingBalance
      };

    } catch (error) {
      console.error('Daily check-in error:', error);
      return {
        success: false,
        points: 0,
        tokens: "0",
        streak: 0,
        isNewRecord: false,
        treasuryBalance: 0,
        error: "Check-in failed due to system error"
      };
    }
  }

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
    
    // Check if can check in (6-hour intervals)
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - (6 * 60 * 60 * 1000));
    const recentCheckIn = await storage.getRecentCheckIn(userId, sixHoursAgo);
    const canCheckIn = !recentCheckIn;
    
    // Calculate next check-in time
    const nextCheckInAt = recentCheckIn 
      ? new Date(recentCheckIn.createdAt.getTime() + (6 * 60 * 60 * 1000))
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

    // Check if this job was created by an employee and reward them too
    const lead = await storage.getLead(jobId);
    if (lead && lead.createdByUserId && lead.createdByUserId !== userId) {
      // Award bonus to employee who created the job (10% of completion reward)
      const creatorBonusTokens = (parseFloat(tokenAmount) * 0.1).toFixed(8);
      const creatorBonusPoints = Math.floor(points * 0.1);

      const creatorDistributionResult = await treasuryService.distributeTokens(
        parseFloat(creatorBonusTokens),
        `Job creation bonus - Job #${jobId} completed`,
        "job_creation_bonus",
        lead.createdByUserId
      );

      // Only create reward record if distribution was successful
      if (creatorDistributionResult.success) {
        // Create reward record for creator bonus
        await storage.createReward({
          userId: lead.createdByUserId,
          rewardType: 'job_creation_bonus',
          tokenAmount: creatorBonusTokens,
          cashValue: creatorDistributionResult.cashValue.toFixed(4),
          status: 'confirmed',
          referenceId: jobId,
          metadata: {
            completedBy: userId,
            points: creatorBonusPoints
          }
        });

        await storage.createPointTransaction({
          userId: lead.createdByUserId,
          points: creatorBonusPoints,
          transactionType: "job_creation_bonus",
          relatedEntityType: "lead",
          relatedEntityId: jobId,
          description: `Job creation bonus - Job #${jobId} completed`,
          metadata: {
            completedBy: userId,
            tokenAmount: creatorBonusTokens
          }
        });

        // Update creator's stats
        const creatorStats = await storage.getEmployeeStats(lead.createdByUserId);
        if (creatorStats) {
          await storage.updateEmployeeStats(lead.createdByUserId, {
            totalPoints: (creatorStats.totalPoints || 0) + creatorBonusPoints,
            totalEarnedTokens: (parseFloat(creatorStats.totalEarnedTokens || "0") + parseFloat(creatorBonusTokens)).toFixed(8),
            lastActivityDate: new Date()
          });
        }
      }
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

    // Check if this job was created by an employee and reward them too
    const lead = await storage.getLead(jobId);
    if (lead && lead.createdByUserId && lead.createdByUserId !== userId) {
      // Award bonus to employee who created the job (50% of completion reward)
      const creatorBonusTokens = (parseFloat(tokenAmount) * 0.5).toFixed(8);
      const creatorBonusPoints = Math.floor(points * 0.5);

      await treasuryService.distributeTokens(
        parseFloat(creatorBonusTokens),
        `Job creation bonus - Job #${jobId} completed`,
        "job_creation_bonus",
        lead.createdByUserId
      );

      // Create reward record for creator bonus
      await storage.createReward({
        userId: lead.createdByUserId,
        rewardType: 'job_creation_bonus',
        tokenAmount: creatorBonusTokens,
        cashValue: (parseFloat(creatorBonusTokens) * tokenPrice).toFixed(4),
        status: 'confirmed',
        referenceId: jobId,
        metadata: {
          completedBy: userId,
          points: creatorBonusPoints
        }
      });

      await storage.createPointTransaction({
        userId: lead.createdByUserId,
        points: creatorBonusPoints,
        transactionType: "job_creation_bonus",
        relatedEntityType: "lead",
        relatedEntityId: jobId,
        description: `Job creation bonus - Job #${jobId} completed`,
        metadata: {
          completedBy: userId,
          tokenAmount: creatorBonusTokens
        }
      });

      // Update creator's stats
      const creatorStats = await storage.getEmployeeStats(lead.createdByUserId);
      if (creatorStats) {
        await storage.updateEmployeeStats(lead.createdByUserId, {
          totalPoints: (creatorStats.totalPoints || 0) + creatorBonusPoints,
          totalEarnedTokens: (parseFloat(creatorStats.totalEarnedTokens || "0") + parseFloat(creatorBonusTokens)).toFixed(8),
          lastActivityDate: new Date()
        });
      }
    }

    return { points, tokens: tokenAmount, level: stats ? this.calculateLevel((stats.totalPoints || 0) + points) : 1 };
  }

  /**
   * Award bonus tokens for high customer ratings (4 or 5 stars)
   */
  async awardHighRatingBonus(userId: string, reviewId: string, rating: number): Promise<{ success: boolean; tokensAwarded: string; points: number; error?: string }> {
    try {
      // Calculate bonus based on rating
      const tokenAmount = rating === 5 ? "50.0" : "25.0"; // 50 tokens for 5 stars, 25 for 4 stars
      const points = rating === 5 ? 100 : 50; // Bonus points

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
  private async checkAndAwardAchievements(userId: string, activity: any): Promise<void> {
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