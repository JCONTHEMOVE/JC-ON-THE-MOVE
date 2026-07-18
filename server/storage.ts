import { type User, type InsertUser, type UpsertUser, type Lead, type InsertLead, type Contact, type InsertContact, type Notification, type InsertNotification, type TreasuryAccount, type InsertTreasuryAccount, type FundingDeposit, type InsertFundingDeposit, type ReserveTransaction, type InsertReserveTransaction, type FaucetConfig, type InsertFaucetConfig, type FaucetClaim, type InsertFaucetClaim, type FaucetWallet, type InsertFaucetWallet, type FaucetRevenue, type InsertFaucetRevenue, type EmployeeStats, type InsertEmployeeStats, type AchievementType, type EmployeeAchievement, type InsertEmployeeAchievement, type PointTransaction, type InsertPointTransaction, type WeeklyLeaderboard, type DailyCheckin, type InsertDailyCheckin, type WalletAccount, type InsertWalletAccount, type SupportedCurrency, type InsertSupportedCurrency, type UserWallet, type InsertUserWallet, type TreasuryWallet, type InsertTreasuryWallet, type WalletTransaction, type InsertWalletTransaction, type ShopItem, type InsertShopItem, type Review, type InsertReview, type Testimonial, type InsertTestimonial, type WalletPayout, type InsertWalletPayout, type TokenConversion, type InsertTokenConversion, type TreasuryLimit, type InsertTreasuryLimit, type SquareInvoice, type InsertSquareInvoice, type SnowCustomer, type InsertSnowCustomer, type SnowServiceType, type InsertSnowServiceType, type SnowServiceLog, type InsertSnowServiceLog, type StakingTier, type Stake, type InsertStake, type InsertReward, type Reward, stakingTiers, stakes, leads, contacts, users, notifications, walletAccounts, rewards, treasuryAccounts, fundingDeposits, reserveTransactions, priceHistory, faucetConfig, faucetClaims, faucetWallets, faucetRevenue, employeeStats, achievementTypes, employeeAchievements, pointTransactions, weeklyLeaderboards, dailyCheckins, supportedCurrencies, userWallets, treasuryWallets, walletTransactions, shopItems, cashoutRequests, fraudLogs, helpRequests, miningSessions, miningClaims, treasuryWithdrawals, reviews, testimonials, walletPayouts, tokenConversions, treasuryLimits, squareInvoices, buybackFund, snowCustomers, snowServiceTypes, snowServiceLogs } from "@shared/schema";
import { type WorkerDayBlock, type WorkerScheduleRow, type WorkerGoal, type WorkerHourOverride, workerDayBlocks, workerSchedule, workerGoals, workerHourOverrides } from "@shared/schema";
import { type Sponsor, type InsertSponsor, sponsors } from "@shared/schema";
import { db, type DbTransaction } from "./db";
import { eq, desc, isNull, and, isNotNull, sql, gt, gte, inArray, not, or, lte, getTableColumns } from "drizzle-orm";
import { TREASURY_CONFIG } from "./constants";
import { cryptoService } from "./services/crypto";
import { creditGenerosityFund } from "./services/generosityFund";
import { creditNominees, creditPlatformGenerosityFund } from "./services/nominees";

const INTERNAL_WALLET_IDS = new Set(["nicolasa-jackson-generosity", "platform-generosity-fund"]);

type WalletCreditOptions = {
  rewardType?: string;
  referenceId?: string | null;
  cashValue?: string | number;
  status?: string;
  earnedDate?: Date;
  metadata?: Record<string, unknown> | null;
  skipRewardLedger?: boolean;
};

export interface IStorage {
  // User operations
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
  
  // Wallet choice management (hybrid personal/company wallet system)
  updateUserWalletChoice(userId: string, walletMode: 'personal' | 'company', personalWalletAddress?: string, companyWalletId?: string): Promise<User | undefined>;
  getPayoutAddress(userId: string): Promise<{ address: string | null; mode: 'personal' | 'company' | null; pendingAssignment?: boolean }>;
  
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
  getArchivedLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadsByEmail(email: string): Promise<Lead[]>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  updateLeadQuote(id: string, quoteData: any): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>; // soft-archive
  lookupLeadByOrderNumber(orderNumber: string): Promise<Lead | undefined>;
  
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
  // Same semantics as deductFromReserve but reuses an existing db.transaction
  // so callers (e.g. the unified daily rewards engine) can fold the treasury
  // debit into a larger user-side atomic unit. Volatility safety checks still
  // run before the DB writes.
  deductFromReserveInTransaction(tx: DbTransaction, tokenAmount: number, description: string, tokenPrice: number, relatedEntityType?: string, relatedEntityId?: string): Promise<ReserveTransaction>;
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
  createReward(reward: InsertReward & Partial<Reward>): Promise<Reward>;
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
  creditWalletTokens(userId: string, tokenAmount: number, options?: WalletCreditOptions): Promise<void>;
  creditWalletTokensRaw(userId: string, tokenAmount: number): Promise<void>;
  debitWalletTokens(userId: string, tokenAmount: number): Promise<void>;
  getRewardsByUserAndTypeToday(userId: string, rewardType: string): Promise<any[]>;
  
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
  getTreasuryWalletById(walletId: string): Promise<TreasuryWallet | undefined>;
  updateTreasuryWalletBalance(walletId: string, newBalance: string): Promise<void>;
  upsertTreasuryWallet(currencyId: string, walletAddress: string, purpose?: string): Promise<TreasuryWallet>;
  updateTreasuryWalletAddress(walletId: string, newAddress: string): Promise<TreasuryWallet | undefined>;
  
  // Price history operations
  addPricePoint(priceUsd: string, source: string, marketData?: any): Promise<void>;
  getPriceHistory(hours?: number): Promise<Array<{ timestamp: Date; price: number; source: string }>>;
  cleanOldPriceData(daysToKeep: number): Promise<void>;
  
  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviews(filters?: { leadId?: string; employeeId?: string; userId?: string }, limit?: number): Promise<Review[]>;
  getReview(id: string): Promise<Review | undefined>;
  getReviewByLeadAndUser(leadId: string, userId: string): Promise<Review | undefined>;
  getEmployeeReviewStats(employeeId: string): Promise<{ averageRating: number; totalReviews: number; ratings: { 1: number; 2: number; 3: number; 4: number; 5: number } }>;
  markReviewAsRewarded(reviewId: string): Promise<Review | undefined>;
  
  // Testimonial operations (customer and imported reviews for public showcase)
  createTestimonial(testimonial: InsertTestimonial): Promise<Testimonial>;
  getTestimonials(filters?: { status?: string; featured?: boolean; sourceType?: string; sourcePlatform?: string }, limit?: number): Promise<Testimonial[]>;
  getTestimonial(id: string): Promise<Testimonial | undefined>;
  updateTestimonial(id: string, updates: Partial<Omit<Testimonial, 'id' | 'createdAt'>>): Promise<Testimonial | undefined>;
  deleteTestimonial(id: string): Promise<boolean>;
  importTestimonials(testimonials: InsertTestimonial[]): Promise<Testimonial[]>;
  getTestimonialStats(): Promise<{ totalCount: number; averageRating: number; platformCounts: Record<string, number> }>;
  
  // Treasury limits operations (admin configurable up to 500M JCMOVES)
  getTreasuryLimits(): Promise<TreasuryLimit[]>;
  getTreasuryLimit(limitType: string): Promise<TreasuryLimit | undefined>;
  updateTreasuryLimit(limitType: string, limitValue: number, updatedBy: string, notes?: string): Promise<TreasuryLimit | undefined>;
  
  // Token conversions operations (JCMOVES/SOL/ETH swap tracking)
  createTokenConversion(conversion: InsertTokenConversion): Promise<TokenConversion>;
  getTokenConversions(userId?: string, limit?: number): Promise<TokenConversion[]>;
  updateTokenConversionStatus(id: string, status: string, transactionHash?: string, executedAt?: Date): Promise<TokenConversion | undefined>;
  
  // Square invoice operations
  createSquareInvoice(invoice: InsertSquareInvoice): Promise<SquareInvoice>;
  getSquareInvoices(filters?: { leadId?: string; status?: string }, limit?: number): Promise<SquareInvoice[]>;
  getSquareInvoice(id: string): Promise<SquareInvoice | undefined>;
  getSquareInvoiceBySquareId(squareInvoiceId: string): Promise<SquareInvoice | undefined>;
  updateSquareInvoiceStatus(squareInvoiceId: string, status: string, paidAt?: Date): Promise<SquareInvoice | undefined>;
  
  // Buyback fund operations (token fees for buyback program)
  getBuybackFundStats(): Promise<{ tokenBalance: number; totalTokensCollected: number; feeContributionCount: number; lastUpdated: Date | null }>;
  recordBuybackFeeContribution(amount: number, sourcePayoutId?: string): Promise<void>;
  
