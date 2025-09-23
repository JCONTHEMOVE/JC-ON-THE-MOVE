import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, jsonb, decimal, integer, date, boolean, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  serviceType: text("service_type").notNull(), // 'residential', 'commercial', 'junk'
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address"),
  moveDate: text("move_date"),
  propertySize: text("property_size"),
  details: text("details"),
  status: text("status").notNull().default("new"), // 'new', 'contacted', 'quoted', 'accepted', 'in_progress', 'completed'
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("employee"), // 'business_owner', 'employee', 'admin'
  referralCode: varchar("referral_code").unique(), // Unique code for users to share
  referredByUserId: varchar("referred_by_user_id"), // Who referred this user - foreign key defined separately
  referralCount: integer("referral_count").default(0), // Number of successful referrals made
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Rewards system tables
export const rewards = pgTable("rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rewardType: text("reward_type").notNull(), // 'daily_checkin', 'booking', 'referral', 'job_completion'
  tokenAmount: decimal("token_amount", { precision: 18, scale: 8 }).notNull(),
  cashValue: decimal("cash_value", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'redeemed'
  earnedDate: timestamp("earned_date").notNull().default(sql`now()`),
  redeemedDate: timestamp("redeemed_date"),
  referenceId: varchar("reference_id"), // Link to lead/booking ID that generated reward
  metadata: jsonb("metadata"), // Additional data like streak count, job details, etc.
}, (table) => [
  // General index for user rewards
  index("idx_rewards_user_type").on(table.userId, table.rewardType),
  // Partial unique index: only one signup_bonus per user (allows multiple of other types)
  uniqueIndex("uq_signup_bonus_per_user").on(table.userId, table.rewardType).where(sql`${table.rewardType} = 'signup_bonus'`),
]);

export const dailyCheckins = pgTable("daily_checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  checkinDate: date("checkin_date").notNull(),
  deviceFingerprint: text("device_fingerprint"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  rewardClaimed: boolean("reward_claimed").default(false),
  streakCount: integer("streak_count").default(1),
  riskScore: integer("risk_score").default(0), // 0-100 fraud risk assessment
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_user_checkin_date").on(table.userId, table.checkinDate),
]);

