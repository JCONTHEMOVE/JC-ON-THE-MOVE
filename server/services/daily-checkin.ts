// Daily check-in service with streak tracking and fraud prevention
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { dailyCheckins, rewards, walletAccounts, fraudLogs, users } from '@shared/schema';
import { rewardsService } from './rewards';
import { fraudDetectionService } from './fraud-detection';

interface CheckinRequest {
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  };
}

interface CheckinResult {
  success: boolean;
  message: string;
  reward?: {
    tokenAmount: number;
    cashValue: number;
    streakCount: number;
  };
  riskScore?: number;
  nextCheckinAt?: Date;
}

export class DailyCheckinService {
  // Process daily check-in attempt
  async processCheckin(request: CheckinRequest): Promise<CheckinResult> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if user already checked in today
      const existingCheckin = await db
        .select()
        .from(dailyCheckins)
        .where(
          and(
            eq(dailyCheckins.userId, request.userId),
            eq(dailyCheckins.checkinDate, today)
          )
        )
        .limit(1);

      if (existingCheckin.length > 0) {
        const nextCheckin = new Date();
        nextCheckin.setDate(nextCheckin.getDate() + 1);
        nextCheckin.setHours(0, 0, 0, 0);

        return {
          success: false,
          message: 'You have already checked in today. Come back tomorrow!',
          nextCheckinAt: nextCheckin
        };
      }

      // Generate device fingerprint
      const deviceFP = request.deviceFingerprint 
        ? fraudDetectionService.generateDeviceFingerprint(request.deviceFingerprint)
        : 'unknown';

      // Perform fraud analysis
      const fraudCheck = await fraudDetectionService.analyzeCheckinAttempt({
        userId: request.userId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        deviceFingerprint: deviceFP,
        timestamp: new Date()
      });

      // Log fraud detection results
      if (fraudCheck.riskScore > 0) {
        await db.insert(fraudLogs).values({
          userId: request.userId,
          eventType: 'daily_checkin_attempt',
          riskScore: fraudCheck.riskScore,
          details: {
            reasons: fraudCheck.reasons,
            deviceFingerprint: deviceFP,
            timestamp: new Date().toISOString()
          },
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          actionTaken: fraudCheck.actionTaken
        });
      }

      // Block if high risk
      if (fraudCheck.blocked) {
        return {
          success: false,
          message: 'Check-in temporarily unavailable. Please try again later or contact support.',
          riskScore: fraudCheck.riskScore
        };
      }

      // Calculate current streak
      const streakCount = await this.calculateStreakCount(request.userId);

      // Calculate reward for this check-in
      const rewardCalc = await rewardsService.calculateDailyReward(streakCount);

      // Start database transaction
      await db.transaction(async (tx) => {
        // Record the check-in
        await tx.insert(dailyCheckins).values({
          userId: request.userId,
          checkinDate: today,
          deviceFingerprint: deviceFP,
          ipAddress: request.ipAddress,
          userAgent: request.userAgent,
          rewardClaimed: true,
          streakCount: streakCount,
          riskScore: fraudCheck.riskScore
        });

        // Create reward record
        await tx.insert(rewards).values({
          userId: request.userId,
          rewardType: 'daily_checkin',
          tokenAmount: rewardCalc.tokenAmount.toString(),
          cashValue: rewardCalc.cashValue.toString(),
          status: 'confirmed',
          metadata: {
            streakCount,
            riskScore: fraudCheck.riskScore,
            deviceFingerprint: deviceFP
          }
        });

        // Update or create wallet account
        const existingWallet = await tx
          .select()
          .from(walletAccounts)
          .where(eq(walletAccounts.userId, request.userId))
          .limit(1);

        if (existingWallet.length > 0) {
          // Update existing wallet
          await tx
            .update(walletAccounts)
            .set({
              tokenBalance: sql`${walletAccounts.tokenBalance} + ${rewardCalc.tokenAmount.toString()}`,
              cashBalance: sql`${walletAccounts.cashBalance} + ${rewardCalc.cashValue.toString()}`,
              totalEarned: sql`${walletAccounts.totalEarned} + ${rewardCalc.tokenAmount.toString()}`,
              lastActivity: new Date()
            })
            .where(eq(walletAccounts.userId, request.userId));
        } else {
          // Create new wallet
          await tx.insert(walletAccounts).values({
            userId: request.userId,
            tokenBalance: rewardCalc.tokenAmount.toString(),
            cashBalance: rewardCalc.cashValue.toString(),
            totalEarned: rewardCalc.tokenAmount.toString()
          });
        }
      });

