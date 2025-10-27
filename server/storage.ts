import { type User, type InsertUser, type UpsertUser, type Lead, type InsertLead, type Contact, type InsertContact, type Notification, type InsertNotification, type TreasuryAccount, type InsertTreasuryAccount, type FundingDeposit, type InsertFundingDeposit, type ReserveTransaction, type InsertReserveTransaction, type FaucetConfig, type InsertFaucetConfig, type FaucetClaim, type InsertFaucetClaim, type FaucetWallet, type InsertFaucetWallet, type FaucetRevenue, type InsertFaucetRevenue, type EmployeeStats, type InsertEmployeeStats, type AchievementType, type EmployeeAchievement, type InsertEmployeeAchievement, type PointTransaction, type InsertPointTransaction, type WeeklyLeaderboard, type DailyCheckin, type InsertDailyCheckin, type WalletAccount, type InsertWalletAccount, type SupportedCurrency, type InsertSupportedCurrency, type UserWallet, type InsertUserWallet, type TreasuryWallet, type InsertTreasuryWallet, type WalletTransaction, type InsertWalletTransaction, type ShopItem, type InsertShopItem, leads, contacts, users, notifications, walletAccounts, rewards, treasuryAccounts, fundingDeposits, reserveTransactions, priceHistory, faucetConfig, faucetClaims, faucetWallets, faucetRevenue, employeeStats, achievementTypes, employeeAchievements, pointTransactions, weeklyLeaderboards, dailyCheckins, supportedCurrencies, userWallets, treasuryWallets, walletTransactions, shopItems, cashoutRequests, fraudLogs, helpRequests, miningSessions, miningClaims, treasuryWithdrawals } from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNull, and, isNotNull, sql, gt, gte, inArray } from "drizzle-orm";
import { TREASURY_CONFIG } from "./constants";
import { cryptoService } from "./services/crypto";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser, tokenPrice?: number, riskLimits?: { shouldHaltDistributions: boolean; maxSafeTokens: number; riskLevel: string }): Promise<User>;
  
  // User role management
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  getEmployees(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  deleteUser(userId: string): Promise<boolean>;
  
  // Employee approval management
  updateUserApproval(userId: string, isApproved: boolean): Promise<User | undefined>;
  getPendingEmployees(): Promise<User[]>;
  getApprovedEmployees(): Promise<User[]>;
  
  // User compliance (age and TOS)
  updateUserCompliance(userId: string, dateOfBirth: string, tosAccepted: boolean): Promise<User | undefined>;
  
  // Profile image upload
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User | undefined>;
  
  // Username management
  updateUsername(userId: string, username: string): Promise<User | undefined>;
  checkUsernameAvailability(username: string): Promise<boolean>;
  
  // Help request operations
  createHelpRequest(request: { userId: string; message: string; imageUrls: string[] | null }): Promise<any>;
  
  // Referral operations
  generateReferralCode(userId: string): Promise<string>;
  getReferralCode(userId: string): Promise<string | null>;
  applyReferralCode(userId: string, referralCode: string): Promise<{ success: boolean; referrerId?: string; error?: string }>;
  getReferralStats(userId: string): Promise<{ referralCount: number; totalEarned: number; referredUsers: User[] }>;
  processReferralBonus(referrerId: string, newUserId: string): Promise<{ success: boolean; error?: string }>;
  
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadsByEmail(email: string): Promise<Lead[]>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  updateLeadQuote(id: string, quoteData: any): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;
  
  // Job assignment operations
  assignLeadToEmployee(leadId: string, employeeId: string): Promise<Lead | undefined>;
  addEmployeeAcceptance(leadId: string, employeeId: string, isCrewFull: boolean): Promise<Lead | undefined>;
  getAvailableLeads(): Promise<Lead[]>; // Leads not assigned to any employee
  getAssignedLeads(employeeId: string): Promise<Lead[]>; // Leads assigned to specific employee
  
  // Photo management operations
  addJobPhoto(leadId: string, photoData: any): Promise<Lead | undefined>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationAsRead(notificationId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  updateUserPushSubscription(userId: string, subscription: any): Promise<User | undefined>;
  
  createContact(contact: InsertContact): Promise<Contact>;
  getContacts(): Promise<Contact[]>;
  
  // Shop operations
  createShopItem(item: InsertShopItem): Promise<ShopItem>;
  getShopItems(filters?: { status?: string; postedBy?: string }, limit?: number, offset?: number): Promise<ShopItem[]>;
  getShopItem(id: string): Promise<ShopItem | undefined>;
  updateShopItem(id: string, updates: Partial<Omit<ShopItem, 'id' | 'postedBy' | 'createdAt'>>): Promise<ShopItem | undefined>;
  deleteShopItem(id: string): Promise<boolean>;
  incrementShopItemViews(id: string): Promise<void>;
  
  // Treasury operations
  getTreasuryAccount(id?: string): Promise<TreasuryAccount | undefined>;
  getMainTreasuryAccount(): Promise<TreasuryAccount>;
  createFundingDeposit(deposit: InsertFundingDeposit): Promise<FundingDeposit>;
  getFundingDeposits(treasuryAccountId?: string): Promise<FundingDeposit[]>;
  updateFundingDeposit(id: string, data: { externalTransactionId?: string; moonshotMetadata?: any }): Promise<FundingDeposit | undefined>;
  createReserveTransaction(transaction: InsertReserveTransaction): Promise<ReserveTransaction>;
  getReserveTransactions(treasuryAccountId?: string, limit?: number): Promise<ReserveTransaction[]>;
  checkFundingAvailability(tokenAmount: number, tokenPrice?: number): Promise<{ available: boolean; currentBalance: number; requiredValue: number }>;
  deductFromReserve(tokenAmount: number, description: string, tokenPrice: number, relatedEntityType?: string, relatedEntityId?: string): Promise<ReserveTransaction>;
  addToReserve(tokenAmount: number, cashValue: number, description: string): Promise<ReserveTransaction>;
  atomicDepositFunds(depositedBy: string, usdAmount: number, depositMethod?: string, notes?: string): Promise<FundingDeposit>;
  
  // Faucet operations
  getFaucetConfig(currency?: string): Promise<FaucetConfig[]>;
  createFaucetConfig(config: InsertFaucetConfig): Promise<FaucetConfig>;
  updateFaucetConfig(currency: string, updates: Partial<InsertFaucetConfig>): Promise<FaucetConfig | undefined>;
  getFaucetWallet(userId: string, currency: string): Promise<FaucetWallet | undefined>;
  getFaucetWalletsByUserId(userId: string): Promise<FaucetWallet[]>;
  getFaucetWalletByUserCurrency(userId: string, currency: string): Promise<FaucetWallet | undefined>;
  createFaucetWallet(wallet: InsertFaucetWallet): Promise<FaucetWallet>;
  updateFaucetWallet(userId: string, currency: string, updates: Partial<FaucetWallet>): Promise<FaucetWallet | undefined>;
  canUserClaim(userId: string, currency: string): Promise<{ canClaim: boolean; nextClaimTime?: Date; secondsRemaining?: number }>;
  createFaucetClaim(claim: InsertFaucetClaim): Promise<FaucetClaim>;
  updateFaucetClaim(claimId: string, updates: Partial<FaucetClaim>): Promise<FaucetClaim | undefined>;
  getFaucetClaims(userId?: string, currency?: string, limit?: number): Promise<FaucetClaim[]>;
  getRecentFaucetClaims(userId: string, hours: number): Promise<FaucetClaim[]>;
  getFaucetClaimsSince(userId: string, date: Date): Promise<FaucetClaim[]>;
  getFaucetClaimsByIP(ipAddress: string, hours: number): Promise<FaucetClaim[]>;
  getFaucetRevenue(date?: string, currency?: string): Promise<FaucetRevenue[]>;
  updateFaucetRevenue(date: string, currency: string, updates: Partial<FaucetRevenue>): Promise<FaucetRevenue>;

  // Gamification operations
  getEmployeeStats(userId: string): Promise<EmployeeStats | undefined>;
  createEmployeeStats(stats: InsertEmployeeStats): Promise<EmployeeStats>;
  updateEmployeeStats(userId: string, updates: Partial<EmployeeStats>): Promise<EmployeeStats | undefined>;
  getTodayCheckIn(userId: string, date: string): Promise<DailyCheckin | undefined>;
  getLastCheckIn(userId: string): Promise<DailyCheckin | undefined>;
  getRecentCheckIn(userId: string, sinceDate: Date): Promise<DailyCheckin | undefined>;
  createDailyCheckIn(checkin: InsertDailyCheckin): Promise<DailyCheckin>;
  createPointTransaction(transaction: InsertPointTransaction): Promise<PointTransaction>;
  createReward(reward: InsertReward): Promise<Reward>;
  getEmployeeAchievements(userId: string, limit?: number): Promise<(EmployeeAchievement & { achievementType: AchievementType })[]>;
  getUserAchievement(userId: string, achievementTypeId: string): Promise<EmployeeAchievement | undefined>;
  createEmployeeAchievement(achievement: InsertEmployeeAchievement): Promise<EmployeeAchievement>;
  getAchievementByKey(key: string): Promise<AchievementType | undefined>;
  getWeeklyLeaderboard(limit?: number): Promise<WeeklyLeaderboard[]>;
  getWeeklyRank(userId: string): Promise<{ rank: number; totalEmployees: number; weeklyPoints: number } | null>;
  getWalletAccount(userId: string): Promise<WalletAccount | undefined>;
  createWalletAccount(wallet: InsertWalletAccount): Promise<WalletAccount>;
  updateWalletAccount(userId: string, updates: Partial<WalletAccount>): Promise<void>;
  awardJobCompletionTokens(userId: string, tokenAmount: number, jobId: string): Promise<void>;
  
  // Multi-currency wallet operations
  getSupportedCurrencies(): Promise<SupportedCurrency[]>;
  getSupportedCurrencyBySymbol(symbol: string): Promise<SupportedCurrency | undefined>;
  createSupportedCurrency(currency: InsertSupportedCurrency): Promise<SupportedCurrency>;
  getUserWallet(userId: string, currencyId: string): Promise<UserWallet | undefined>;
  getUserWalletById(walletId: string): Promise<UserWallet | undefined>;
  getUserWalletsWithCurrency(userId: string): Promise<(UserWallet & { currency: SupportedCurrency })[]>;
  createUserWallet(wallet: InsertUserWallet): Promise<UserWallet>;
  updateUserWalletBalance(walletId: string, newBalance: string): Promise<void>;
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;
  getWalletTransactions(walletId: string, limit?: number): Promise<WalletTransaction[]>;
  
  // Treasury wallet operations
  getTreasuryWallets(roleScope?: string): Promise<(TreasuryWallet & { currency: SupportedCurrency })[]>;
  getTreasuryWallet(currencyId: string, purpose?: string): Promise<TreasuryWallet | undefined>;
  updateTreasuryWalletBalance(walletId: string, newBalance: string): Promise<void>;
  
  // Price history operations
  addPricePoint(priceUsd: string, source: string, marketData?: any): Promise<void>;
  getPriceHistory(hours?: number): Promise<Array<{ timestamp: Date; price: number; source: string }>>;
  cleanOldPriceData(daysToKeep: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    console.log('Attempting to upsert user:', userData.email);
    
    try {
      // Simple upsert - either create new user or update existing one
      const [user] = await db
        .insert(users)
        .values({
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: 'employee', // Default role for new users - admin access must be granted explicitly
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();
      
      console.log('User upserted successfully:', user.email, 'with ID:', user.id);
      return user;
    } catch (error) {
      console.error('Failed to upsert user:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async getLeads(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await db.delete(leads).where(eq(leads.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getLeadsByEmail(email: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .orderBy(desc(leads.createdAt));
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.status, status))
      .orderBy(desc(leads.lastQuoteUpdatedAt), desc(leads.createdAt));
  }

  async updateLeadStatus(id: string, status: string): Promise<Lead | undefined> {
    let updateData: any = { status };
    
    // Coordinate status with assignment state to maintain consistency
    if (status === 'available') {
      // If setting to available, clear any existing assignment
      updateData.assignedToUserId = null;
    } else if (status === 'accepted') {
      // Don't allow manual setting to accepted without assignment - this should only be done via job acceptance
      const [currentLead] = await db.select().from(leads).where(eq(leads.id, id));
      if (!currentLead?.assignedToUserId) {
        throw new Error("Cannot set status to 'accepted' without an assigned employee. Use the job acceptance workflow instead.");
      }
    }
    
    const [lead] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async updateLeadQuote(id: string, quoteData: any): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set(quoteData)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  // User role management
  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, 'employee'))
      .orderBy(users.firstName, users.lastName);
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      // Cascade delete all related records first to avoid foreign key constraint violations
      console.log(`🗑️ Starting cascade delete for user ${userId}...`);
      
      // Get user's mining session IDs first (for deleting mining claims)
      const miningSess = await db.select({ id: miningSessions.id })
        .from(miningSessions)
        .where(eq(miningSessions.userId, userId));
      const miningSessionIds = miningSess.map(s => s.id);
      
      // Delete mining claims for user's sessions
      if (miningSessionIds.length > 0) {
        await db.delete(miningClaims).where(
          inArray(miningClaims.sessionId, miningSessionIds)
        );
        console.log(`  ✓ Deleted mining claims for user ${userId}`);
      }
      
      // Delete mining sessions
      await db.delete(miningSessions).where(eq(miningSessions.userId, userId));
      console.log(`  ✓ Deleted mining sessions for user ${userId}`);
      
      // Get user's wallet IDs first (for deleting wallet transactions)
      const userWalletList = await db.select({ id: userWallets.id })
        .from(userWallets)
        .where(eq(userWallets.userId, userId));
      const userWalletIds = userWalletList.map(w => w.id);
      
      // Delete wallet transactions for user's wallets
      if (userWalletIds.length > 0) {
        await db.delete(walletTransactions).where(
          inArray(walletTransactions.userWalletId, userWalletIds)
        );
        console.log(`  ✓ Deleted wallet transactions for user ${userId}`);
      }
      
      // Delete user wallets
      await db.delete(userWallets).where(eq(userWallets.userId, userId));
      console.log(`  ✓ Deleted user wallets for user ${userId}`);
      
      // Delete cashout requests
      await db.delete(cashoutRequests).where(eq(cashoutRequests.userId, userId));
      console.log(`  ✓ Deleted cashout requests for user ${userId}`);
      
      // Delete help requests
      await db.delete(helpRequests).where(eq(helpRequests.userId, userId));
      console.log(`  ✓ Deleted help requests for user ${userId}`);
      
      // Delete shop items posted by user
      await db.delete(shopItems).where(eq(shopItems.postedBy, userId));
      console.log(`  ✓ Deleted shop items for user ${userId}`);
      
      // Delete treasury withdrawals requested by user
      await db.delete(treasuryWithdrawals).where(eq(treasuryWithdrawals.requestedBy, userId));
      console.log(`  ✓ Deleted treasury withdrawals for user ${userId}`);
      
      // Nullify managedByUserId in treasury wallets (optional field)
      await db.update(treasuryWallets).set({ managedByUserId: null }).where(eq(treasuryWallets.managedByUserId, userId));
      console.log(`  ✓ Nullified treasury wallet manager references for user ${userId}`);
      
      // Nullify depositedBy in funding deposits (keep deposit history)
      await db.update(fundingDeposits).set({ depositedBy: null }).where(eq(fundingDeposits.depositedBy, userId));
      console.log(`  ✓ Nullified funding deposit references for user ${userId}`);
      
      // Nullify userId in fraud logs (keep fraud history but anonymize)
      await db.update(fraudLogs).set({ userId: null }).where(eq(fraudLogs.userId, userId));
      console.log(`  ✓ Anonymized fraud logs for user ${userId}`);
      
      // Delete notifications
      await db.delete(notifications).where(eq(notifications.userId, userId));
      console.log(`  ✓ Deleted notifications for user ${userId}`);
      
      // Delete rewards
      await db.delete(rewards).where(eq(rewards.userId, userId));
      console.log(`  ✓ Deleted rewards for user ${userId}`);
      
      // Delete wallet account (legacy JCMOVES wallet)
      await db.delete(walletAccounts).where(eq(walletAccounts.userId, userId));
      console.log(`  ✓ Deleted wallet account for user ${userId}`);
      
      // Delete daily check-ins
      await db.delete(dailyCheckins).where(eq(dailyCheckins.userId, userId));
      console.log(`  ✓ Deleted daily check-ins for user ${userId}`);
      
      // Delete employee stats
      await db.delete(employeeStats).where(eq(employeeStats.userId, userId));
      console.log(`  ✓ Deleted employee stats for user ${userId}`);
      
      // Delete employee achievements
      await db.delete(employeeAchievements).where(eq(employeeAchievements.userId, userId));
      console.log(`  ✓ Deleted employee achievements for user ${userId}`);
      
      // Delete point transactions
      await db.delete(pointTransactions).where(eq(pointTransactions.userId, userId));
      console.log(`  ✓ Deleted point transactions for user ${userId}`);
      
      // Unassign user from leads (set assignedToUserId to null)
      await db.update(leads).set({ assignedToUserId: null }).where(eq(leads.assignedToUserId, userId));
      console.log(`  ✓ Unassigned leads for user ${userId}`);
      
      // Set createdByUserId to null for leads created by this user
      await db.update(leads).set({ createdByUserId: null }).where(eq(leads.createdByUserId, userId));
      console.log(`  ✓ Nullified created-by reference for leads by user ${userId}`);
      
      // Finally, delete the user
      const result = await db.delete(users).where(eq(users.id, userId));
      console.log(`  ✓ Deleted user ${userId}`);
      
      console.log(`✅ Cascade delete completed for user ${userId}`);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error(`❌ Error during cascade delete for user ${userId}:`, error);
      throw error;
    }
  }

  // Employee approval management
  async updateUserApproval(userId: string, isApproved: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isApproved, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  // User compliance (age and TOS)
  async updateUserCompliance(userId: string, dateOfBirth: string, tosAccepted: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        dateOfBirth, 
        tosAccepted, 
        tosAcceptedAt: tosAccepted ? new Date() : null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        profileImageUrl,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async updateUsername(userId: string, username: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .update(users)
        .set({ 
          username,
          updatedAt: new Date() 
        })
        .where(eq(users.id, userId))
        .returning();
      return user || undefined;
    } catch (error: any) {
      // Handle unique constraint violation (error code 23505 in PostgreSQL)
      if (error.code === '23505' && error.constraint === 'users_username_unique') {
        throw new Error('USERNAME_TAKEN');
      }
      throw error;
    }
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return existingUser.length === 0;
  }

  async createHelpRequest(request: { userId: string; message: string; imageUrls: string[] | null }): Promise<any> {
    const { helpRequests } = await import("@shared/schema");
    const [helpRequest] = await db
      .insert(helpRequests)
      .values({
        userId: request.userId,
        message: request.message,
        imageUrls: request.imageUrls,
      })
      .returning();
    return helpRequest;
  }

  async getPendingEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'employee'), eq(users.isApproved, false)))
      .orderBy(desc(users.createdAt));
  }

  async getApprovedEmployees(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'employee'), eq(users.isApproved, true)))
      .orderBy(users.firstName, users.lastName);
  }

  // Referral operations
  async generateReferralCode(userId: string): Promise<string> {
    // Check if user already has a referral code
    const existingCode = await this.getReferralCode(userId);
    if (existingCode) {
      return existingCode;
    }

    // Generate a unique referral code
    let referralCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Generate 8-character alphanumeric code
      referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      attempts++;

      // Check if code is unique
      const [existingUser] = await db.select().from(users).where(eq(users.referralCode, referralCode));
      if (!existingUser) {
        break;
      }
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw new Error('Unable to generate unique referral code');
    }

    // Update user with referral code
    await db
      .update(users)
      .set({ referralCode, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return referralCode;
  }

  async getReferralCode(userId: string): Promise<string | null> {
    const [user] = await db.select({ referralCode: users.referralCode }).from(users).where(eq(users.id, userId));
    return user?.referralCode || null;
  }

  async applyReferralCode(userId: string, referralCode: string): Promise<{ success: boolean; referrerId?: string; error?: string }> {
    // Find the referrer by referral code
    const [referrer] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    if (!referrer) {
      return { success: false, error: 'Invalid referral code' };
    }

    // Check if user is trying to refer themselves
    if (referrer.id === userId) {
      return { success: false, error: 'Cannot use your own referral code' };
    }

    // Check if user was already referred
    const [currentUser] = await db.select({ referredByUserId: users.referredByUserId }).from(users).where(eq(users.id, userId));
    if (currentUser?.referredByUserId) {
      return { success: false, error: 'You have already been referred by someone else' };
    }

    // Apply the referral
    await db
      .update(users)
      .set({ referredByUserId: referrer.id, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, referrerId: referrer.id };
  }

  async getReferralStats(userId: string): Promise<{ referralCount: number; totalEarned: number; referredUsers: User[] }> {
    // Get users referred by this user
    const referredUsers = await db
      .select()
      .from(users)
      .where(eq(users.referredByUserId, userId))
      .orderBy(desc(users.createdAt));

    // Get total earnings from referral rewards
    const referralRewards = await db
      .select()
      .from(rewards)
      .where(and(
        eq(rewards.userId, userId),
        eq(rewards.rewardType, 'referral_bonus')
      ));

    const totalEarned = referralRewards.reduce((sum, reward) => sum + parseFloat(reward.cashValue), 0);

    return {
      referralCount: referredUsers.length,
      totalEarned,
      referredUsers
    };
  }

  // Admin referral management functions
  async getAllReferralStats(): Promise<{ totalReferrals: number; totalRewardsPaid: number; topReferrers: any[]; recentActivity: any[] }> {
    // Get total referral count across all users
    const totalReferralsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(isNotNull(users.referredByUserId));
    
    const totalReferrals = totalReferralsResult[0]?.count || 0;

    // Get total rewards paid for referrals
    const totalRewardsResult = await db
      .select({ 
        totalPaid: sql<string>`coalesce(sum(cast(${rewards.cashValue} as decimal)), 0)` 
      })
      .from(rewards)
      .where(eq(rewards.rewardType, 'referral_bonus'));
    
    const totalRewardsPaid = parseFloat(totalRewardsResult[0]?.totalPaid || '0');

    // Get top referrers (users with most successful referrals)
    const topReferrers = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        referralCount: users.referralCount,
        totalEarned: sql<string>`coalesce(sum(cast(${rewards.cashValue} as decimal)), 0)`
      })
      .from(users)
      .leftJoin(rewards, and(
        eq(rewards.userId, users.id),
        eq(rewards.rewardType, 'referral_bonus')
      ))
      .where(gt(users.referralCount, 0))
      .groupBy(users.id, users.email, users.firstName, users.lastName, users.referralCount)
      .orderBy(desc(users.referralCount))
      .limit(10);

    // Get recent referral activity
    const referredUsers = users; // Create alias for joined table
    const recentActivity = await db
      .select({
        referrerId: users.id,
        referrerEmail: users.email,
        referrerName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        newUserId: referredUsers.id,
        newUserEmail: referredUsers.email,
        newUserName: sql<string>`concat(${referredUsers.firstName}, ' ', ${referredUsers.lastName})`,
        createdAt: referredUsers.createdAt
      })
      .from(users)
      .innerJoin(referredUsers, eq(referredUsers.referredByUserId, users.id))
      .orderBy(desc(referredUsers.createdAt))
      .limit(20);

    return {
      totalReferrals,
      totalRewardsPaid,
      topReferrers,
      recentActivity
    };
  }

  async getUserInvitationQuota(userId: string): Promise<{ dailyLimit: number; weeklyLimit: number; monthlyLimit: number; dailyUsed: number; weeklyUsed: number; monthlyUsed: number }> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');

    // Set limits based on user role
    let dailyLimit = 3; // Default for employees
    let weeklyLimit = 15;
    let monthlyLimit = 50;

    // Admin has high-level access
    if (user.role === 'admin') {
      dailyLimit = 50;
      weeklyLimit = 200;
      monthlyLimit = 500;
    }

    // Calculate usage for different time periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count successful referrals in each period
    const dailyUsedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        eq(users.referredByUserId, userId),
        gte(users.createdAt, today)
      ));
    
    const weeklyUsedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        eq(users.referredByUserId, userId),
        gte(users.createdAt, weekStart)
      ));
    
    const monthlyUsedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        eq(users.referredByUserId, userId),
        gte(users.createdAt, monthStart)
      ));

    return {
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      dailyUsed: dailyUsedResult[0]?.count || 0,
      weeklyUsed: weeklyUsedResult[0]?.count || 0,
      monthlyUsed: monthlyUsedResult[0]?.count || 0
    };
  }

  async canUserInvite(userId: string): Promise<{ canInvite: boolean; reason?: string; quotas?: any }> {
    try {
      const quotas = await this.getUserInvitationQuota(userId);
      
      // Check if user has exceeded any limits
      if (quotas.dailyUsed >= quotas.dailyLimit) {
        return {
          canInvite: false,
          reason: `Daily invitation limit reached (${quotas.dailyLimit})`,
          quotas
        };
      }
      
      if (quotas.weeklyUsed >= quotas.weeklyLimit) {
        return {
          canInvite: false,
          reason: `Weekly invitation limit reached (${quotas.weeklyLimit})`,
          quotas
        };
      }
      
      if (quotas.monthlyUsed >= quotas.monthlyLimit) {
        return {
          canInvite: false,
          reason: `Monthly invitation limit reached (${quotas.monthlyLimit})`,
          quotas
        };
      }

      return {
        canInvite: true,
        quotas
      };
    } catch (error) {
      return {
        canInvite: false,
        reason: 'Error checking invitation permissions'
      };
    }
  }

  async processReferralBonus(referrerId: string, newUserId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Import here to avoid circular dependency
      const { treasuryService } = await import('./services/treasury');
      const { rewardsService } = await import('./services/rewards');

      // Calculate referral reward
      const rewardCalc = await rewardsService.calculateReferralReward();

      // Distribute tokens from treasury
      const distribution = await treasuryService.distributeTokens(
        rewardCalc.tokenAmount,
        `Referral bonus for referring user ${newUserId}`,
        'referral_bonus',
        newUserId
      );

      if (!distribution.success) {
        return { success: false, error: distribution.error };
      }

      // Update wallet and create reward record
      await db.transaction(async (tx) => {
        // Get current wallet state first
        const [currentWallet] = await tx.select().from(walletAccounts).where(eq(walletAccounts.userId, referrerId));
        
        // Update referrer's wallet
        await tx
          .update(walletAccounts)
          .set({
            tokenBalance: `${parseFloat(currentWallet.tokenBalance || '0') + rewardCalc.tokenAmount}`,
            totalEarned: `${parseFloat(currentWallet.totalEarned || '0') + rewardCalc.tokenAmount}`,
            lastActivity: new Date()
          })
          .where(eq(walletAccounts.userId, referrerId));

        // Create reward record
        await tx.insert(rewards).values({
          userId: referrerId,
          rewardType: 'referral_bonus',
          tokenAmount: rewardCalc.tokenAmount.toFixed(8),
          cashValue: rewardCalc.cashValue.toFixed(2),
          status: 'confirmed',
          earnedDate: new Date(),
          referenceId: newUserId,
          metadata: { referredUserId: newUserId }
        });

        // Update referrer's referral count
        const [currentUser] = await tx.select({ referralCount: users.referralCount }).from(users).where(eq(users.id, referrerId));
        await tx
          .update(users)
          .set({
            referralCount: (currentUser?.referralCount || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(users.id, referrerId));
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing referral bonus:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Job assignment operations
  async assignLeadToEmployee(leadId: string, employeeId: string): Promise<Lead | undefined> {
    // Atomic update - only assign if not already assigned
    const [lead] = await db
      .update(leads)
      .set({ 
        assignedToUserId: employeeId,
        status: 'accepted'
      })
      .where(and(
        eq(leads.id, leadId),
        isNull(leads.assignedToUserId)
      ))
      .returning();
    return lead || undefined;
  }

  async addEmployeeAcceptance(leadId: string, employeeId: string, isCrewFull: boolean): Promise<Lead | undefined> {
    // Get current lead to append to acceptedByEmployees
    const currentLead = await this.getLead(leadId);
    if (!currentLead) return undefined;

    const acceptedByEmployees = currentLead.acceptedByEmployees || [];
    const updatedAcceptedBy = [...acceptedByEmployees, employeeId];

    // If crew is full, set status to 'accepted' and populate crewMembers
    const updates: any = {
      acceptedByEmployees: updatedAcceptedBy,
    };

    if (isCrewFull) {
      updates.status = 'accepted';
      updates.crewMembers = updatedAcceptedBy;
      updates.assignedToUserId = updatedAcceptedBy[0]; // First employee who accepted
    }

    const [lead] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, leadId))
      .returning();
    
    return lead || undefined;
  }

  async getAvailableLeads(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(isNull(leads.assignedToUserId))
      .orderBy(desc(leads.createdAt));
  }

  async getAssignedLeads(employeeId: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.assignedToUserId, employeeId))
      .orderBy(desc(leads.createdAt));
  }

  async addJobPhoto(leadId: string, photoData: any): Promise<Lead | undefined> {
    // Add photo to lead's photos array using proper JSONB array operations
    const [lead] = await db
      .update(leads)
      .set({
        photos: sql`COALESCE(photos, '[]'::jsonb) || jsonb_build_array(${JSON.stringify(photoData)}::jsonb)`
      })
      .where(eq(leads.id, leadId))
      .returning();
    return lead || undefined;
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [notif] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return notif;
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId))
      .returning();
    return notification || undefined;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return result[0]?.count || 0;
  }

  async updateUserPushSubscription(userId: string, subscription: any): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ pushSubscription: subscription })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db
      .insert(contacts)
      .values(insertContact)
      .returning();
    return contact;
  }

  async getContacts(): Promise<Contact[]> {
    return await db
      .select()
      .from(contacts)
      .orderBy(desc(contacts.createdAt));
  }

  // Shop operations
  async createShopItem(item: InsertShopItem): Promise<ShopItem> {
    const [shopItem] = await db
      .insert(shopItems)
      .values(item)
      .returning();
    return shopItem;
  }

  async getShopItems(filters?: { status?: string; postedBy?: string }, limit: number = 20, offset: number = 0): Promise<ShopItem[]> {
    let query = db.select().from(shopItems);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(shopItems.status, filters.status));
    }
    if (filters?.postedBy) {
      conditions.push(eq(shopItems.postedBy, filters.postedBy));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query
      .orderBy(desc(shopItems.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getShopItem(id: string): Promise<ShopItem | undefined> {
    const [item] = await db
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, id));
    return item || undefined;
  }

  async updateShopItem(id: string, updates: Partial<Omit<ShopItem, 'id' | 'postedBy' | 'createdAt'>>): Promise<ShopItem | undefined> {
    const [updated] = await db
      .update(shopItems)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(shopItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShopItem(id: string): Promise<boolean> {
    const result = await db
      .delete(shopItems)
      .where(eq(shopItems.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async incrementShopItemViews(id: string): Promise<void> {
    await db
      .update(shopItems)
      .set({
        views: sql`${shopItems.views} + 1`,
      })
      .where(eq(shopItems.id, id));
  }

  // Treasury operations
  async getTreasuryAccount(id?: string): Promise<TreasuryAccount | undefined> {
    if (id) {
      const [account] = await db.select().from(treasuryAccounts).where(eq(treasuryAccounts.id, id));
      return account || undefined;
    }
    // If no ID provided, return the main treasury account
    return this.getMainTreasuryAccount();
  }

  async getMainTreasuryAccount(): Promise<TreasuryAccount> {
    // Get the main treasury account (create if doesn't exist)
    let [account] = await db
      .select()
      .from(treasuryAccounts)
      .where(eq(treasuryAccounts.isActive, true))
      .orderBy(treasuryAccounts.createdAt)
      .limit(1); // Ensure deterministic selection
    
    if (!account) {
      // Bootstrap treasury account if none exists (use transaction for safety)
      console.log("No treasury account found - creating main treasury account");
      await db.transaction(async (tx) => {
        // Check again within transaction to prevent race condition
        const [existing] = await tx
          .select()
          .from(treasuryAccounts)
          .where(eq(treasuryAccounts.isActive, true))
          .limit(1);
          
        if (!existing) {
          [account] = await tx
            .insert(treasuryAccounts)
            .values({
              accountName: "Main Treasury",
              totalFunding: "0.00",
              totalDistributed: "0.00", 
              availableFunding: "0.00",
              tokenReserve: "0.00000000",
              isActive: true
            })
            .returning();
        } else {
          account = existing;
        }
      });
      
      if (!account) {
        throw new Error("Failed to create or find main treasury account");
      }
    }
    return account;
  }

  async createFundingDeposit(deposit: InsertFundingDeposit): Promise<FundingDeposit> {
    const [newDeposit] = await db
      .insert(fundingDeposits)
      .values(deposit)
      .returning();
    return newDeposit;
  }

  async updateFundingDeposit(id: string, data: { externalTransactionId?: string; moonshotMetadata?: any }): Promise<FundingDeposit | undefined> {
    const [result] = await db
      .update(fundingDeposits)
      .set(data)
      .where(eq(fundingDeposits.id, id))
      .returning();
    return result || undefined;
  }

  async getFundingDeposits(treasuryAccountId?: string): Promise<FundingDeposit[]> {
    if (treasuryAccountId) {
      return await db
        .select()
        .from(fundingDeposits)
        .where(eq(fundingDeposits.treasuryAccountId, treasuryAccountId))
        .orderBy(desc(fundingDeposits.createdAt));
    }
    return await db
      .select()
      .from(fundingDeposits)
      .orderBy(desc(fundingDeposits.createdAt));
  }

  async createReserveTransaction(transaction: InsertReserveTransaction): Promise<ReserveTransaction> {
    const [newTransaction] = await db
      .insert(reserveTransactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async getReserveTransactions(treasuryAccountId?: string, limit?: number): Promise<ReserveTransaction[]> {
    let query = db
      .select()
      .from(reserveTransactions);

    if (treasuryAccountId) {
      query = query.where(eq(reserveTransactions.treasuryAccountId, treasuryAccountId)) as typeof query;
    }

    query = query.orderBy(desc(reserveTransactions.createdAt)) as typeof query;

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    return await query;
  }

  async checkFundingAvailability(tokenAmount: number, tokenPrice?: number): Promise<{ available: boolean; currentBalance: number; requiredValue: number }> {
    const treasury = await this.getMainTreasuryAccount();
    // Calculate actual available funding from totalFunding - totalDistributed
    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const currentBalance = totalFunding - totalDistributed;
    // Use provided crypto price or fallback to fixed price
    const price = tokenPrice ?? TREASURY_CONFIG.FALLBACK_TOKEN_PRICE;
    const requiredValue = tokenAmount * price;

    return {
      available: currentBalance >= requiredValue,
      currentBalance,
      requiredValue
    };
  }

  async deductFromReserve(tokenAmount: number, description: string, tokenPrice: number, relatedEntityType?: string, relatedEntityId?: string): Promise<ReserveTransaction> {
    // CRITICAL: Universal circuit breaker enforcement - NO distribution can bypass this
    try {
      const volatilityCheck = await cryptoService.checkPriceVolatility();
      
      // Extreme volatility halt (>20% price change)
      if (Math.abs(volatilityCheck.changePercent) > 20) {
        throw new Error(`Distribution HALTED due to extreme market volatility: ${volatilityCheck.changePercent.toFixed(2)}% price change detected. Distribution blocked for safety.`);
      }
      
      // High volatility limits (>10% price change) 
      if (Math.abs(volatilityCheck.changePercent) > 10) {
        const maxSafeTokens = 500; // Conservative limit for high volatility
        if (tokenAmount > maxSafeTokens) {
          throw new Error(`Distribution amount (${tokenAmount.toLocaleString()} tokens) exceeds safe limit (${maxSafeTokens.toLocaleString()} tokens) due to high market volatility (${volatilityCheck.changePercent.toFixed(2)}%).`);
        }
      }
      
      // Medium volatility limits (>5% price change)
      else if (Math.abs(volatilityCheck.changePercent) > 5) {
        const maxSafeTokens = 1000; // Moderate limit for medium volatility
        if (tokenAmount > maxSafeTokens) {
          throw new Error(`Distribution amount (${tokenAmount.toLocaleString()} tokens) exceeds safe limit (${maxSafeTokens.toLocaleString()} tokens) due to medium market volatility (${volatilityCheck.changePercent.toFixed(2)}%).`);
        }
      }
      
    } catch (volatilityError: unknown) {
      // CRITICAL: Fail-safe behavior - if volatility check fails, HALT all distributions
      if (volatilityError instanceof Error && volatilityError.message && volatilityError.message.includes('Distribution HALTED')) {
        throw volatilityError; // Re-throw volatility halt errors
      }
      console.error('Volatility check failed for treasury distribution - HALTING as safety measure:', volatilityError);
      throw new Error('Distribution HALTED due to market data unavailability. This is a safety measure to prevent distributions during uncertain market conditions.');
    }

    const cashValue = tokenAmount * tokenPrice;

    return await db.transaction(async (tx) => {
      // Lock and get current treasury state
      const [treasury] = await tx
        .select()
        .from(treasuryAccounts)
        .where(eq(treasuryAccounts.isActive, true))
        .orderBy(treasuryAccounts.createdAt)
        .limit(1)
        .for('update'); // Row-level lock to prevent race conditions

      if (!treasury) {
        throw new Error("No active treasury account found");
      }

      // Calculate actual available funding from totalFunding - totalDistributed
      const totalFunding = parseFloat(treasury.totalFunding);
      const totalDistributed = parseFloat(treasury.totalDistributed);
      const currentBalance = totalFunding - totalDistributed;
      const currentTokenReserve = parseFloat(treasury.tokenReserve);
      const minimumBalance = TREASURY_CONFIG.MINIMUM_BALANCE;

      // Check funding availability with safety buffer
      if (currentBalance < cashValue) {
        throw new Error(`Insufficient funding. Required: $${cashValue.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
      }

      if (currentTokenReserve < tokenAmount) {
        throw new Error(`Insufficient token reserve. Required: ${tokenAmount} tokens, Available: ${currentTokenReserve.toFixed(8)} tokens`);
      }

      const newBalance = currentBalance - cashValue;
      
      // Enforce minimum balance safety rule at transaction level
      if (newBalance < minimumBalance) {
        throw new Error(`Distribution would leave balance below minimum threshold ($${minimumBalance}). Remaining would be: $${newBalance.toFixed(2)}`);
      }

      const newTokenReserve = currentTokenReserve - tokenAmount;

      // Update treasury account with locked row
      // Note: availableFunding is kept at historical book value ($0.00), actual balance is calculated as totalFunding - totalDistributed
      await tx
        .update(treasuryAccounts)
        .set({
          tokenReserve: newTokenReserve.toFixed(8),
          totalDistributed: (parseFloat(treasury.totalDistributed) + cashValue).toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(treasuryAccounts.id, treasury.id));

      // Create reserve transaction record
      const [transaction] = await tx
        .insert(reserveTransactions)
        .values({
          treasuryAccountId: treasury.id,
          transactionType: 'distribution',
          relatedEntityType,
          relatedEntityId,
          tokenAmount: tokenAmount.toFixed(8),
          cashValue: cashValue.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          tokenReserveAfter: newTokenReserve.toFixed(8),
          description
        })
        .returning();

      return transaction;
    });
  }

  async addToReserve(tokenAmount: number, cashValue: number, description: string): Promise<ReserveTransaction> {
    return await db.transaction(async (tx) => {
      // Lock and get current treasury state
      const [treasury] = await tx
        .select()
        .from(treasuryAccounts)
        .where(eq(treasuryAccounts.isActive, true))
        .orderBy(treasuryAccounts.createdAt)
        .limit(1)
        .for('update'); // Row-level lock to prevent race conditions

      if (!treasury) {
        throw new Error("No active treasury account found");
      }

      // Calculate new balances (availableFunding is kept at historical book value, actual balance is totalFunding - totalDistributed)
      const totalFunding = parseFloat(treasury.totalFunding);
      const totalDistributed = parseFloat(treasury.totalDistributed);
      const newBalance = (totalFunding + cashValue) - totalDistributed;
      const newTokenReserve = parseFloat(treasury.tokenReserve) + tokenAmount;

      // Update treasury account with locked row
      // Note: availableFunding is kept at historical book value, only totalFunding is updated
      await tx
        .update(treasuryAccounts)
        .set({
          tokenReserve: newTokenReserve.toFixed(8),
          totalFunding: (parseFloat(treasury.totalFunding) + cashValue).toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(treasuryAccounts.id, treasury.id));

      // Create reserve transaction record
      const [transaction] = await tx
        .insert(reserveTransactions)
        .values({
          treasuryAccountId: treasury.id,
          transactionType: 'deposit',
          tokenAmount: tokenAmount.toFixed(8),
          cashValue: cashValue.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          tokenReserveAfter: newTokenReserve.toFixed(8),
          description
        })
        .returning();

      return transaction;
    });
  }

  async atomicDepositFunds(depositedBy: string, usdAmount: number, depositMethod: string = 'manual', notes?: string): Promise<FundingDeposit> {
    const tokensPurchased = usdAmount / TREASURY_CONFIG.FALLBACK_TOKEN_PRICE;
    
    return await db.transaction(async (tx) => {
      // Lock treasury account for update
      const [treasury] = await tx
        .select()
        .from(treasuryAccounts)
        .where(eq(treasuryAccounts.isActive, true))
        .orderBy(treasuryAccounts.createdAt)
        .limit(1)
        .for('update');

      if (!treasury) {
        throw new Error("No active treasury account found");
      }

      // Create funding deposit record
      const [deposit] = await tx
        .insert(fundingDeposits)
        .values({
          treasuryAccountId: treasury.id,
          depositedBy,
          depositAmount: usdAmount.toFixed(2),
          tokensPurchased: tokensPurchased.toFixed(8),
          tokenPrice: TREASURY_CONFIG.FALLBACK_TOKEN_PRICE.toFixed(8),
          depositMethod,
          status: 'completed',
          notes
        })
        .returning();

      // Update treasury balances
      // Calculate actual balance for transaction record (availableFunding is kept at historical book value)
      const totalFunding = parseFloat(treasury.totalFunding);
      const totalDistributed = parseFloat(treasury.totalDistributed);
      const newBalance = (totalFunding + usdAmount) - totalDistributed;
      const newTokenReserve = parseFloat(treasury.tokenReserve) + tokensPurchased;

      await tx
        .update(treasuryAccounts)
        .set({
          tokenReserve: newTokenReserve.toFixed(8),
          totalFunding: (parseFloat(treasury.totalFunding) + usdAmount).toFixed(2),
          updatedAt: new Date()
        })
        .where(eq(treasuryAccounts.id, treasury.id));

      // Create reserve transaction record
      await tx
        .insert(reserveTransactions)
        .values({
          treasuryAccountId: treasury.id,
          transactionType: 'deposit',
          relatedEntityType: 'funding_deposit',
          relatedEntityId: deposit.id,
          tokenAmount: tokensPurchased.toFixed(8),
          cashValue: usdAmount.toFixed(2),
          balanceAfter: newBalance.toFixed(2),
          tokenReserveAfter: newTokenReserve.toFixed(8),
          description: `Funding deposit: $${usdAmount.toFixed(2)} (${tokensPurchased.toFixed(0)} tokens)`
        });

      return deposit;
    });
  }

  // Faucet operations implementation
  async getFaucetConfig(currency?: string): Promise<FaucetConfig[]> {
    if (currency) {
      const [config] = await db.select().from(faucetConfig).where(eq(faucetConfig.currency, currency));
      return config ? [config] : [];
    }
    return await db.select().from(faucetConfig).orderBy(faucetConfig.currency);
  }

  async createFaucetConfig(config: InsertFaucetConfig): Promise<FaucetConfig> {
    const [newConfig] = await db.insert(faucetConfig).values(config).returning();
    return newConfig;
  }

  async updateFaucetConfig(currency: string, updates: Partial<InsertFaucetConfig>): Promise<FaucetConfig | undefined> {
    const [updated] = await db
      .update(faucetConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(faucetConfig.currency, currency))
      .returning();
    return updated;
  }

  async getFaucetWallet(userId: string, currency: string): Promise<FaucetWallet | undefined> {
    const [wallet] = await db
      .select()
      .from(faucetWallets)
      .where(and(eq(faucetWallets.userId, userId), eq(faucetWallets.currency, currency)));
    return wallet;
  }

  async createFaucetWallet(wallet: InsertFaucetWallet): Promise<FaucetWallet> {
    const [newWallet] = await db.insert(faucetWallets).values(wallet).returning();
    return newWallet;
  }

  async updateFaucetWallet(userId: string, currency: string, updates: Partial<FaucetWallet>): Promise<FaucetWallet | undefined> {
    const [updated] = await db
      .update(faucetWallets)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(faucetWallets.userId, userId), eq(faucetWallets.currency, currency)))
      .returning();
    return updated;
  }

  async canUserClaim(userId: string, currency: string): Promise<{ canClaim: boolean; nextClaimTime?: Date; secondsRemaining?: number }> {
    const [config] = await this.getFaucetConfig(currency);
    if (!config || !config.isEnabled) {
      return { canClaim: false };
    }

    const wallet = await this.getFaucetWallet(userId, currency);
    if (!wallet || !wallet.lastClaimTime) {
      return { canClaim: true };
    }

    const claimInterval = config.claimInterval; // seconds
    const lastClaimTime = new Date(wallet.lastClaimTime);
    const nextClaimTime = new Date(lastClaimTime.getTime() + claimInterval * 1000);
    const now = new Date();

    if (now >= nextClaimTime) {
      return { canClaim: true };
    }

    const secondsRemaining = Math.ceil((nextClaimTime.getTime() - now.getTime()) / 1000);
    return { canClaim: false, nextClaimTime, secondsRemaining };
  }

  async createFaucetClaim(claim: InsertFaucetClaim): Promise<FaucetClaim> {
    const [newClaim] = await db.insert(faucetClaims).values(claim).returning();
    return newClaim;
  }

  async updateFaucetClaim(claimId: string, updates: Partial<FaucetClaim>): Promise<FaucetClaim | undefined> {
    const [updated] = await db
      .update(faucetClaims)
      .set(updates)
      .where(eq(faucetClaims.id, claimId))
      .returning();
    return updated;
  }

  async getFaucetWalletsByUserId(userId: string): Promise<FaucetWallet[]> {
    return await db
      .select()
      .from(faucetWallets)
      .where(eq(faucetWallets.userId, userId));
  }

  async getFaucetWalletByUserCurrency(userId: string, currency: string): Promise<FaucetWallet | undefined> {
    return await this.getFaucetWallet(userId, currency);
  }

  async getFaucetClaims(userId?: string, currency?: string, limit: number = 50): Promise<FaucetClaim[]> {
    const conditions = [];
    if (userId) conditions.push(eq(faucetClaims.userId, userId));
    if (currency) conditions.push(eq(faucetClaims.currency, currency));
    
    if (conditions.length > 0) {
      return await db
        .select()
        .from(faucetClaims)
        .where(and(...conditions))
        .orderBy(desc(faucetClaims.claimTime))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(faucetClaims)
      .orderBy(desc(faucetClaims.claimTime))
      .limit(limit);
  }

  async getRecentFaucetClaims(userId: string, hours: number): Promise<FaucetClaim[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select()
      .from(faucetClaims)
      .where(and(
        eq(faucetClaims.userId, userId),
        gte(faucetClaims.claimTime, cutoffTime)
      ))
      .orderBy(desc(faucetClaims.claimTime));
  }

  async getFaucetClaimsSince(userId: string, date: Date): Promise<FaucetClaim[]> {
    return await db
      .select()
      .from(faucetClaims)
      .where(and(
        eq(faucetClaims.userId, userId),
        gte(faucetClaims.claimTime, date)
      ))
      .orderBy(desc(faucetClaims.claimTime));
  }

  async getFaucetClaimsByIP(ipAddress: string, hours: number): Promise<FaucetClaim[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db
      .select()
      .from(faucetClaims)
      .where(and(
        eq(faucetClaims.ipAddress, ipAddress),
        gte(faucetClaims.claimTime, cutoffTime)
      ))
      .orderBy(desc(faucetClaims.claimTime));
  }

  async getFaucetRevenue(date?: string, currency?: string): Promise<FaucetRevenue[]> {
    const conditions = [];
    if (date) conditions.push(eq(faucetRevenue.date, date));
    if (currency) conditions.push(eq(faucetRevenue.currency, currency));
    
    if (conditions.length > 0) {
      return await db
        .select()
        .from(faucetRevenue)
        .where(and(...conditions))
        .orderBy(desc(faucetRevenue.date));
    }
    
    return await db
      .select()
      .from(faucetRevenue)
      .orderBy(desc(faucetRevenue.date));
  }

  async updateFaucetRevenue(date: string, currency: string, updates: Partial<FaucetRevenue>): Promise<FaucetRevenue> {
    const [existing] = await db
      .select()
      .from(faucetRevenue)
      .where(and(eq(faucetRevenue.date, date), eq(faucetRevenue.currency, currency)));

    if (existing) {
      const [updated] = await db
        .update(faucetRevenue)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(faucetRevenue.date, date), eq(faucetRevenue.currency, currency)))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(faucetRevenue)
        .values({ date, currency, ...updates })
        .returning();
      return created;
    }
  }

  // Gamification operations
  async getEmployeeStats(userId: string): Promise<EmployeeStats | undefined> {
    const [stats] = await db
      .select()
      .from(employeeStats)
      .where(eq(employeeStats.userId, userId));
    return stats || undefined;
  }

  async createEmployeeStats(stats: InsertEmployeeStats): Promise<EmployeeStats> {
    const [created] = await db
      .insert(employeeStats)
      .values(stats)
      .returning();
    return created;
  }

  async updateEmployeeStats(userId: string, updates: Partial<EmployeeStats>): Promise<EmployeeStats | undefined> {
    const [updated] = await db
      .update(employeeStats)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(employeeStats.userId, userId))
      .returning();
    return updated || undefined;
  }

  async getTodayCheckIn(userId: string, date: string): Promise<DailyCheckin | undefined> {
    const [checkin] = await db
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, date)));
    return checkin || undefined;
  }

  async getLastCheckIn(userId: string): Promise<DailyCheckin | undefined> {
    const [checkin] = await db
      .select()
      .from(dailyCheckins)
      .where(eq(dailyCheckins.userId, userId))
      .orderBy(desc(dailyCheckins.checkinDate))
      .limit(1);
    return checkin || undefined;
  }

  async getRecentCheckIn(userId: string, sinceDate: Date): Promise<DailyCheckin | undefined> {
    const [checkin] = await db
      .select()
      .from(dailyCheckins)
      .where(and(
        eq(dailyCheckins.userId, userId),
        gte(dailyCheckins.createdAt, sinceDate)
      ))
      .orderBy(desc(dailyCheckins.createdAt))
      .limit(1);
    return checkin || undefined;
  }

  async createDailyCheckIn(checkin: InsertDailyCheckin): Promise<DailyCheckin> {
    const [created] = await db
      .insert(dailyCheckins)
      .values(checkin)
      .returning();
    return created;
  }

  async createPointTransaction(transaction: InsertPointTransaction): Promise<PointTransaction> {
    const [created] = await db
      .insert(pointTransactions)
      .values(transaction)
      .returning();
    return created;
  }

  async createReward(reward: InsertReward): Promise<Reward> {
    const [created] = await db
      .insert(rewards)
      .values(reward)
      .returning();
    return created;
  }

  async getEmployeeAchievements(userId: string, limit: number = 5): Promise<(EmployeeAchievement & { achievementType: AchievementType })[]> {
    const results = await db
      .select({
        id: employeeAchievements.id,
        userId: employeeAchievements.userId,
        achievementTypeId: employeeAchievements.achievementTypeId,
        earnedAt: employeeAchievements.earnedAt,
        progress: employeeAchievements.progress,
        notified: employeeAchievements.notified,
        celebrationShown: employeeAchievements.celebrationShown,
        achievementType: achievementTypes
      })
      .from(employeeAchievements)
      .leftJoin(achievementTypes, eq(employeeAchievements.achievementTypeId, achievementTypes.id))
      .where(eq(employeeAchievements.userId, userId))
      .orderBy(desc(employeeAchievements.earnedAt))
      .limit(limit);
    
    return results.map(result => ({
      id: result.id,
      userId: result.userId,
      achievementTypeId: result.achievementTypeId,
      earnedAt: result.earnedAt,
      progress: result.progress,
      notified: result.notified,
      celebrationShown: result.celebrationShown,
      achievementType: result.achievementType!
    }));
  }

  async getUserAchievement(userId: string, achievementTypeId: string): Promise<EmployeeAchievement | undefined> {
    const [achievement] = await db
      .select()
      .from(employeeAchievements)
      .where(and(eq(employeeAchievements.userId, userId), eq(employeeAchievements.achievementTypeId, achievementTypeId)));
    return achievement || undefined;
  }

  async createEmployeeAchievement(achievement: InsertEmployeeAchievement): Promise<EmployeeAchievement> {
    const [created] = await db
      .insert(employeeAchievements)
      .values(achievement)
      .returning();
    return created;
  }

  async getAchievementByKey(key: string): Promise<AchievementType | undefined> {
    const [achievement] = await db
      .select()
      .from(achievementTypes)
      .where(eq(achievementTypes.name, key));
    return achievement || undefined;
  }

  async getWeeklyLeaderboard(limit: number = 10): Promise<WeeklyLeaderboard[]> {
    return await db
      .select()
      .from(weeklyLeaderboards)
      .orderBy(desc(weeklyLeaderboards.rank))
      .limit(limit);
  }

  async getWeeklyRank(userId: string): Promise<{ rank: number; totalEmployees: number; weeklyPoints: number } | null> {
    const [result] = await db
      .select()
      .from(weeklyLeaderboards)
      .where(eq(weeklyLeaderboards.userId, userId))
      .orderBy(desc(weeklyLeaderboards.weekStartDate))
      .limit(1);
    
    if (!result) return null;
    
    const totalEmployees = await db
      .select({ count: sql<number>`count(*)` })
      .from(weeklyLeaderboards)
      .where(eq(weeklyLeaderboards.weekStartDate, result.weekStartDate));
    
    return {
      rank: result.rank || 0,
      totalEmployees: totalEmployees[0]?.count || 0,
      weeklyPoints: result.pointsEarned
    };
  }

  async getWalletAccount(userId: string): Promise<WalletAccount | undefined> {
    const [wallet] = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId));
    return wallet || undefined;
  }

  async createWalletAccount(wallet: InsertWalletAccount): Promise<WalletAccount> {
    const [created] = await db
      .insert(walletAccounts)
      .values({
        ...wallet,
        tokenBalance: "0.00000000",
        cashBalance: "0.00",
        totalEarned: "0.00000000", 
        totalRedeemed: "0.00000000",
        totalCashedOut: "0.00",
        lastActivity: new Date()
      })
      .returning();
    return created;
  }

  async updateWalletAccount(userId: string, updates: Partial<WalletAccount>): Promise<void> {
    await db
      .update(walletAccounts)
      .set({
        ...updates,
        lastActivity: new Date()
      })
      .where(eq(walletAccounts.userId, userId));
  }

  async awardJobCompletionTokens(userId: string, tokenAmount: number, jobId: string): Promise<void> {
    // Get or create user's wallet
    let wallet = await this.getWalletAccount(userId);
    if (!wallet) {
      wallet = await this.createWalletAccount({ userId });
    }

    // Calculate new balances
    const currentBalance = parseFloat(wallet.tokenBalance || "0");
    const currentEarned = parseFloat(wallet.totalEarned || "0");
    const newBalance = currentBalance + tokenAmount;
    const newTotalEarned = currentEarned + tokenAmount;

    // Update wallet balance
    await this.updateWalletAccount(userId, {
      tokenBalance: newBalance.toFixed(8),
      totalEarned: newTotalEarned.toFixed(8),
    });

    // Create reward record for tracking
    await db.insert(rewards).values({
      userId,
      rewardType: "job_completion",
      tokenAmount: tokenAmount.toFixed(8),
      cashValue: "0.00",
      status: "confirmed",
      earnedDate: new Date(),
      metadata: { jobId },
    });
  }

  // Multi-currency wallet operations
  async getSupportedCurrencies(): Promise<SupportedCurrency[]> {
    return await db.select().from(supportedCurrencies).where(eq(supportedCurrencies.isActive, true));
  }

  async getSupportedCurrencyBySymbol(symbol: string): Promise<SupportedCurrency | undefined> {
    const [currency] = await db.select().from(supportedCurrencies)
      .where(and(eq(supportedCurrencies.symbol, symbol), eq(supportedCurrencies.isActive, true)));
    return currency || undefined;
  }

  async createSupportedCurrency(currency: InsertSupportedCurrency): Promise<SupportedCurrency> {
    const [newCurrency] = await db.insert(supportedCurrencies).values(currency).returning();
    return newCurrency;
  }

  async getUserWallet(userId: string, currencyId: string): Promise<UserWallet | undefined> {
    const [wallet] = await db.select().from(userWallets)
      .where(and(eq(userWallets.userId, userId), eq(userWallets.currencyId, currencyId)));
    return wallet || undefined;
  }

  async getUserWalletById(walletId: string): Promise<UserWallet | undefined> {
    const [wallet] = await db.select().from(userWallets).where(eq(userWallets.id, walletId));
    return wallet || undefined;
  }

  async getUserWalletsWithCurrency(userId: string): Promise<(UserWallet & { currency: SupportedCurrency })[]> {
    const results = await db.select({
      ...userWallets,
      currency: supportedCurrencies
    })
    .from(userWallets)
    .innerJoin(supportedCurrencies, eq(userWallets.currencyId, supportedCurrencies.id))
    .where(and(eq(userWallets.userId, userId), eq(userWallets.isActive, true)));
    
    return results.map(result => ({
      ...result,
      currency: result.currency
    }));
  }

  async createUserWallet(wallet: InsertUserWallet): Promise<UserWallet> {
    const [newWallet] = await db.insert(userWallets).values(wallet).returning();
    return newWallet;
  }

  async updateUserWalletBalance(walletId: string, newBalance: string): Promise<void> {
    await db.update(userWallets)
      .set({ 
        balance: newBalance,
        updatedAt: sql`now()`,
        lastSyncedAt: sql`now()`
      })
      .where(eq(userWallets.id, walletId));
  }

  async createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction> {
    const [newTransaction] = await db.insert(walletTransactions).values(transaction).returning();
    return newTransaction;
  }

  async getWalletTransactions(walletId: string, limit: number = 50): Promise<WalletTransaction[]> {
    return await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userWalletId, walletId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit);
  }

  // Treasury wallet operations
  async getTreasuryWallets(roleScope?: string): Promise<(TreasuryWallet & { currency: SupportedCurrency })[]> {
    const conditions = [eq(treasuryWallets.isActive, true)];
    if (roleScope) {
      conditions.push(eq(treasuryWallets.roleScope, roleScope));
    }

    const results = await db.select({
      id: treasuryWallets.id,
      currencyId: treasuryWallets.currencyId,
      walletAddress: treasuryWallets.walletAddress,
      privateKeyHash: treasuryWallets.privateKeyHash,
      publicKey: treasuryWallets.publicKey,
      balance: treasuryWallets.balance,
      lastSyncedAt: treasuryWallets.lastSyncedAt,
      isActive: treasuryWallets.isActive,
      walletType: treasuryWallets.walletType,
      purpose: treasuryWallets.purpose,
      managedByUserId: treasuryWallets.managedByUserId,
      roleScope: treasuryWallets.roleScope,
      metadata: treasuryWallets.metadata,
      createdAt: treasuryWallets.createdAt,
      updatedAt: treasuryWallets.updatedAt,
      currency: supportedCurrencies
    })
    .from(treasuryWallets)
    .innerJoin(supportedCurrencies, eq(treasuryWallets.currencyId, supportedCurrencies.id))
    .where(and(...conditions));
    
    return results.map(result => ({
      ...result,
      currency: result.currency
    })) as (TreasuryWallet & { currency: SupportedCurrency })[];
  }

  async getTreasuryWallet(currencyId: string, purpose: string = 'treasury'): Promise<TreasuryWallet | undefined> {
    const [wallet] = await db.select().from(treasuryWallets)
      .where(and(
        eq(treasuryWallets.currencyId, currencyId),
        eq(treasuryWallets.purpose, purpose),
        eq(treasuryWallets.isActive, true)
      ));
    return wallet || undefined;
  }

  async updateTreasuryWalletBalance(walletId: string, newBalance: string): Promise<void> {
    await db.update(treasuryWallets)
      .set({ 
        balance: newBalance,
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(treasuryWallets.id, walletId));
  }

  // Price history operations
  async addPricePoint(priceUsd: string, source: string, marketData?: any): Promise<void> {
    await db.execute(sql`
      INSERT INTO price_history (price_usd, source, market_data)
      VALUES (${priceUsd}, ${source}, ${marketData ? JSON.stringify(marketData) : null})
    `);
  }

  async getPriceHistory(hours: number = 24): Promise<Array<{ timestamp: Date; price: number; source: string }>> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const results = await db.execute(sql`
      SELECT created_at as timestamp, price_usd as price, source
      FROM price_history
      WHERE created_at >= ${cutoffTime.toISOString()}
      ORDER BY created_at ASC
    `);
    return results.rows.map((row: any) => ({
      timestamp: new Date(row.timestamp),
      price: parseFloat(row.price),
      source: row.source
    }));
  }

  async cleanOldPriceData(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    await db.execute(sql`
      DELETE FROM price_history
      WHERE created_at < ${cutoffDate.toISOString()}
    `);
  }
}

export const storage = new DatabaseStorage();