export const walletAccounts = pgTable("wallet_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  walletAddress: text("wallet_address"),
  tokenBalance: decimal("token_balance", { precision: 18, scale: 8 }).default("0.00000000"),
  cashBalance: decimal("cash_balance", { precision: 10, scale: 2 }).default("0.00"),
  totalEarned: decimal("total_earned", { precision: 18, scale: 8 }).default("0.00000000"),
  totalRedeemed: decimal("total_redeemed", { precision: 18, scale: 8 }).default("0.00000000"),
  totalCashedOut: decimal("total_cashed_out", { precision: 10, scale: 2 }).default("0.00"),
  lastActivity: timestamp("last_activity").default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const cashoutRequests = pgTable("cashout_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenAmount: decimal("token_amount", { precision: 18, scale: 8 }).notNull(),
  cashAmount: decimal("cash_amount", { precision: 10, scale: 2 }).notNull(),
  conversionRate: decimal("conversion_rate", { precision: 18, scale: 8 }).notNull(), // tokens per USD
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'cancelled'
  bankDetails: jsonb("bank_details"), // Encrypted bank account info
  externalTransactionId: text("external_transaction_id"), // Reference from payment processor
  processedDate: timestamp("processed_date"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const fraudLogs = pgTable("fraud_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  eventType: text("event_type").notNull(), // 'suspicious_checkin', 'multiple_devices', 'impossible_travel', etc.
  riskScore: integer("risk_score").notNull(),
  details: jsonb("details").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  actionTaken: text("action_taken"), // 'blocked', 'flagged', 'requires_verification', etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

// Treasury management system
export const treasuryAccounts = pgTable("treasury_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountName: text("account_name").notNull().default("Main Treasury"), // Allow multiple treasury accounts
  totalFunding: decimal("total_funding", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total USD deposited
  totalDistributed: decimal("total_distributed", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total USD value of distributed tokens
  availableFunding: decimal("available_funding", { precision: 10, scale: 2 }).notNull().default("0.00"), // Remaining balance
  tokenReserve: decimal("token_reserve", { precision: 18, scale: 8 }).notNull().default("0.00000000"), // Tokens available for distribution
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const fundingDeposits = pgTable("funding_deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treasuryAccountId: varchar("treasury_account_id").notNull().references(() => treasuryAccounts.id),
  depositedBy: varchar("deposited_by").notNull().references(() => users.id),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).notNull(), // USD amount deposited
  tokensPurchased: decimal("tokens_purchased", { precision: 18, scale: 8 }).notNull(), // Tokens acquired with deposit
  tokenPrice: decimal("token_price", { precision: 10, scale: 8 }).notNull(), // Price per token at time of deposit
  depositMethod: text("deposit_method").notNull().default("manual"), // 'manual', 'stripe', 'bank_transfer', 'moonshot'
  status: text("status").notNull().default("completed"), // 'pending', 'completed', 'failed'
  externalTransactionId: text("external_transaction_id"), // Stripe payment intent ID, Moonshot transaction hash, etc.
  moonshotMetadata: jsonb("moonshot_metadata"), // Moonshot-specific data: accountId, transferHash, tokenSymbol, etc.
  notes: text("notes"), // Optional notes about the deposit
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const reserveTransactions = pgTable("reserve_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treasuryAccountId: varchar("treasury_account_id").notNull().references(() => treasuryAccounts.id),
  transactionType: text("transaction_type").notNull(), // 'deposit', 'distribution', 'refund', 'adjustment'
  relatedEntityType: text("related_entity_type"), // 'reward', 'signup_bonus', 'cashout'
  relatedEntityId: varchar("related_entity_id"), // ID of related record
  tokenAmount: decimal("token_amount", { precision: 18, scale: 8 }).notNull(),
  cashValue: decimal("cash_value", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(), // Available funding after transaction
  tokenReserveAfter: decimal("token_reserve_after", { precision: 18, scale: 8 }).notNull(), // Token reserve after transaction
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_treasury_transactions").on(table.treasuryAccountId, table.transactionType),
]);

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  status: true,
  assignedToUserId: true, // Assigned internally when employee accepts job
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  role: true, // Role set during user creation/management
  createdAt: true,
  updatedAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

// Rewards system schemas
export const insertRewardSchema = createInsertSchema(rewards).omit({
  id: true,
  status: true,
  earnedDate: true,
  redeemedDate: true,
});

export const insertDailyCheckinSchema = createInsertSchema(dailyCheckins).omit({
  id: true,
  rewardClaimed: true,
  streakCount: true,
  riskScore: true,
  createdAt: true,
});

export const insertWalletAccountSchema = createInsertSchema(walletAccounts).omit({
  id: true,
  tokenBalance: true,
  cashBalance: true,
  totalEarned: true,
  totalRedeemed: true,
  totalCashedOut: true,
  lastActivity: true,
  createdAt: true,
});

export const insertCashoutRequestSchema = createInsertSchema(cashoutRequests).omit({
  id: true,
  status: true,
  processedDate: true,
  failureReason: true,
  createdAt: true,
});

export const insertFraudLogSchema = createInsertSchema(fraudLogs).omit({
  id: true,
  createdAt: true,
});

// Rewards system types
export type InsertReward = z.infer<typeof insertRewardSchema>;
export type Reward = typeof rewards.$inferSelect;
export type InsertDailyCheckin = z.infer<typeof insertDailyCheckinSchema>;
export type DailyCheckin = typeof dailyCheckins.$inferSelect;
export type InsertWalletAccount = z.infer<typeof insertWalletAccountSchema>;
export type WalletAccount = typeof walletAccounts.$inferSelect;
export type InsertCashoutRequest = z.infer<typeof insertCashoutRequestSchema>;
export type CashoutRequest = typeof cashoutRequests.$inferSelect;
export type InsertFraudLog = z.infer<typeof insertFraudLogSchema>;
export type FraudLog = typeof fraudLogs.$inferSelect;

// Treasury system schemas
export const insertTreasuryAccountSchema = createInsertSchema(treasuryAccounts).omit({
  id: true,
  totalFunding: true,
  totalDistributed: true,
  availableFunding: true,
  tokenReserve: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFundingDepositSchema = createInsertSchema(fundingDeposits).omit({
  id: true,
  createdAt: true,
});

export const insertReserveTransactionSchema = createInsertSchema(reserveTransactions).omit({
  id: true,
  createdAt: true,
});

// Treasury system types
export type InsertTreasuryAccount = z.infer<typeof insertTreasuryAccountSchema>;
export type TreasuryAccount = typeof treasuryAccounts.$inferSelect;
export type InsertFundingDeposit = z.infer<typeof insertFundingDepositSchema>;
export type FundingDeposit = typeof fundingDeposits.$inferSelect;
export type InsertReserveTransaction = z.infer<typeof insertReserveTransactionSchema>;
export type ReserveTransaction = typeof reserveTransactions.$inferSelect;
