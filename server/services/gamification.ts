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
    BASE_TOKENS: "5.0",
    ON_TIME_BONUS: 0.2, // 20% bonus for on-time completion
    QUALITY_BONUS: 0.3, // 30% bonus for high customer rating
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
  nextLevelThreshold: number;
  tokenBalance: number;
}

export class GamificationService {
  /**
   * Perform daily check-in for an employee
   */
  async performDailyCheckIn(userId: string): Promise<DailyCheckInResult> {
    try {
      // Check if user already checked in today
      const today = new Date().toISOString().split('T')[0];
      const existingCheckIn = await storage.getTodayCheckIn(userId, today);
      
      if (existingCheckIn) {
        return {
          success: false,
          points: 0,
          tokens: "0",
          streak: existingCheckIn.streakCount,
          isNewRecord: false,
          treasuryBalance: 0,
          error: "Already checked in today"
        };
      }

      // Get or create employee stats
      let employeeStats = await storage.getEmployeeStats(userId);
      if (!employeeStats) {
        employeeStats = await storage.createEmployeeStats({ userId });
      }

      // Calculate streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const yesterdayCheckIn = await storage.getTodayCheckIn(userId, yesterdayStr);
      const newStreak = yesterdayCheckIn ? (employeeStats.currentStreak || 0) + 1 : 1;
      const isNewRecord = newStreak > (employeeStats.longestStreak || 0);

      // Calculate rewards based on streak
      const streakMultiplier = Math.min(
        Math.pow(GAMIFICATION_REWARDS.DAILY_CHECKIN.STREAK_MULTIPLIER, newStreak - 1),
        GAMIFICATION_REWARDS.DAILY_CHECKIN.MAX_STREAK_BONUS
      );
      
      const points = Math.floor(GAMIFICATION_REWARDS.DAILY_CHECKIN.BASE_POINTS * streakMultiplier);
      const tokenAmount = (parseFloat(GAMIFICATION_REWARDS.DAILY_CHECKIN.BASE_TOKENS) * streakMultiplier).toFixed(8);

      // Check Treasury balance and distribute tokens
      const treasuryStats = await treasuryService.getTreasuryStats();
      const tokenValue = parseFloat(tokenAmount) * 0.12; // Current JCMOVES price
      
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

      // Record the check-in
      await storage.createDailyCheckIn({
        userId,
        checkinDate: today
      });

      // Add points transaction
      await storage.createPointTransaction({
        userId,
        points,
        transactionType: "daily_checkin",
        description: `Daily check-in reward - ${newStreak} day streak`,
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
    
    // Check if can check in today
    const today = new Date().toISOString().split('T')[0];
    const todayCheckIn = await storage.getTodayCheckIn(userId, today);
    const canCheckIn = !todayCheckIn;
    
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
      nextLevelThreshold,
      tokenBalance
    };
  }

  /**
   * Award points for job completion
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
    if (performance.customerRating && performance.customerRating >= 4.5) {
      tokenMultiplier += GAMIFICATION_REWARDS.JOB_COMPLETION.QUALITY_BONUS;
      points += Math.floor(points * GAMIFICATION_REWARDS.JOB_COMPLETION.QUALITY_BONUS);
    }

    const tokenAmount = (parseFloat(GAMIFICATION_REWARDS.JOB_COMPLETION.BASE_TOKENS) * tokenMultiplier).toFixed(8);

    // Distribute tokens from Treasury
    await treasuryService.distributeTokens(
      userId,
      parseFloat(tokenAmount),
      `Job completion reward - Job #${jobId}`
    );

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

      return { points, tokens: tokenAmount, level: newLevel };
    }

    return { points, tokens: tokenAmount, level: 1 };
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
        userId,
        parseFloat(achievement.tokenReward || "0"),
        `Achievement reward: ${achievement.name}`
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