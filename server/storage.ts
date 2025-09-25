import { type User, type InsertUser, type UpsertUser, type Lead, type InsertLead, type Contact, type InsertContact, type Notification, type InsertNotification, type TreasuryAccount, type InsertTreasuryAccount, type FundingDeposit, type InsertFundingDeposit, type ReserveTransaction, type InsertReserveTransaction, type FaucetConfig, type InsertFaucetConfig, type FaucetClaim, type InsertFaucetClaim, type FaucetWallet, type InsertFaucetWallet, type FaucetRevenue, type InsertFaucetRevenue, leads, contacts, users, notifications, walletAccounts, rewards, treasuryAccounts, fundingDeposits, reserveTransactions, faucetConfig, faucetClaims, faucetWallets, faucetRevenue } from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNull, and, isNotNull, sql, gt, gte } from "drizzle-orm";
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
  
  // Job assignment operations
  assignLeadToEmployee(leadId: string, employeeId: string): Promise<Lead | undefined>;
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
  createFaucetWallet(wallet: InsertFaucetWallet): Promise<FaucetWallet>;
  updateFaucetWallet(userId: string, currency: string, updates: Partial<FaucetWallet>): Promise<FaucetWallet | undefined>;
  canUserClaim(userId: string, currency: string): Promise<{ canClaim: boolean; nextClaimTime?: Date; secondsRemaining?: number }>;
  createFaucetClaim(claim: InsertFaucetClaim): Promise<FaucetClaim>;
  updateFaucetClaim(claimId: string, updates: Partial<FaucetClaim>): Promise<FaucetClaim | undefined>;
  getFaucetClaims(userId?: string, currency?: string, limit?: number): Promise<FaucetClaim[]>;
  getFaucetRevenue(date?: string, currency?: string): Promise<FaucetRevenue[]>;
  updateFaucetRevenue(date: string, currency: string, updates: Partial<FaucetRevenue>): Promise<FaucetRevenue>;
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

  async getLeadsByEmail(email: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .orderBy(desc(leads.createdAt));
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
    const currentBalance = parseFloat(treasury.availableFunding);
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

      const currentBalance = parseFloat(treasury.availableFunding);
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
      await tx
        .update(treasuryAccounts)
        .set({
          availableFunding: newBalance.toFixed(2),
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

      // Calculate new balances
      const newBalance = parseFloat(treasury.availableFunding) + cashValue;
      const newTokenReserve = parseFloat(treasury.tokenReserve) + tokenAmount;

      // Update treasury account with locked row
      await tx
        .update(treasuryAccounts)
        .set({
          availableFunding: newBalance.toFixed(2),
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
      const newBalance = parseFloat(treasury.availableFunding) + usdAmount;
      const newTokenReserve = parseFloat(treasury.tokenReserve) + tokensPurchased;

      await tx
        .update(treasuryAccounts)
        .set({
          availableFunding: newBalance.toFixed(2),
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
}

export const storage = new DatabaseStorage();
