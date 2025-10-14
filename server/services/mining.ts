import { db } from "../db";
import { miningSessions, miningClaims, walletAccounts, reserveTransactions, treasuryAccounts } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { treasuryService } from "./treasury";

// Mining configuration - 1728 JCMOVES per 24 hours (0.02 per second)
const MINING_CONFIG = {
  TOKENS_PER_SECOND: 0.02, // 0.02 JCMOVES per second
  TOKENS_PER_24_HOURS: 1728, // 0.02 * 60 * 60 * 24 = 1728 tokens
  CYCLE_DURATION_HOURS: 24,
  CYCLE_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

export class MiningService {
  /**
   * Start or resume mining session for a user
   */
  async startMining(userId: string): Promise<{
    session: any;
    timeRemaining: number;
    accumulatedTokens: string;
  }> {
    // Check if user already has an active session
    const existingSession = await this.getActiveSession(userId);
    
    if (existingSession) {
      // Calculate current accumulated tokens
      const accumulated = await this.calculateAccumulatedTokens(existingSession);
      const timeRemaining = this.getTimeRemaining(existingSession);
      
      return {
        session: existingSession,
        timeRemaining,
        accumulatedTokens: accumulated,
      };
    }

    // Create new mining session
    const nextClaimAt = new Date(Date.now() + MINING_CONFIG.CYCLE_DURATION_MS);
    
    const [session] = await db
      .insert(miningSessions)
      .values({
        userId,
        startTime: new Date(),
        lastClaimTime: new Date(),
        nextClaimAt,
        miningSpeed: "1.00",
        status: "active",
      })
      .returning();

    return {
      session,
      timeRemaining: MINING_CONFIG.CYCLE_DURATION_MS,
      accumulatedTokens: "0.00000000",
    };
  }

  /**
   * Get active mining session for a user
   */
  async getActiveSession(userId: string) {
    const [session] = await db
      .select()
      .from(miningSessions)
      .where(and(
        eq(miningSessions.userId, userId),
        eq(miningSessions.status, "active")
      ))
      .limit(1);

    return session || null;
  }

  /**
   * Calculate accumulated tokens since last claim
   */
  async calculateAccumulatedTokens(session: any): Promise<string> {
    const now = Date.now();
    const lastClaim = new Date(session.lastClaimTime).getTime();
    const secondsElapsed = Math.floor((now - lastClaim) / 1000);
    
    // Calculate tokens: seconds * rate * speed multiplier
    const miningSpeed = parseFloat(session.miningSpeed || "1.00");
    const tokensEarned = secondsElapsed * MINING_CONFIG.TOKENS_PER_SECOND * miningSpeed;
    
    // Add to previously accumulated tokens
    const previousAccumulated = parseFloat(session.accumulatedTokens || "0");
    const totalAccumulated = previousAccumulated + tokensEarned;
    
    // Cap at 24-hour maximum
    const maxTokens = MINING_CONFIG.TOKENS_PER_24_HOURS * miningSpeed;
    const cappedTokens = Math.min(totalAccumulated, maxTokens);
    
    return cappedTokens.toFixed(8);
  }

  /**
   * Get time remaining until next auto-claim (in milliseconds)
   */
  getTimeRemaining(session: any): number {
    const now = Date.now();
    const nextClaim = new Date(session.nextClaimAt).getTime();
    const remaining = Math.max(0, nextClaim - now);
    
    return remaining;
  }

  /**
   * Calculate streak bonus for consecutive daily claims
   * Uses same logic as daily check-in: 10% bonus per day, capped at 3x (30 days)
   */
  async calculateStreakBonus(session: any, baseTokens: number): Promise<{
    streakCount: number;
    streakBonus: number;
  }> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastClaimDate = session.lastClaimDate;
    
    let streakCount = session.streakCount || 0;
    
    if (lastClaimDate) {
      // Calculate yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Check if last claim was yesterday (streak continues)
      if (lastClaimDate === yesterdayStr) {
        streakCount += 1; // Continue streak
      } else if (lastClaimDate !== today) {
        streakCount = 1; // Reset streak (missed days)
      } else {
        // Already claimed today - shouldn't happen, but handle it
        return { streakCount, streakBonus: 0 };
      }
    } else {
      streakCount = 1; // First claim ever
    }
    
    // Calculate bonus: 10% per day, capped at 3x (200% bonus at 30 days)
    const STREAK_MULTIPLIER = 1.1; // 10% per day
    const MAX_BONUS_MULTIPLIER = 3.0; // Cap at 3x total (200% bonus)
    
    const bonusMultiplier = Math.min(
      Math.pow(STREAK_MULTIPLIER, streakCount - 1),
      MAX_BONUS_MULTIPLIER
    );
    
    // Bonus is the additional tokens beyond base (e.g., 1.21x = 0.21x bonus)
    const streakBonus = baseTokens * (bonusMultiplier - 1.0);
    
    return { streakCount, streakBonus };
  }

  /**
   * Claim accumulated tokens (manual or automatic)
   * Now includes streak bonuses for consecutive daily claims
   */
  async claimTokens(userId: string, claimType: 'auto' | 'manual' = 'manual'): Promise<{
    success: boolean;
    tokensClaimed: string;
    newBalance: string;
    streakCount?: number;
    streakBonus?: string;
    error?: string;
  }> {
    try {
      const session = await this.getActiveSession(userId);
      
      if (!session) {
        return { success: false, tokensClaimed: "0", newBalance: "0", error: "No active mining session" };
      }

      // Calculate base tokens to claim
      const baseTokensStr = await this.calculateAccumulatedTokens(session);
      const baseTokens = parseFloat(baseTokensStr);

      if (baseTokens <= 0) {
        return { success: false, tokensClaimed: "0", newBalance: "0", error: "No tokens to claim yet" };
      }

      // Calculate streak and bonus
      const { streakCount, streakBonus } = await this.calculateStreakBonus(session, baseTokens);
      const totalTokens = baseTokens + streakBonus;
      const tokensToClaim = totalTokens;

      // Get current token price for treasury deduction
      const tokenPrice = await this.getCurrentTokenPrice();

      // Check if treasury can distribute tokens
      const canDistribute = await treasuryService.canDistributeTokens(tokensToClaim);
      if (!canDistribute.canDistribute) {
        return { 
          success: false, 
          tokensClaimed: "0", 
          newBalance: "0", 
          error: canDistribute.reason || "Insufficient treasury funds" 
        };
      }

      // Distribute tokens from treasury
      const distributionResult = await treasuryService.distributeTokens(
        tokensToClaim,
        `Mining claim - ${claimType}`,
        'mining_claim',
        session.id
      );

      if (!distributionResult.success) {
        return { 
          success: false, 
          tokensClaimed: "0", 
          newBalance: "0", 
          error: distributionResult.error || "Failed to distribute tokens from treasury" 
        };
      }

      // Credit user wallet
      const [wallet] = await db
        .select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, userId))
        .limit(1);

      const currentBalance = parseFloat(wallet?.tokenBalance || "0");
      const newBalance = currentBalance + tokensToClaim;

      if (wallet) {
        await db
          .update(walletAccounts)
          .set({
            tokenBalance: newBalance.toFixed(8),
            totalEarned: sql`${walletAccounts.totalEarned} + ${tokensToClaim}`,
            lastActivity: new Date(),
          })
          .where(eq(walletAccounts.userId, userId));
      } else {
        // Create wallet if it doesn't exist
        await db.insert(walletAccounts).values({
          userId,
          tokenBalance: tokensToClaim.toFixed(8),
          totalEarned: tokensToClaim.toFixed(8),
          cashBalance: "0.00",
        });
      }

      // Record the claim
      await db.insert(miningClaims).values({
        userId,
        sessionId: session.id,
        tokenAmount: tokensToClaim.toFixed(8),
        claimType,
      });

      // Update session for next 24-hour cycle with streak tracking
      const nextClaimAt = new Date(Date.now() + MINING_CONFIG.CYCLE_DURATION_MS);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      await db
        .update(miningSessions)
        .set({
          lastClaimTime: new Date(),
          lastClaimDate: today,
          streakCount: streakCount,
          accumulatedTokens: "0.00000000",
          nextClaimAt,
          updatedAt: new Date(),
        })
        .where(eq(miningSessions.id, session.id));

      return {
        success: true,
        tokensClaimed: tokensToClaim.toFixed(8),
        newBalance: newBalance.toFixed(8),
        streakCount,
        streakBonus: streakBonus.toFixed(8),
      };
    } catch (error) {
      console.error("Error claiming mining tokens:", error);
      return {
        success: false,
        tokensClaimed: "0",
        newBalance: "0",
        error: error instanceof Error ? error.message : "Failed to claim tokens",
      };
    }
  }

  /**
   * Get current token price (from latest price history or default)
   */
  async getCurrentTokenPrice(): Promise<number> {
    try {
      const { priceHistory } = await import("@shared/schema");
      const [latestPrice] = await db
        .select()
        .from(priceHistory)
        .orderBy(sql`${priceHistory.createdAt} DESC`)
        .limit(1);

      return latestPrice ? parseFloat(latestPrice.priceUsd) : 0.00000508432;
    } catch (error) {
      console.error("Error getting token price:", error);
      return 0.00000508432; // Default fallback price
    }
  }

  /**
   * Auto-claim tokens when 24-hour timer expires
   */
  async autoClaimExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      
      // Find all sessions where next claim time has passed
      const expiredSessions = await db
        .select()
        .from(miningSessions)
        .where(and(
          eq(miningSessions.status, "active"),
          sql`${miningSessions.nextClaimAt} <= ${now}`
        ));

      // Auto-claim for each expired session
      for (const session of expiredSessions) {
        await this.claimTokens(session.userId, 'auto');
      }

      console.log(`Auto-claimed tokens for ${expiredSessions.length} expired mining sessions`);
    } catch (error) {
      console.error("Error auto-claiming expired sessions:", error);
    }
  }

  /**
   * Get mining statistics for a user
   */
  async getMiningStats(userId: string): Promise<{
    currentSession: any;
    accumulatedTokens: string;
    timeRemaining: number;
    totalClaimedToday: string;
    miningSpeed: string;
    streakCount: number;
    nextStreakBonus: string;
  }> {
    const session = await this.getActiveSession(userId);
    
    if (!session) {
      return {
        currentSession: null,
        accumulatedTokens: "0.00000000",
        timeRemaining: 0,
        totalClaimedToday: "0.00000000",
        miningSpeed: "1.00",
        streakCount: 0,
        nextStreakBonus: "0.00000000",
      };
    }

    const accumulatedTokens = await this.calculateAccumulatedTokens(session);
    const timeRemaining = this.getTimeRemaining(session);

    // Get today's total claims
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayClaims = await db
      .select()
      .from(miningClaims)
      .where(and(
        eq(miningClaims.userId, userId),
        sql`${miningClaims.claimTime} >= ${today}`
      ));

    const totalClaimedToday = todayClaims
      .reduce((sum, claim) => sum + parseFloat(claim.tokenAmount), 0)
      .toFixed(8);

    // Calculate what the next streak bonus would be
    const baseTokens = parseFloat(accumulatedTokens);
    const { streakCount, streakBonus } = await this.calculateStreakBonus(session, baseTokens);

    return {
      currentSession: session,
      accumulatedTokens,
      timeRemaining,
      totalClaimedToday,
      miningSpeed: session.miningSpeed || "1.00",
      streakCount,
      nextStreakBonus: streakBonus.toFixed(8),
    };
  }
}

export const miningService = new MiningService();