  // Snow removal operations
  getSnowCustomers(activeOnly?: boolean): Promise<SnowCustomer[]>;
  getSnowCustomer(id: string): Promise<SnowCustomer | undefined>;
  createSnowCustomer(customer: InsertSnowCustomer): Promise<SnowCustomer>;
  updateSnowCustomer(id: string, updates: Partial<InsertSnowCustomer>): Promise<SnowCustomer | undefined>;
  deleteSnowCustomer(id: string): Promise<boolean>;
  
  getSnowServiceTypes(activeOnly?: boolean): Promise<SnowServiceType[]>;
  getSnowServiceType(id: string): Promise<SnowServiceType | undefined>;
  createSnowServiceType(serviceType: InsertSnowServiceType): Promise<SnowServiceType>;
  updateSnowServiceType(id: string, updates: Partial<InsertSnowServiceType>): Promise<SnowServiceType | undefined>;
  
  getSnowServiceLogs(filters?: { customerId?: string; monthKey?: string; date?: string }): Promise<SnowServiceLog[]>;
  getSnowServiceLog(id: string): Promise<SnowServiceLog | undefined>;
  createSnowServiceLog(log: InsertSnowServiceLog): Promise<SnowServiceLog>;
  updateSnowServiceLog(id: string, updates: Partial<InsertSnowServiceLog>): Promise<SnowServiceLog | undefined>;
  deleteSnowServiceLog(id: string): Promise<boolean>;
  getSnowMonthlySummary(monthKey: string): Promise<{ customerId: string; customerName: string; visits: number; totalAmount: number; paidAmount: number }[]>;
  
  // Jewelry items
  getJewelryItems(status?: string, category?: string): Promise<any[]>;
  getJewelryItem(id: string): Promise<any | undefined>;
  createJewelryItem(item: any): Promise<any>;
  updateJewelryItem(id: string, updates: any): Promise<any | undefined>;
  deleteJewelryItem(id: string): Promise<void>;

  // Staking operations
  getStakingTiers(): Promise<StakingTier[]>;
  getUserStakes(userId: string): Promise<(Stake & { tier: StakingTier })[]>;
  createStake(userId: string, tierId: string, amount: number): Promise<Stake>;
  claimStakingRewards(stakeId: string, userId: string): Promise<{ earned: number }>;
  unstake(stakeId: string, userId: string): Promise<{ returned: number; penalty: number; earned: number }>;
  getStakingTreasuryBalance(): Promise<{ tokenBalance: string; totalDeposited: string; totalPaidOut: string }>;
  // New single-pool staking
  getStakingPool(userId: string): Promise<{ stakedBalance: number; unstakeCooldownUntil: Date | null; discountPct: number }>;
  stakeTokens(userId: string, amount: number): Promise<void>;
  unstakeTokens(userId: string): Promise<{ returned: number }>;
  getStakingLeaderboard(limit?: number): Promise<{ userId: string; stakedBalance: number; rank: number }[]>;
  getStakingDiscountPct(userId: string): Promise<number>;

  // Sponsor operations
  createSponsor(sponsor: InsertSponsor): Promise<Sponsor>;
  getSponsors(status?: string): Promise<Sponsor[]>;
  getSponsor(id: string): Promise<Sponsor | undefined>;
  updateSponsorStatus(id: string, status: string): Promise<Sponsor | undefined>;
  updateSponsorFeatured(id: string, featured: boolean): Promise<Sponsor | undefined>;

  // Worker availability & goals
  getWorkerDayBlocks(userId: string): Promise<WorkerDayBlock[]>;
  createWorkerDayBlock(userId: string, date: string, reason?: string): Promise<WorkerDayBlock>;
  deleteWorkerDayBlock(id: number, userId: string): Promise<boolean>;
  getWorkerSchedule(userId: string): Promise<WorkerScheduleRow[]>;
  upsertWorkerSchedule(userId: string, dayOfWeek: number, startHour: number, endHour: number, isAvailable: boolean): Promise<WorkerScheduleRow>;
  getWorkerGoals(userId: string): Promise<WorkerGoal | undefined>;
  upsertWorkerGoals(userId: string, goals: { weeklyJobGoal?: number; monthlyJobGoal?: number; preferredJobSize?: string; notes?: string; setByAdminId?: string }): Promise<WorkerGoal>;
  getWorkerJobStats(userId: string): Promise<{ thisWeek: number; thisMonth: number; allTime: number }>;
  getAllWorkersAvailability(): Promise<{ user: User; goals: WorkerGoal | null; thisWeek: number; thisMonth: number; blockedDates: string[]; schedule: WorkerScheduleRow[] }[]>;