      return {
        success: true,
        message: `Daily check-in complete! You earned ${rewardCalc.tokenAmount.toFixed(8)} tokens (${streakCount} day streak)`,
        reward: {
          tokenAmount: rewardCalc.tokenAmount,
          cashValue: rewardCalc.cashValue,
          streakCount
        },
        riskScore: fraudCheck.riskScore
      };

    } catch (error) {
      console.error('Daily check-in error:', error);
      
      return {
        success: false,
        message: 'Check-in failed due to a technical error. Please try again.'
      };
    }
  }

  // Calculate consecutive day streak
  private async calculateStreakCount(userId: string): Promise<number> {
    try {
      const checkins = await db
        .select({
          checkinDate: dailyCheckins.checkinDate
        })
        .from(dailyCheckins)
        .where(eq(dailyCheckins.userId, userId))
        .orderBy(desc(dailyCheckins.checkinDate))
        .limit(100); // Look at last 100 check-ins max

      if (checkins.length === 0) {
        return 1; // First check-in
      }

      let streakCount = 1;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if the most recent check-in was yesterday
      const mostRecent = new Date(checkins[0].checkinDate);
      const isYesterday = mostRecent.toDateString() === yesterday.toDateString();

      if (!isYesterday) {
        return 1; // Streak broken, starting fresh
      }

      // Count consecutive days
      let expectedDate = new Date(yesterday);
      
      for (let i = 0; i < checkins.length; i++) {
        const checkinDate = new Date(checkins[i].checkinDate);
        
        if (checkinDate.toDateString() === expectedDate.toDateString()) {
          streakCount++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break; // Streak broken
        }
      }

      return streakCount;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 1;
    }
  }

  // Get user's check-in status for today
  async getCheckinStatus(userId: string): Promise<{
    checkedInToday: boolean;
    streakCount: number;
    nextReward?: { tokenAmount: number; cashValue: number };
    nextCheckinAt?: Date;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const todayCheckin = await db
        .select()
        .from(dailyCheckins)
        .where(
          and(
            eq(dailyCheckins.userId, userId),
            eq(dailyCheckins.checkinDate, today)
          )
        )
        .limit(1);

      const checkedInToday = todayCheckin.length > 0;
      const streakCount = await this.calculateStreakCount(userId);

      let nextCheckinAt: Date | undefined;
      if (checkedInToday) {
        nextCheckinAt = new Date();
        nextCheckinAt.setDate(nextCheckinAt.getDate() + 1);
        nextCheckinAt.setHours(0, 0, 0, 0);
      }

      // Calculate what the next reward would be
      const nextRewardStreak = checkedInToday ? streakCount + 1 : streakCount;
      const nextReward = await rewardsService.calculateDailyReward(nextRewardStreak);

      return {
        checkedInToday,
        streakCount: checkedInToday ? streakCount : Math.max(streakCount - 1, 0),
        nextReward,
        nextCheckinAt
      };
    } catch (error) {
      console.error('Error getting check-in status:', error);
      return {
        checkedInToday: false,
        streakCount: 0
      };
    }
  }

  // Get user's check-in history
  async getCheckinHistory(userId: string, limit: number = 30): Promise<Array<{
    date: string;
    reward: number;
    streakCount: number;
  }>> {
    try {
      const history = await db
        .select({
          checkinDate: dailyCheckins.checkinDate,
          streakCount: dailyCheckins.streakCount,
          tokenAmount: rewards.tokenAmount
        })
        .from(dailyCheckins)
        .leftJoin(rewards, and(
          eq(rewards.userId, dailyCheckins.userId),
          eq(rewards.rewardType, 'daily_checkin'),
          sql`DATE(${rewards.earnedDate}) = ${dailyCheckins.checkinDate}`
        ))
        .where(eq(dailyCheckins.userId, userId))
        .orderBy(desc(dailyCheckins.checkinDate))
        .limit(limit);

      return history.map(item => ({
        date: item.checkinDate,
        reward: parseFloat(item.tokenAmount || '0'),
        streakCount: item.streakCount || 1
      }));
    } catch (error) {
      console.error('Error getting check-in history:', error);
      return [];
    }
  }
}

export const dailyCheckinService = new DailyCheckinService();