  // Worker hour overrides (date-specific custom hours)
  getWorkerHourOverrides(userId: string): Promise<WorkerHourOverride[]>;
  upsertWorkerHourOverride(userId: string, date: string, startHour: number, endHour: number, note?: string): Promise<WorkerHourOverride>;
  deleteWorkerHourOverride(id: number, userId: string): Promise<boolean>;
  getWorkerCalendarData(userId: string, year: number, month: number): Promise<{
    jobs: { id: string; serviceType: string; fromAddress: string | null; confirmedFromAddress: string | null; confirmedDate: string | null; moveDate: string | null; confirmedHours: number | null; status: string; crewMembers: string[] | null; assignedToUserId: string | null; effectiveDate: string | null }[];
    blocks: WorkerDayBlock[];
    hourOverrides: WorkerHourOverride[];
    schedule: WorkerScheduleRow[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations

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
    // order_number is a Postgres serial column — let the DB auto-generate it.
    // Do NOT pass orderNumber here; the previous JC-XXXXXX helper was removed
    // because the column type changed to integer/serial.
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
      .where(isNull(leads.archivedAt))
      .orderBy(desc(leads.createdAt));
  }

  async getArchivedLeads(): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(isNotNull(leads.archivedAt))
      .orderBy(desc(leads.archivedAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async lookupLeadByOrderNumber(orderNumber: string): Promise<Lead | undefined> {
    // order_number is an integer serial column. Accept either a bare number
    // ("42") or the human-friendly "JC-42" / "JC-000042" format and pull the
    // numeric part out for the query.
    const match = orderNumber.trim().toUpperCase().match(/^(?:JC-)?0*(\d+)$/);
    if (!match) return undefined;
    const numeric = parseInt(match[1], 10);
    if (!Number.isFinite(numeric)) return undefined;
    const [lead] = await db.select().from(leads).where(eq(leads.orderNumber, numeric));
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<boolean> {
    // Soft-archive: set archivedAt timestamp so the lead disappears from active views
    // but remains in the database for records
    const [result] = await db
      .update(leads)
      .set({ archivedAt: new Date() })
      .where(and(eq(leads.id, id), isNull(leads.archivedAt)))
      .returning({ id: leads.id });
    return !!result;
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
      .where(and(eq(leads.status, status), isNull(leads.archivedAt)))
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
      .where(and(
        // A company owner/admin can also work a job, but only when they have
        // explicitly opted into the mover capability. Legacy employees remain
        // eligible without capability tags.
        or(
          eq(users.role, 'employee'),
          and(
            inArray(users.role, ['admin', 'business_owner']),
            sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
          ),
        ),
        eq(users.isApproved, true),
        inArray(users.status, ['approved', 'active']),
        sql`${users.email} NOT LIKE '%.internal'`,
      ))
      .orderBy(users.firstName, users.lastName);
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(sql`${users.email} NOT LIKE '%.internal'`)
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
      await db.update(fundingDeposits).set({ notes: sql`COALESCE(${fundingDeposits.notes}, '') || ' | Depositor deleted'` }).where(eq(fundingDeposits.depositedBy, userId));
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

  async updateUserWalletChoice(
    userId: string, 
    walletMode: 'personal' | 'company', 
    personalWalletAddress?: string, 
    companyWalletId?: string
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        walletMode,
        personalWalletAddress: walletMode === 'personal' ? personalWalletAddress : null,
        companyWalletId: walletMode === 'company' ? companyWalletId : null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getPayoutAddress(userId: string): Promise<{ address: string | null; mode: 'personal' | 'company' | null; pendingAssignment?: boolean }> {
    const user = await this.getUser(userId);
    if (!user) {
      return { address: null, mode: null };
    }

    const mode = user.walletMode as 'personal' | 'company' | null;
    
    if (mode === 'personal') {
      return { address: user.personalWalletAddress || null, mode: 'personal' };
    }
    
    if (mode === 'company') {
      if (user.companyWalletId) {
        const companyWallet = await this.getUserWalletById(user.companyWalletId);
        return { address: companyWallet?.walletAddress || null, mode: 'company' };
      }
      return { address: null, mode: 'company', pendingAssignment: true };
    }
    
    return { address: null, mode: null };
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
      .where(and(
        or(
          eq(users.role, 'employee'),
          and(
            inArray(users.role, ['admin', 'business_owner']),
            sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
          ),
        ),
        eq(users.isApproved, true),
        inArray(users.status, ['approved', 'active']),
        sql`${users.email} NOT LIKE '%.internal'`,
      ))
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

    // Get total earnings from all referral-related rewards (JCMOVES)
    const referralRewards = await db
      .select()
      .from(rewards)
      .where(and(
        eq(rewards.userId, userId),
        sql`${rewards.rewardType} IN ('referral_bonus', 'referral_request', 'referral_confirmed', 'referral_signup_bonus')`
      ));

    const totalEarned = referralRewards.reduce((sum, reward) => sum + parseFloat(reward.tokenAmount), 0);

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
      .where(and(
        isNull(leads.assignedToUserId),
        isNull(leads.archivedAt),
        inArray(leads.status, ["available", "open"]),
      ))
      .orderBy(desc(leads.createdAt));
  }

  async getAssignedLeads(employeeId: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(
        and(
          or(
            eq(leads.assignedToUserId, employeeId),
            sql`${employeeId} = ANY(${leads.crewMembers})`
          ),
          isNull(leads.archivedAt)
        )
      )
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
      .values({ ...item, price: String(item.price) })
      .returning();
    return shopItem;
  }

  async getShopItems(filters?: { status?: string; postedBy?: string }, limit: number = 20, offset: number = 0): Promise<ShopItem[]> {
    let query: any = db.select().from(shopItems);
    
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

  // Volatility circuit breaker. Run BEFORE opening/joining a tx so
  // external HTTP latency doesn't hold DB locks.
  private async _enforceVolatilityCircuitBreaker(tokenAmount: number): Promise<void> {
    try {
      const volatilityCheck = await cryptoService.checkPriceVolatility();

      // Extreme volatility halt (>20% price change)
      if (Math.abs(volatilityCheck.changePercent) > 20) {
        throw new Error(`Distribution HALTED due to extreme market volatility: ${volatilityCheck.changePercent.toFixed(2)}% price change detected. Distribution blocked for safety.`);
      }

      // High volatility limits (>10% price change)
      if (Math.abs(volatilityCheck.changePercent) > 10) {
        const maxSafeTokens = 500;
        if (tokenAmount > maxSafeTokens) {
          throw new Error(`Distribution amount (${tokenAmount.toLocaleString()} tokens) exceeds safe limit (${maxSafeTokens.toLocaleString()} tokens) due to high market volatility (${volatilityCheck.changePercent.toFixed(2)}%).`);
        }
      }
      // Medium volatility limits (>5% price change)
      else if (Math.abs(volatilityCheck.changePercent) > 5) {
        const maxSafeTokens = 1000;
        if (tokenAmount > maxSafeTokens) {
          throw new Error(`Distribution amount (${tokenAmount.toLocaleString()} tokens) exceeds safe limit (${maxSafeTokens.toLocaleString()} tokens) due to medium market volatility (${volatilityCheck.changePercent.toFixed(2)}%).`);
        }
      }
    } catch (volatilityError: unknown) {
      if (volatilityError instanceof Error && volatilityError.message && volatilityError.message.includes('Distribution HALTED')) {
        throw volatilityError;
      }
      console.error('Volatility check failed for treasury distribution - HALTING as safety measure:', volatilityError);
      throw new Error('Distribution HALTED due to market data unavailability. This is a safety measure to prevent distributions during uncertain market conditions.');
    }
  }

  // Treasury debit body. Runs against either a fresh tx or a caller-supplied
  // one. Uses SELECT FOR UPDATE so concurrent debits serialize.
  private async _deductFromReserveTxBody(
    tx: DbTransaction,
    tokenAmount: number,
    description: string,
    cashValue: number,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<ReserveTransaction> {
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

    const totalFunding = parseFloat(treasury.totalFunding);
    const totalDistributed = parseFloat(treasury.totalDistributed);
    const currentBalance = totalFunding - totalDistributed;
    const currentTokenReserve = parseFloat(treasury.tokenReserve);
    const minimumBalance = TREASURY_CONFIG.MINIMUM_BALANCE;

    if (currentBalance < cashValue) {
      throw new Error(`Insufficient funding. Required: $${cashValue.toFixed(2)}, Available: $${currentBalance.toFixed(2)}`);
    }
    if (currentTokenReserve < tokenAmount) {
      throw new Error(`Insufficient token reserve. Required: ${tokenAmount} tokens, Available: ${currentTokenReserve.toFixed(8)} tokens`);
    }

    const newBalance = currentBalance - cashValue;
    if (newBalance < minimumBalance) {
      throw new Error(`Distribution would leave balance below minimum threshold ($${minimumBalance}). Remaining would be: $${newBalance.toFixed(2)}`);
    }
    const newTokenReserve = currentTokenReserve - tokenAmount;

    await tx
      .update(treasuryAccounts)
      .set({
        tokenReserve: newTokenReserve.toFixed(8),
        totalDistributed: (parseFloat(treasury.totalDistributed) + cashValue).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(treasuryAccounts.id, treasury.id));

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
        description,
      })
      .returning();

    return transaction;
  }

  async deductFromReserve(tokenAmount: number, description: string, tokenPrice: number, relatedEntityType?: string, relatedEntityId?: string): Promise<ReserveTransaction> {
    // CRITICAL: Universal circuit breaker enforcement - NO distribution can bypass this
    await this._enforceVolatilityCircuitBreaker(tokenAmount);

    const cashValue = tokenAmount * tokenPrice;

    return await db.transaction(async (tx) => {
      return await this._deductFromReserveTxBody(tx, tokenAmount, description, cashValue, relatedEntityType, relatedEntityId);
    });
  }

  // Tx-aware variant of deductFromReserve. Caller passes in an existing tx
  // so the debit commits/rolls back atomically with the caller's writes.
  async deductFromReserveInTransaction(
    tx: DbTransaction,
    tokenAmount: number,
    description: string,
    tokenPrice: number,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<ReserveTransaction> {
    await this._enforceVolatilityCircuitBreaker(tokenAmount);
    const cashValue = tokenAmount * tokenPrice;
    return await this._deductFromReserveTxBody(tx, tokenAmount, description, cashValue, relatedEntityType, relatedEntityId);
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

  async atomicDepositTokens(depositedBy: string, tokenAmount: number, depositMethod: string = 'manual', notes?: string): Promise<FundingDeposit> {
    return await db.transaction(async (tx) => {
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

      const [deposit] = await tx
        .insert(fundingDeposits)
        .values({
          treasuryAccountId: treasury.id,
          depositedBy,
          depositAmount: "0.00",
          tokensPurchased: tokenAmount.toFixed(8),
          tokenPrice: "0.00000000",
          depositMethod,
          status: 'completed',
          notes: notes || `Direct token deposit: ${tokenAmount.toLocaleString()} JCMOVES`
        })
        .returning();

      const newTokenReserve = parseFloat(treasury.tokenReserve) + tokenAmount;

      await tx
        .update(treasuryAccounts)
        .set({
          tokenReserve: newTokenReserve.toFixed(8),
          updatedAt: new Date()
        })
        .where(eq(treasuryAccounts.id, treasury.id));

      await tx
        .insert(reserveTransactions)
        .values({
          treasuryAccountId: treasury.id,
          transactionType: 'deposit',
          relatedEntityType: 'funding_deposit',
          relatedEntityId: deposit.id,
          tokenAmount: tokenAmount.toFixed(8),
          cashValue: "0.00",
          balanceAfter: parseFloat(treasury.availableFunding).toFixed(2),
          tokenReserveAfter: newTokenReserve.toFixed(8),
          description: `Token deposit: ${tokenAmount.toLocaleString()} JCMOVES`
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

  async createReward(reward: InsertReward & Partial<Reward>): Promise<Reward> {
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

  async creditWalletTokens(userId: string, tokenAmount: number, options: WalletCreditOptions = {}): Promise<void> {
    if (!Number.isFinite(tokenAmount) || tokenAmount < 0) {
      throw new Error(`creditWalletTokens: amount must be non-negative finite, got ${tokenAmount}`);
    }
    if (tokenAmount === 0) return;
    const { skipRewardLedger = false } = options;
    const shouldWriteRewardLedger = !skipRewardLedger && Boolean(options.rewardType);
    await db.transaction(async (tx) => {
      let [wallet] = await tx.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
      if (!wallet) {
        [wallet] = await tx.insert(walletAccounts).values({ userId }).returning();
      }

      const stakedBalance = parseFloat(wallet.stakedBalance ?? "0");
      const isStakingActive = !INTERNAL_WALLET_IDS.has(userId) && !userId.startsWith("nominee-") && stakedBalance > 0;
      const bonus = isStakingActive ? Math.floor(tokenAmount * 0.10) : 0;
      const totalCredit = tokenAmount + bonus;

      const currentBalance = parseFloat(wallet.tokenBalance || "0");
      const currentEarned = parseFloat(wallet.totalEarned || "0");
      const newBalance = (currentBalance + totalCredit).toFixed(8);
      const rewardMetadata = {
        ...(options.metadata ?? {}),
        source: (options.metadata as Record<string, unknown> | null | undefined)?.source ?? "creditWalletTokens",
        baseAmount: tokenAmount,
        balanceAfter: newBalance,
      };

      await tx
        .update(walletAccounts)
        .set({
          tokenBalance: newBalance,
          totalEarned: (currentEarned + totalCredit).toFixed(8),
          lastActivity: new Date(),
        })
        .where(eq(walletAccounts.userId, userId));

      if (shouldWriteRewardLedger) {
        await tx.insert(rewards).values({
          userId,
          rewardType: options.rewardType!,
          tokenAmount: tokenAmount.toFixed(8),
          cashValue: String(options.cashValue ?? "0.00"),
          status: options.status ?? "confirmed",
          earnedDate: options.earnedDate ?? new Date(),
          referenceId: options.referenceId ?? null,
          metadata: rewardMetadata,
        });
      }

      if (bonus > 0) {
        const stakingBonusMetadata = { baseAmount: tokenAmount, bonusPct: 10 };
        await tx.insert(rewards).values({
          userId,
          rewardType: "staking_bonus",
          tokenAmount: bonus.toFixed(8),
          cashValue: "0.00",
          status: "confirmed",
          earnedDate: new Date(),
          metadata: stakingBonusMetadata,
        });
        const [userWallet] = await tx.select({ id: userWallets.id }).from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
        await tx.insert(walletTransactions).values({
          userWalletId: userWallet?.id ?? null,
          transactionType: "staking_bonus",
          amount: bonus.toFixed(8),
          balanceAfter: newBalance,
          status: "confirmed",
          metadata: stakingBonusMetadata,
        });
      }
    });

    if (!INTERNAL_WALLET_IDS.has(userId) && !userId.startsWith("nominee-")) {
      // Use base tokenAmount only (not totalCredit) — staking bonus is treasury-funded
      // and should not flow into generosity/nominee funds to avoid circular treasury drain.
      creditGenerosityFund(tokenAmount, `credit_to_${userId}`).catch(() => {});
      creditNominees(tokenAmount, `credit_to_${userId}`).catch(() => {});
      creditPlatformGenerosityFund(tokenAmount, `credit_to_${userId}`).catch(() => {});
    }
  }

  async creditWalletTokensRaw(userId: string, tokenAmount: number): Promise<void> {
    let wallet = await this.getWalletAccount(userId);
    if (!wallet) wallet = await this.createWalletAccount({ userId });
    const currentBalance = parseFloat(wallet.tokenBalance || "0");
    const currentEarned = parseFloat(wallet.totalEarned || "0");
    await this.updateWalletAccount(userId, {
      tokenBalance: (currentBalance + tokenAmount).toFixed(8),
      totalEarned: (currentEarned + tokenAmount).toFixed(8),
    });
  }

  async debitWalletTokens(userId: string, tokenAmount: number): Promise<void> {
    if (!Number.isFinite(tokenAmount) || tokenAmount < 0) {
      throw new Error(`debitWalletTokens: amount must be non-negative finite, got ${tokenAmount}`);
    }
    if (tokenAmount === 0) return;
    const wallet = await this.getWalletAccount(userId);
    if (!wallet) throw new Error("Wallet not found");
    const currentBalance = parseFloat(wallet.tokenBalance || "0");
    if (currentBalance < tokenAmount) throw new Error("Insufficient balance");
    const newBalance = Math.max(0, currentBalance - tokenAmount);
    await this.updateWalletAccount(userId, {
      tokenBalance: newBalance.toFixed(8),
    });
    if (!INTERNAL_WALLET_IDS.has(userId) && !userId.startsWith("nominee-")) {
      creditGenerosityFund(tokenAmount, `debit_from_${userId}`).catch(() => {});
      creditNominees(tokenAmount, `debit_from_${userId}`).catch(() => {});
      creditPlatformGenerosityFund(tokenAmount, `debit_from_${userId}`).catch(() => {});
    }
  }


  async getRewardsByUserAndTypeToday(userId: string, rewardType: string): Promise<any[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db.select()
      .from(rewards)
      .where(and(
        eq(rewards.userId, userId),
        eq(rewards.rewardType, rewardType),
        gte(rewards.earnedDate, today)
      ));
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
      ...getTableColumns(userWallets),
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

  async getTreasuryWalletById(walletId: string): Promise<TreasuryWallet | undefined> {
    const [wallet] = await db.select().from(treasuryWallets)
      .where(eq(treasuryWallets.id, walletId));
    return wallet || undefined;
  }

  async upsertTreasuryWallet(currencyId: string, walletAddress: string, purpose: string = 'treasury'): Promise<TreasuryWallet> {
    const existing = await this.getTreasuryWallet(currencyId, purpose);
    
    if (existing) {
      const [updated] = await db.update(treasuryWallets)
        .set({ 
          walletAddress,
          updatedAt: new Date()
        })
        .where(eq(treasuryWallets.id, existing.id))
        .returning();
      return updated;
    }
    
    const [newWallet] = await db.insert(treasuryWallets)
      .values({
        currencyId,
        walletAddress,
        purpose,
        walletType: 'hot_wallet',
        roleScope: 'admin',
        isActive: true,
        balance: '0.00000000'
      })
      .returning();
    return newWallet;
  }

  async updateTreasuryWalletAddress(walletId: string, newAddress: string): Promise<TreasuryWallet | undefined> {
    const [updated] = await db.update(treasuryWallets)
      .set({ 
        walletAddress: newAddress,
        updatedAt: new Date()
      })
      .where(eq(treasuryWallets.id, walletId))
      .returning();
    return updated || undefined;
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

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getReviews(
    filters?: { leadId?: string; employeeId?: string; userId?: string },
    limit: number = 100
  ): Promise<Review[]> {
    let query: any = db.select().from(reviews);
    
    const conditions = [];
    if (filters?.leadId) {
      conditions.push(eq(reviews.leadId, filters.leadId));
    }
    if (filters?.employeeId) {
      conditions.push(eq(reviews.employeeId, filters.employeeId));
    }
    if (filters?.userId) {
      conditions.push(eq(reviews.userId, filters.userId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const results = await query
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
    
    return results;
  }

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }

  async getReviewByLeadAndUser(leadId: string, userId: string): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.leadId, leadId), eq(reviews.userId, userId)));
    return review || undefined;
  }

  async getEmployeeReviewStats(employeeId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratings: { 1: number; 2: number; 3: number; 4: number; 5: number };
  }> {
    const employeeReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.employeeId, employeeId));

    const totalReviews = employeeReviews.length;
    
    if (totalReviews === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratings: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    employeeReviews.forEach((review) => {
      const rating = review.rating as 1 | 2 | 3 | 4 | 5;
      ratings[rating]++;
      totalRating += rating;
    });

    return {
      averageRating: parseFloat((totalRating / totalReviews).toFixed(2)),
      totalReviews,
      ratings
    };
  }

  async markReviewAsRewarded(reviewId: string): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ rewardedAt: new Date() })
      .where(eq(reviews.id, reviewId))
      .returning();
    return review || undefined;
  }

  // Testimonial operations
  async createTestimonial(testimonialData: InsertTestimonial): Promise<Testimonial> {
    const [testimonial] = await db
      .insert(testimonials)
      .values(testimonialData)
      .returning();
    return testimonial;
  }

  async getTestimonials(
    filters?: { status?: string; featured?: boolean; sourceType?: string; sourcePlatform?: string },
    limit?: number
  ): Promise<Testimonial[]> {
    let query = db.select().from(testimonials);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(testimonials.status, filters.status));
    }
    if (filters?.featured !== undefined) {
      conditions.push(eq(testimonials.featured, filters.featured));
    }
    if (filters?.sourceType) {
      conditions.push(eq(testimonials.sourceType, filters.sourceType));
    }
    if (filters?.sourcePlatform) {
      conditions.push(eq(testimonials.sourcePlatform, filters.sourcePlatform));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(testimonials.createdAt)) as typeof query;
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async getTestimonial(id: string): Promise<Testimonial | undefined> {
    const [testimonial] = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.id, id));
    return testimonial || undefined;
  }

  async updateTestimonial(
    id: string,
    updates: Partial<Omit<Testimonial, 'id' | 'createdAt'>>
  ): Promise<Testimonial | undefined> {
    const [testimonial] = await db
      .update(testimonials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(testimonials.id, id))
      .returning();
    return testimonial || undefined;
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    const result = await db.delete(testimonials).where(eq(testimonials.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async importTestimonials(testimonialsList: InsertTestimonial[]): Promise<Testimonial[]> {
    if (testimonialsList.length === 0) return [];
    
    const imported = await db
      .insert(testimonials)
      .values(testimonialsList)
      .returning();
    return imported;
  }

  async getTestimonialStats(): Promise<{ totalCount: number; averageRating: number; platformCounts: Record<string, number> }> {
    const allTestimonials = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.status, 'published'));
    
    const totalCount = allTestimonials.length;
    const averageRating = totalCount > 0
      ? allTestimonials.reduce((sum, t) => sum + t.rating, 0) / totalCount
      : 0;
    
    const platformCounts: Record<string, number> = {};
    allTestimonials.forEach(t => {
      const platform = t.sourcePlatform || 'customer';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });
    
    return { totalCount, averageRating, platformCounts };
  }

  // Wallet Payout operations
  async createWalletPayout(payout: InsertWalletPayout): Promise<WalletPayout> {
    const [created] = await db.insert(walletPayouts).values(payout).returning();
    return created;
  }

  async getWalletPayoutsByUser(userId: string): Promise<WalletPayout[]> {
    return await db.select().from(walletPayouts).where(eq(walletPayouts.userId, userId)).orderBy(desc(walletPayouts.requestedAt));
  }

  async getPendingPayouts(): Promise<WalletPayout[]> {
    return await db.select().from(walletPayouts).where(eq(walletPayouts.status, 'pending')).orderBy(walletPayouts.requestedAt);
  }

  async updateWalletPayout(payoutId: string, updates: Partial<WalletPayout>): Promise<WalletPayout | undefined> {
    const [updated] = await db.update(walletPayouts).set(updates).where(eq(walletPayouts.id, payoutId)).returning();
    return updated || undefined;
  }

  async hasPendingPayout(userId: string): Promise<boolean> {
    const [pending] = await db.select().from(walletPayouts)
      .where(and(eq(walletPayouts.userId, userId), eq(walletPayouts.status, 'pending')))
      .limit(1);
    return !!pending;
  }

  // Treasury limits operations (admin configurable up to 500M JCMOVES)
  async getTreasuryLimits(): Promise<TreasuryLimit[]> {
    return await db.select().from(treasuryLimits).orderBy(treasuryLimits.limitType);
  }

  async getTreasuryLimit(limitType: string): Promise<TreasuryLimit | undefined> {
    const [limit] = await db.select().from(treasuryLimits).where(eq(treasuryLimits.limitType, limitType));
    return limit || undefined;
  }

  async updateTreasuryLimit(limitType: string, limitValue: number, updatedBy: string, notes?: string): Promise<TreasuryLimit | undefined> {
    // Validate limit is within 500M cap
    const maxLimit = 500000000;
    if (limitValue > maxLimit) {
      throw new Error(`Limit cannot exceed ${maxLimit.toLocaleString()} JCMOVES`);
    }
    
    // Try to update first
    const [updated] = await db.update(treasuryLimits)
      .set({ 
        limitValue: limitValue.toString(),
        updatedBy,
        notes,
        updatedAt: new Date()
      })
      .where(eq(treasuryLimits.limitType, limitType))
      .returning();
    
    // If no record found, create it (upsert behavior)
    if (!updated) {
      const defaultNotes: Record<string, string> = {
        'per_transaction': 'Maximum tokens per single transfer - Admin configurable up to 500M',
        'daily': 'Maximum daily transfer limit - Admin configurable up to 500M',
        'minimum_reserve': 'Minimum tokens to keep in treasury'
      };
      
      const [created] = await db.insert(treasuryLimits)
        .values({
          limitType,
          limitValue: limitValue.toString(),
          updatedBy,
          notes: notes || defaultNotes[limitType] || 'Admin-configured limit'
        })
        .returning();
      return created || undefined;
    }
    
    return updated;
  }

  // Token conversions operations (JCMOVES/SOL/ETH swap tracking)
  async createTokenConversion(conversion: InsertTokenConversion): Promise<TokenConversion> {
    const [created] = await db.insert(tokenConversions).values(conversion).returning();
    return created;
  }

  async getTokenConversions(userId?: string, limit?: number): Promise<TokenConversion[]> {
    let query = db.select().from(tokenConversions);
    
    if (userId) {
      query = query.where(eq(tokenConversions.userId, userId)) as typeof query;
    }
    
    query = query.orderBy(desc(tokenConversions.createdAt)) as typeof query;
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async updateTokenConversionStatus(id: string, status: string, transactionHash?: string, executedAt?: Date): Promise<TokenConversion | undefined> {
    const updateData: any = { status };
    if (transactionHash) updateData.transactionHash = transactionHash;
    if (executedAt) updateData.executedAt = executedAt;
    
    const [updated] = await db.update(tokenConversions)
      .set(updateData)
      .where(eq(tokenConversions.id, id))
      .returning();
    return updated || undefined;
  }

  // Square invoice operations
  async createSquareInvoice(invoice: InsertSquareInvoice): Promise<SquareInvoice> {
    const [created] = await db.insert(squareInvoices).values(invoice).returning();
    return created;
  }

  async getSquareInvoices(filters?: { leadId?: string; status?: string }, limit?: number): Promise<SquareInvoice[]> {
    let query = db.select().from(squareInvoices);
    
    const conditions: any[] = [];
    if (filters?.leadId) conditions.push(eq(squareInvoices.leadId, filters.leadId));
    if (filters?.status) conditions.push(eq(squareInvoices.status, filters.status));
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    query = query.orderBy(desc(squareInvoices.createdAt)) as typeof query;
    
    if (limit) {
      query = query.limit(limit) as typeof query;
    }
    
    return await query;
  }

  async getSquareInvoice(id: string): Promise<SquareInvoice | undefined> {
    const [invoice] = await db.select().from(squareInvoices).where(eq(squareInvoices.id, id));
    return invoice || undefined;
  }

  async getSquareInvoiceBySquareId(squareInvoiceId: string): Promise<SquareInvoice | undefined> {
    const [invoice] = await db.select().from(squareInvoices).where(eq(squareInvoices.squareInvoiceId, squareInvoiceId));
    return invoice || undefined;
  }

  async updateSquareInvoiceStatus(squareInvoiceId: string, status: string, paidAt?: Date): Promise<SquareInvoice | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (paidAt) updateData.paidAt = paidAt;
    if (status === 'sent') updateData.sentAt = new Date();
    
    const [updated] = await db.update(squareInvoices)
      .set(updateData)
      .where(eq(squareInvoices.squareInvoiceId, squareInvoiceId))
      .returning();
    return updated || undefined;
  }

  // Buyback fund operations
  async getBuybackFundStats(): Promise<{ tokenBalance: number; totalTokensCollected: number; feeContributionCount: number; lastUpdated: Date | null }> {
    const [fund] = await db.select().from(buybackFund).limit(1);
    
    if (!fund) {
      return {
        tokenBalance: 0,
        totalTokensCollected: 0,
        feeContributionCount: 0,
        lastUpdated: null
      };
    }
    
    return {
      tokenBalance: parseFloat(fund.tokenBalance || '0'),
      totalTokensCollected: parseFloat(fund.totalTokensCollected || '0'),
      feeContributionCount: fund.feeContributionCount || 0,
      lastUpdated: fund.lastUpdated
    };
  }

  async recordBuybackFeeContribution(amount: number, sourcePayoutId?: string): Promise<void> {
    const [existing] = await db.select().from(buybackFund).limit(1);
    
    if (existing) {
      const currentBalance = parseFloat(existing.tokenBalance || '0');
      const totalCollected = parseFloat(existing.totalTokensCollected || '0');
      const contributionCount = existing.feeContributionCount || 0;
      
      await db.update(buybackFund)
        .set({
          tokenBalance: (currentBalance + amount).toFixed(8),
          totalTokensCollected: (totalCollected + amount).toFixed(8),
          feeContributionCount: contributionCount + 1,
          lastUpdated: new Date()
        })
        .where(eq(buybackFund.id, existing.id));
    } else {
      await db.insert(buybackFund).values({
        tokenBalance: amount.toFixed(8),
        totalTokensCollected: amount.toFixed(8),
        feeContributionCount: 1,
        lastUpdated: new Date()
      });
    }
    
    console.log(`[BUYBACK] Recorded fee contribution: ${amount} JCMOVES${sourcePayoutId ? ` from payout ${sourcePayoutId}` : ''}`);
  }

  // Snow removal operations
  async getSnowCustomers(activeOnly: boolean = true): Promise<SnowCustomer[]> {
    if (activeOnly) {
      return await db.select().from(snowCustomers).where(eq(snowCustomers.isActive, true)).orderBy(snowCustomers.name);
    }
    return await db.select().from(snowCustomers).orderBy(snowCustomers.name);
  }

  async getSnowCustomer(id: string): Promise<SnowCustomer | undefined> {
    const [customer] = await db.select().from(snowCustomers).where(eq(snowCustomers.id, id));
    return customer || undefined;
  }

  async createSnowCustomer(customer: InsertSnowCustomer): Promise<SnowCustomer> {
    const [created] = await db.insert(snowCustomers).values(customer).returning();
    return created;
  }

  async updateSnowCustomer(id: string, updates: Partial<InsertSnowCustomer>): Promise<SnowCustomer | undefined> {
    const [updated] = await db.update(snowCustomers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(snowCustomers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSnowCustomer(id: string): Promise<boolean> {
    const result = await db.update(snowCustomers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(snowCustomers.id, id));
    return true;
  }

  async getSnowServiceTypes(activeOnly: boolean = true): Promise<SnowServiceType[]> {
    if (activeOnly) {
      return await db.select().from(snowServiceTypes).where(eq(snowServiceTypes.isActive, true)).orderBy(snowServiceTypes.sortOrder);
    }
    return await db.select().from(snowServiceTypes).orderBy(snowServiceTypes.sortOrder);
  }

  async getSnowServiceType(id: string): Promise<SnowServiceType | undefined> {
    const [serviceType] = await db.select().from(snowServiceTypes).where(eq(snowServiceTypes.id, id));
    return serviceType || undefined;
  }

  async createSnowServiceType(serviceType: InsertSnowServiceType): Promise<SnowServiceType> {
    const [created] = await db.insert(snowServiceTypes).values(serviceType).returning();
    return created;
  }

  async updateSnowServiceType(id: string, updates: Partial<InsertSnowServiceType>): Promise<SnowServiceType | undefined> {
    const [updated] = await db.update(snowServiceTypes)
      .set(updates)
      .where(eq(snowServiceTypes.id, id))
      .returning();
    return updated || undefined;
  }

  async getSnowServiceLogs(filters?: { customerId?: string; monthKey?: string; date?: string }): Promise<SnowServiceLog[]> {
    let query = db.select().from(snowServiceLogs);
    
    const conditions = [];
    if (filters?.customerId) conditions.push(eq(snowServiceLogs.customerId, filters.customerId));
    if (filters?.monthKey) conditions.push(eq(snowServiceLogs.monthKey, filters.monthKey));
    if (filters?.date) conditions.push(eq(snowServiceLogs.serviceDate, filters.date));
    
    if (conditions.length > 0) {
      return await db.select().from(snowServiceLogs).where(and(...conditions)).orderBy(desc(snowServiceLogs.serviceDate));
    }
    return await db.select().from(snowServiceLogs).orderBy(desc(snowServiceLogs.serviceDate));
  }

  async getSnowServiceLog(id: string): Promise<SnowServiceLog | undefined> {
    const [log] = await db.select().from(snowServiceLogs).where(eq(snowServiceLogs.id, id));
    return log || undefined;
  }

  async createSnowServiceLog(log: InsertSnowServiceLog): Promise<SnowServiceLog> {
    const [created] = await db.insert(snowServiceLogs).values(log).returning();
    return created;
  }

  async updateSnowServiceLog(id: string, updates: Partial<InsertSnowServiceLog>): Promise<SnowServiceLog | undefined> {
    const [updated] = await db.update(snowServiceLogs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(snowServiceLogs.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSnowServiceLog(id: string): Promise<boolean> {
    await db.delete(snowServiceLogs).where(eq(snowServiceLogs.id, id));
    return true;
  }

  async getSnowMonthlySummary(monthKey: string): Promise<{ customerId: string; customerName: string; visits: number; totalAmount: number; paidAmount: number }[]> {
    const logs = await db.select().from(snowServiceLogs).where(eq(snowServiceLogs.monthKey, monthKey));
    const customers = await this.getSnowCustomers(false);
    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    
    const summaryMap = new Map<string, { visits: number; totalAmount: number; paidAmount: number }>();
    
    for (const log of logs) {
      const existing = summaryMap.get(log.customerId) || { visits: 0, totalAmount: 0, paidAmount: 0 };
      existing.visits++;
      existing.totalAmount += parseFloat(log.price || '0');
      if (log.status === 'paid') {
        existing.paidAmount += parseFloat(log.price || '0');
      }
      summaryMap.set(log.customerId, existing);
    }
    
    return Array.from(summaryMap.entries()).map(([customerId, stats]) => ({
      customerId,
      customerName: customerMap.get(customerId) || 'Unknown',
      visits: stats.visits,
      totalAmount: stats.totalAmount,
      paidAmount: stats.paidAmount
    }));
  }
  
  // Jewelry items
  async getJewelryItems(status?: string, category?: string): Promise<any[]> {
    const { jewelryItems } = await import("@shared/schema");
    let query = db.select().from(jewelryItems);
    
    const conditions = [];
    if (status) {
      conditions.push(eq(jewelryItems.status, status));
    }
    if (category) {
      conditions.push(eq(jewelryItems.category, category));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(jewelryItems.createdAt));
  }
  
  async getJewelryItem(id: string): Promise<any | undefined> {
    const { jewelryItems } = await import("@shared/schema");
    const [item] = await db.select().from(jewelryItems).where(eq(jewelryItems.id, id));
    return item;
  }
  
  async createJewelryItem(item: any): Promise<any> {
    const { jewelryItems } = await import("@shared/schema");
    const [created] = await db.insert(jewelryItems).values(item).returning();
    return created;
  }
  
  async updateJewelryItem(id: string, updates: any): Promise<any | undefined> {
    const { jewelryItems } = await import("@shared/schema");
    const [updated] = await db.update(jewelryItems).set(updates).where(eq(jewelryItems.id, id)).returning();
    return updated;
  }
  
  async deleteJewelryItem(id: string): Promise<void> {
    const { jewelryItems } = await import("@shared/schema");
    await db.delete(jewelryItems).where(eq(jewelryItems.id, id));
  }

  async getStakingTiers(): Promise<StakingTier[]> {
    return db.select().from(stakingTiers).where(eq(stakingTiers.isActive, true)).orderBy(stakingTiers.durationDays);
  }

  async getUserStakes(userId: string): Promise<(Stake & { tier: StakingTier })[]> {
    const results = await db
      .select()
      .from(stakes)
      .innerJoin(stakingTiers, eq(stakes.tierId, stakingTiers.id))
      .where(eq(stakes.userId, userId))
      .orderBy(desc(stakes.createdAt));
    return results.map(r => ({ ...r.stakes, tier: r.staking_tiers }));
  }

  private STAKING_TREASURY_USER_ID = "staking-treasury-system";

  async getStakingTreasuryBalance(): Promise<{ tokenBalance: string; totalDeposited: string; totalPaidOut: string }> {
    const wallet = await this.getWalletAccount(this.STAKING_TREASURY_USER_ID);
    const balance = wallet?.tokenBalance || "0.00000000";
    const totalDeposited = wallet?.totalEarned || "0.00000000";
    const totalPaidOut = wallet?.totalRedeemed || "0.00000000";
    return { tokenBalance: balance, totalDeposited, totalPaidOut };
  }

  async createStake(userId: string, tierId: string, amount: number): Promise<Stake> {
    const [tier] = await db.select().from(stakingTiers).where(eq(stakingTiers.id, tierId));
    if (!tier) throw new Error("Invalid staking tier");
    if (!tier.isActive) throw new Error("This staking tier is not active");
    if (amount < parseFloat(tier.minStake)) throw new Error(`Minimum stake is ${tier.minStake} JCMOVES`);
    if (tier.maxStake && amount > parseFloat(tier.maxStake)) throw new Error(`Maximum stake is ${tier.maxStake} JCMOVES`);

    let wallet = await this.getWalletAccount(userId);
    if (!wallet) throw new Error("Wallet not found");
    const balance = parseFloat(wallet.tokenBalance || "0");
    if (balance < amount) throw new Error("Insufficient balance");

    let effectiveAnnualRate = parseFloat(tier.annualRatePercent);
    const isDiamond = tier.name === "Diamond";
    if (isDiamond) {
      effectiveAnnualRate += 10;
    }
    const dailyRate = effectiveAnnualRate / 365 / 100;
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + (tier.durationDays || 36500));

    await this.updateWalletAccount(userId, {
      tokenBalance: (balance - amount).toFixed(8),
    });

    let treasuryWallet = await this.getWalletAccount(this.STAKING_TREASURY_USER_ID);
    if (!treasuryWallet) {
      treasuryWallet = await this.createWalletAccount({ userId: this.STAKING_TREASURY_USER_ID });
    }
    const treasuryBalance = parseFloat(treasuryWallet.tokenBalance || "0");
    const treasuryDeposited = parseFloat(treasuryWallet.totalEarned || "0");
    await this.updateWalletAccount(this.STAKING_TREASURY_USER_ID, {
      tokenBalance: (treasuryBalance + amount).toFixed(8),
      totalEarned: (treasuryDeposited + amount).toFixed(8),
    });

    const [stake] = await db.insert(stakes).values({
      userId,
      tierId,
      amount: amount.toFixed(8),
      dailyRate: dailyRate.toFixed(8),
      endsAt,
      startedAt: new Date(),
    }).returning();

    return stake;
  }

  async claimStakingRewards(stakeId: string, userId: string): Promise<{ earned: number }> {
    const [stake] = await db.select().from(stakes).where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)));
    if (!stake) throw new Error("Stake not found");
    if (stake.status !== "active") throw new Error("Stake is not active");

    const now = new Date();
    const lastPayout = new Date(stake.lastPayoutAt);
    const daysSinceLastPayout = (now.getTime() - lastPayout.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPayout < 0.01) throw new Error("No rewards to claim yet");

    const stakeAmount = parseFloat(stake.amount);
    let dailyRate = parseFloat(stake.dailyRate);
    let earned = 0;

    const [tier] = await db.select().from(stakingTiers).where(eq(stakingTiers.id, stake.tierId));
    if (tier && tier.name === "Diamond") {
      const celebrationBonusDays = 90;
      const baseRate = parseFloat(tier.annualRatePercent) / 365 / 100;
      const bonusRate = (parseFloat(tier.annualRatePercent) + 10) / 365 / 100;
      const stakeStartTime = new Date(stake.startedAt).getTime();
      const celebrationEndTime = stakeStartTime + celebrationBonusDays * 24 * 60 * 60 * 1000;
      const lastPayoutTime = lastPayout.getTime();
      const nowTime = now.getTime();

      if (nowTime <= celebrationEndTime) {
        earned = stakeAmount * bonusRate * daysSinceLastPayout;
      } else if (lastPayoutTime >= celebrationEndTime) {
        earned = stakeAmount * baseRate * daysSinceLastPayout;
        if (dailyRate > baseRate * 1.05) {
          dailyRate = baseRate;
          await db.update(stakes).set({ dailyRate: baseRate.toFixed(8) }).where(eq(stakes.id, stakeId));
        }
      } else {
        const bonusDays = (celebrationEndTime - lastPayoutTime) / (1000 * 60 * 60 * 24);
        const baseDays = (nowTime - celebrationEndTime) / (1000 * 60 * 60 * 24);
        earned = stakeAmount * bonusRate * bonusDays + stakeAmount * baseRate * baseDays;
        dailyRate = baseRate;
        await db.update(stakes).set({ dailyRate: baseRate.toFixed(8) }).where(eq(stakes.id, stakeId));
      }
    } else {
      earned = stakeAmount * dailyRate * daysSinceLastPayout;
    }

    let treasuryWallet = await this.getWalletAccount(this.STAKING_TREASURY_USER_ID);
    if (!treasuryWallet) {
      treasuryWallet = await this.createWalletAccount({ userId: this.STAKING_TREASURY_USER_ID });
    }
    const treasuryBalance = parseFloat(treasuryWallet.tokenBalance || "0");
    if (treasuryBalance < earned) throw new Error("Staking treasury has insufficient funds for this claim. Contact admin.");
    const treasuryPaidOut = parseFloat(treasuryWallet.totalRedeemed || "0");
    await this.updateWalletAccount(this.STAKING_TREASURY_USER_ID, {
      tokenBalance: (treasuryBalance - earned).toFixed(8),
      totalRedeemed: (treasuryPaidOut + earned).toFixed(8),
    });

    await db.update(stakes).set({
      totalEarned: (parseFloat(stake.totalEarned || "0") + earned).toFixed(8),
      lastPayoutAt: now,
    }).where(eq(stakes.id, stakeId));

    await this.creditWalletTokens(userId, earned);

    return { earned };
  }

  async unstake(stakeId: string, userId: string): Promise<{ returned: number; penalty: number; earned: number }> {
    const results = await db.select().from(stakes)
      .innerJoin(stakingTiers, eq(stakes.tierId, stakingTiers.id))
      .where(and(eq(stakes.id, stakeId), eq(stakes.userId, userId)));
    if (results.length === 0) throw new Error("Stake not found");
    const stake = results[0].stakes;
    const tier = results[0].staking_tiers;
    if (stake.status !== "active") throw new Error("Stake is already unstaked");

    const now = new Date();

    if (tier.durationDays > 0) {
      const endsAt = new Date(stake.endsAt);
      if (now < endsAt) {
        const remaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        throw new Error(`This ${tier.name} stake is locked for ${remaining} more day${remaining !== 1 ? "s" : ""}. You can unstake after the lockup period ends.`);
      }
    }
    const lastPayout = new Date(stake.lastPayoutAt);
    const daysSinceLastPayout = (now.getTime() - lastPayout.getTime()) / (1000 * 60 * 60 * 24);
    const stakeAmount = parseFloat(stake.amount);
    const dailyRate = parseFloat(stake.dailyRate);
    const pendingEarned = stakeAmount * dailyRate * daysSinceLastPayout;

    const penalty = 0;
    const returned = stakeAmount + pendingEarned;

    let treasuryWallet = await this.getWalletAccount(this.STAKING_TREASURY_USER_ID);
    if (!treasuryWallet) {
      treasuryWallet = await this.createWalletAccount({ userId: this.STAKING_TREASURY_USER_ID });
    }
    const treasuryBalance = parseFloat(treasuryWallet.tokenBalance || "0");
    if (treasuryBalance < returned) throw new Error("Staking treasury has insufficient funds for unstaking. Contact admin.");
    const treasuryPaidOut = parseFloat(treasuryWallet.totalRedeemed || "0");
    await this.updateWalletAccount(this.STAKING_TREASURY_USER_ID, {
      tokenBalance: (treasuryBalance - returned).toFixed(8),
      totalRedeemed: (treasuryPaidOut + returned).toFixed(8),
    });

    await db.update(stakes).set({
      status: "unstaked",
      unstakedAt: now,
      totalEarned: (parseFloat(stake.totalEarned || "0") + pendingEarned).toFixed(8),
      lastPayoutAt: now,
    }).where(eq(stakes.id, stakeId));

    await this.creditWalletTokens(userId, returned);

    return { returned, penalty, earned: pendingEarned };
  }

  // ── New single-pool staking ──────────────────────────────────────────────────

  async getStakingPool(userId: string): Promise<{ stakedBalance: number; unstakeCooldownUntil: Date | null; discountPct: number }> {
    const wallet = await this.getWalletAccount(userId);
    const stakedBalance = parseFloat(wallet?.stakedBalance ?? "0");
    const unstakeCooldownUntil = wallet?.unstakeCooldownUntil ?? null;
    const discountPct = await this.getStakingDiscountPct(userId);
    return { stakedBalance, unstakeCooldownUntil, discountPct };
  }

  async getStakingDiscountPct(userId: string): Promise<number> {
    const wallet = await this.getWalletAccount(userId);
    const stakedBalance = parseFloat(wallet?.stakedBalance ?? "0");
    if (stakedBalance >= 100_000) return 10;
    if (stakedBalance >= 25_000)  return 5;
    return 0;
  }

  async stakeTokens(userId: string, amount: number): Promise<void> {
    let wallet = await this.getWalletAccount(userId);
    if (!wallet) wallet = await this.createWalletAccount({ userId });
    const freeBalance = parseFloat(wallet.tokenBalance || "0");
    if (freeBalance < amount) throw new Error("Insufficient free balance to stake");
    const currentStaked = parseFloat(wallet.stakedBalance ?? "0");
    const cooldownDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.updateWalletAccount(userId, {
      tokenBalance: (freeBalance - amount).toFixed(8),
      stakedBalance: (currentStaked + amount).toFixed(8),
      unstakeCooldownUntil: cooldownDate,
    });
  }

  async unstakeTokens(userId: string): Promise<{ returned: number }> {
    const wallet = await this.getWalletAccount(userId);
    if (!wallet) throw new Error("Wallet not found");
    const stakedBalance = parseFloat(wallet.stakedBalance ?? "0");
    if (stakedBalance <= 0) throw new Error("No staked balance to unstake");
    const cooldownUntil = wallet.unstakeCooldownUntil;
    if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
      const hours = Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 3600000);
      throw new Error(`Unstake cooldown active. Available in ${hours} hour${hours !== 1 ? "s" : ""}.`);
    }
    const freeBalance = parseFloat(wallet.tokenBalance || "0");
    await this.updateWalletAccount(userId, {
      tokenBalance: (freeBalance + stakedBalance).toFixed(8),
      stakedBalance: "0.00000000",
      unstakeCooldownUntil: null,
    });
    return { returned: stakedBalance };
  }

  async getStakingLeaderboard(limit = 20): Promise<{ userId: string; stakedBalance: number; rank: number }[]> {
    const { pool: dbPool } = await import('./db');
    const { rows } = await dbPool.query<{ user_id: string; staked_balance: string }>(
      `SELECT user_id, staked_balance FROM wallet_accounts WHERE COALESCE(staked_balance::numeric,0) > 0 ORDER BY staked_balance::numeric DESC LIMIT $1`,
      [limit]
    );
    return rows.map((r, i) => ({ userId: r.user_id, stakedBalance: parseFloat(r.staked_balance), rank: i + 1 }));
  }

  // ── Worker Availability & Goals ─────────────────────────────────────────────

  async getWorkerDayBlocks(userId: string): Promise<WorkerDayBlock[]> {
    return db.select().from(workerDayBlocks).where(eq(workerDayBlocks.userId, userId)).orderBy(workerDayBlocks.date);
  }

  async createWorkerDayBlock(userId: string, date: string, reason?: string): Promise<WorkerDayBlock> {
    const [row] = await db.insert(workerDayBlocks).values({ userId, date, reason }).returning();
    return row;
  }

  async deleteWorkerDayBlock(id: number, userId: string): Promise<boolean> {
    const res = await db.delete(workerDayBlocks).where(and(eq(workerDayBlocks.id, id), eq(workerDayBlocks.userId, userId)));
    return (res.rowCount ?? 0) > 0;
  }

  async getWorkerSchedule(userId: string): Promise<WorkerScheduleRow[]> {
    return db.select().from(workerSchedule).where(eq(workerSchedule.userId, userId)).orderBy(workerSchedule.dayOfWeek);
  }

  async upsertWorkerSchedule(userId: string, dayOfWeek: number, startHour: number, endHour: number, isAvailable: boolean): Promise<WorkerScheduleRow> {
    const [row] = await db.insert(workerSchedule)
      .values({ userId, dayOfWeek, startHour, endHour, isAvailable })
      .onConflictDoUpdate({ target: [workerSchedule.userId, workerSchedule.dayOfWeek], set: { startHour, endHour, isAvailable } })
      .returning();
    return row;
  }

  async getWorkerGoals(userId: string): Promise<WorkerGoal | undefined> {
    const [row] = await db.select().from(workerGoals).where(eq(workerGoals.userId, userId));
    return row;
  }

  async upsertWorkerGoals(userId: string, goals: { weeklyJobGoal?: number; monthlyJobGoal?: number; preferredJobSize?: string; notes?: string; setByAdminId?: string }): Promise<WorkerGoal> {
    const [row] = await db.insert(workerGoals)
      .values({ userId, ...goals, updatedAt: new Date() })
      .onConflictDoUpdate({ target: workerGoals.userId, set: { ...goals, updatedAt: new Date() } })
      .returning();
    return row;
  }

  async getWorkerJobStats(userId: string): Promise<{ thisWeek: number; thisMonth: number; allTime: number }> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedLeads = await db.select({ confirmedDate: leads.confirmedDate, crewMembers: leads.crewMembers, assignedToUserId: leads.assignedToUserId })
      .from(leads)
      .where(eq(leads.status, "completed"));

    let allTime = 0, thisWeek = 0, thisMonth = 0;
    for (const lead of completedLeads) {
      const members = lead.crewMembers || [];
      const isAssigned = lead.assignedToUserId === userId || members.includes(userId);
      if (!isAssigned) continue;
      allTime++;
      if (lead.confirmedDate) {
        const d = new Date(lead.confirmedDate);
        if (d >= startOfMonth) thisMonth++;
        if (d >= startOfWeek) thisWeek++;
      }
    }
    return { thisWeek, thisMonth, allTime };
  }

  async getAllWorkersAvailability(): Promise<{ user: User; goals: WorkerGoal | null; thisWeek: number; thisMonth: number; blockedDates: string[]; schedule: WorkerScheduleRow[] }[]> {
    const employees = await this.getApprovedEmployees();
    const results = await Promise.all(employees.map(async (user) => {
      const [goals, stats, blocks, schedule] = await Promise.all([
        this.getWorkerGoals(user.id).then(g => g ?? null),
        this.getWorkerJobStats(user.id),
        this.getWorkerDayBlocks(user.id),
        this.getWorkerSchedule(user.id),
      ]);
      return { user, goals, thisWeek: stats.thisWeek, thisMonth: stats.thisMonth, blockedDates: blocks.map(b => b.date), schedule };
    }));
    return results;
  }

  async createSponsor(sponsor: InsertSponsor): Promise<Sponsor> {
    const [s] = await db.insert(sponsors).values(sponsor).returning();
    return s;
  }

  async getSponsors(status?: string): Promise<Sponsor[]> {
    if (status) {
      return await db.select().from(sponsors).where(eq(sponsors.status, status)).orderBy(sponsors.tier, desc(sponsors.featured), desc(sponsors.createdAt));
    }
    return await db.select().from(sponsors).orderBy(sponsors.tier, desc(sponsors.featured), desc(sponsors.createdAt));
  }

  async getSponsor(id: string): Promise<Sponsor | undefined> {
    const [s] = await db.select().from(sponsors).where(eq(sponsors.id, id));
    return s || undefined;
  }

  async updateSponsorStatus(id: string, status: string): Promise<Sponsor | undefined> {
    const [s] = await db.update(sponsors).set({ status }).where(eq(sponsors.id, id)).returning();
    return s || undefined;
  }

  async updateSponsorFeatured(id: string, featured: boolean): Promise<Sponsor | undefined> {
    const [s] = await db.update(sponsors).set({ featured }).where(eq(sponsors.id, id)).returning();
    return s || undefined;
  }

  async getWorkerHourOverrides(userId: string): Promise<WorkerHourOverride[]> {
    return await db.select().from(workerHourOverrides).where(eq(workerHourOverrides.userId, userId)).orderBy(workerHourOverrides.date);
  }

  async upsertWorkerHourOverride(userId: string, date: string, startHour: number, endHour: number, note?: string): Promise<WorkerHourOverride> {
    const [row] = await db
      .insert(workerHourOverrides)
      .values({ userId, date, startHour, endHour, note: note ?? null })
      .onConflictDoUpdate({
        target: [workerHourOverrides.userId, workerHourOverrides.date],
        set: { startHour, endHour, note: note ?? null },
      })
      .returning();
    return row;
  }

  async deleteWorkerHourOverride(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(workerHourOverrides).where(and(eq(workerHourOverrides.id, id), eq(workerHourOverrides.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getWorkerCalendarData(userId: string, year: number, month: number): Promise<{
    jobs: { id: string; serviceType: string; fromAddress: string | null; confirmedFromAddress: string | null; confirmedDate: string | null; moveDate: string | null; confirmedHours: number | null; status: string; crewMembers: string[] | null; assignedToUserId: string | null; effectiveDate: string | null }[];
    blocks: WorkerDayBlock[];
    hourOverrides: WorkerHourOverride[];
    schedule: WorkerScheduleRow[];
  }> {
    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const [jobs, blocks, hourOverrides, schedule] = await Promise.all([
      db.select({
        id: leads.id,
        serviceType: leads.serviceType,
        fromAddress: leads.fromAddress,
        confirmedFromAddress: leads.confirmedFromAddress,
        confirmedDate: leads.confirmedDate,
        moveDate: leads.moveDate,
        confirmedHours: leads.confirmedHours,
        status: leads.status,
        crewMembers: leads.crewMembers,
        assignedToUserId: leads.assignedToUserId,
        effectiveDate: sql<string>`COALESCE(${leads.confirmedDate}, ${leads.moveDate})`,
      }).from(leads).where(
        and(
          or(
            eq(leads.assignedToUserId, userId),
            sql`${userId} = ANY(COALESCE(${leads.crewMembers}, ARRAY[]::text[]))`
          ),
          or(
            and(gte(leads.confirmedDate, startDate), lte(leads.confirmedDate, endDate)),
            and(gte(leads.moveDate, startDate), lte(leads.moveDate, endDate))
          ),
          not(inArray(leads.status, ["completed", "cancelled", "paid"]))
        )
      ),
      db.select().from(workerDayBlocks).where(
        and(eq(workerDayBlocks.userId, userId), gte(workerDayBlocks.date, startDate), lte(workerDayBlocks.date, endDate))
      ),
      db.select().from(workerHourOverrides).where(
        and(eq(workerHourOverrides.userId, userId), gte(workerHourOverrides.date, startDate), lte(workerHourOverrides.date, endDate))
      ),
      db.select().from(workerSchedule).where(eq(workerSchedule.userId, userId)),
    ]);

    // Post-filter jobs to only those whose effective date (confirmedDate ?? moveDate) falls within the viewed month.
    // This prevents edge cases where both dates exist in different months from rendering in the wrong month.
    const filteredJobs = jobs.filter(j => {
      const eff = j.effectiveDate;
      return eff !== null && eff >= startDate && eff <= endDate;
    });

    return { jobs: filteredJobs, blocks, hourOverrides, schedule };
  }
}

export const storage = new DatabaseStorage();
