import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, index, jsonb, decimal, integer, bigint, date, boolean, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define photo structure for job documentation
export const jobPhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  type: z.enum(["before", "after", "progress", "issue"]),
  description: z.string().optional(),
  timestamp: z.string().datetime(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
});

export type JobPhoto = z.infer<typeof jobPhotoSchema>;

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
  photos: jsonb("photos").default("[]"), // Array of photo objects with metadata
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
  role: text("role").notNull().default("employee"), // 'admin', 'employee', 'customer'
  referralCode: varchar("referral_code").unique(), // Unique code for users to share
  referredByUserId: varchar("referred_by_user_id"), // Who referred this user - foreign key defined separately
  referralCount: integer("referral_count").default(0), // Number of successful referrals made
  pushSubscription: jsonb("push_subscription"), // Store push notification subscription data
  notificationsEnabled: boolean("notifications_enabled").default(true), // User preference for notifications
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications table for real-time updates
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'job_assigned', 'job_status_change', 'new_message', 'system_alert'
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"), // Additional data like job ID, status info
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
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

// Multi-currency crypto wallet system
export const supportedCurrencies = pgTable("supported_currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(), // BTC, ETH, SOL, JCMOVES, etc.
  name: text("name").notNull(), // Bitcoin, Ethereum, Solana, JCMOVES Token
  network: text("network").notNull(), // bitcoin, ethereum, solana, polygon, etc.
  contractAddress: text("contract_address"), // For tokens (null for native currencies)
  decimals: integer("decimals").notNull().default(18), // Number of decimal places
  isActive: boolean("is_active").notNull().default(true),
  minimumBalance: decimal("minimum_balance", { precision: 18, scale: 8 }).default("0.00000000"),
  withdrawalFeePercent: decimal("withdrawal_fee_percent", { precision: 5, scale: 2 }).default("0.00"), // e.g., 2.5%
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const userWallets = pgTable("user_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  currencyId: varchar("currency_id").notNull().references(() => supportedCurrencies.id),
  walletAddress: text("wallet_address").notNull(), // The actual crypto address
  privateKeyHash: text("private_key_hash"), // Encrypted private key (for custodial wallets)
  publicKey: text("public_key"),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").notNull().default(true),
  walletType: text("wallet_type").notNull().default("custodial"), // 'custodial', 'external', 'imported'
  metadata: jsonb("metadata"), // Additional data like derivation path, etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  // Unique wallet per user per currency
  uniqueIndex("uq_user_currency_wallet").on(table.userId, table.currencyId),
  index("idx_wallet_address").on(table.walletAddress),
  index("idx_user_wallets").on(table.userId),
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userWalletId: varchar("user_wallet_id").notNull().references(() => userWallets.id),
  transactionHash: text("transaction_hash"), // Blockchain transaction hash
  transactionType: text("transaction_type").notNull(), // 'deposit', 'withdrawal', 'reward', 'transfer'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 18, scale: 8 }).notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  networkFee: decimal("network_fee", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'failed'
  blockNumber: bigint("block_number", { mode: "number" }),
  confirmations: integer("confirmations").default(0),
  metadata: jsonb("metadata"), // Additional transaction data
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => [
  index("idx_wallet_transactions").on(table.userWalletId),
  index("idx_transaction_hash").on(table.transactionHash),
  index("idx_transaction_status").on(table.status),
]);

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

export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  priceUsd: decimal("price_usd", { precision: 18, scale: 12 }).notNull(), // JCMOVES price in USD
  source: text("source").notNull(), // 'moonshot', 'dexscreener', 'manual'
  marketData: jsonb("market_data"), // Additional market data (volume, market cap, etc.)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_price_history_created").on(table.createdAt),
]);

// Treasury withdrawal tracking for blockchain execution
export const treasuryWithdrawals = pgTable("treasury_withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  treasuryAccountId: varchar("treasury_account_id").notNull().references(() => treasuryAccounts.id),
  reserveTransactionId: varchar("reserve_transaction_id").references(() => reserveTransactions.id), // Link to database record
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  tokenAmount: decimal("token_amount", { precision: 18, scale: 8 }).notNull(),
  recipientAddress: text("recipient_address").notNull(), // Solana wallet address to receive tokens
  treasuryWalletAddress: text("treasury_wallet_address").notNull(), // Treasury wallet executing transfer
  status: text("status").notNull().default("pending"), // 'pending', 'prepared', 'signing', 'broadcasting', 'confirmed', 'failed'
  transactionSignature: text("transaction_signature"), // Solana transaction signature after broadcast
  blockNumber: bigint("block_number", { mode: "number" }),
  confirmations: integer("confirmations").default(0),
  preparedTransaction: text("prepared_transaction"), // Base64 serialized unsigned transaction
  preparedAt: timestamp("prepared_at"),
  signedAt: timestamp("signed_at"),
  broadcastAt: timestamp("broadcast_at"),
  confirmedAt: timestamp("confirmed_at"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"), // Additional data: nonce, fee, etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_treasury_withdrawals_status").on(table.status),
  index("idx_treasury_withdrawals_signature").on(table.transactionSignature),
]);

// Shop items for marketplace
export const shopPhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  alt: z.string().optional(),
  order: z.number().int().min(0),
});

export type ShopPhoto = z.infer<typeof shopPhotoSchema>;

export const shopItems = pgTable("shop_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postedBy: varchar("posted_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  photos: jsonb("photos").notNull().default("[]"), // Array of photo objects for slideshow
  category: text("category"), // Optional category (furniture, electronics, etc.)
  status: text("status").notNull().default("active"), // 'active', 'sold', 'archived'
  views: integer("views").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_shop_items_status").on(table.status),
  index("idx_shop_items_posted_by").on(table.postedBy),
  index("idx_shop_items_created").on(table.createdAt),
  index("idx_shop_items_active_created").on(table.status, table.createdAt),
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

// Notification schemas
export const insertNotificationSchema = createInsertSchema(notifications);
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Push subscription schema
export const pushSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
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

export const insertTreasuryWithdrawalSchema = createInsertSchema(treasuryWithdrawals).omit({
  id: true,
  status: true,
  transactionSignature: true,
  blockNumber: true,
  confirmations: true,
  preparedTransaction: true,
  preparedAt: true,
  signedAt: true,
  broadcastAt: true,
  confirmedAt: true,
  failureReason: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
});

// Treasury system types
export type InsertTreasuryAccount = z.infer<typeof insertTreasuryAccountSchema>;
export type TreasuryAccount = typeof treasuryAccounts.$inferSelect;
export type InsertFundingDeposit = z.infer<typeof insertFundingDepositSchema>;
export type FundingDeposit = typeof fundingDeposits.$inferSelect;
export type InsertReserveTransaction = z.infer<typeof insertReserveTransactionSchema>;
export type ReserveTransaction = typeof reserveTransactions.$inferSelect;
export type InsertTreasuryWithdrawal = z.infer<typeof insertTreasuryWithdrawalSchema>;
export type TreasuryWithdrawal = typeof treasuryWithdrawals.$inferSelect;

// Shop system schemas
export const insertShopItemSchema = createInsertSchema(shopItems).omit({
  id: true,
  status: true,
  views: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  photos: z.array(shopPhotoSchema).min(1, "At least one photo is required"),
  price: z.string().regex(/^\d+\.?\d{0,2}$/, "Price must be a valid number with up to 2 decimal places").or(z.coerce.number().positive("Price must be greater than 0")),
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must not exceed 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must not exceed 2000 characters"),
});

export type InsertShopItem = z.infer<typeof insertShopItemSchema>;
export type ShopItem = typeof shopItems.$inferSelect;

// Faucet system tables
export const faucetConfig = pgTable("faucet_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currency: text("currency").notNull(), // 'BTC', 'ETH', 'LTC', etc.
  rewardAmount: decimal("reward_amount", { precision: 18, scale: 8 }).notNull(), // Amount in satoshis/wei
  claimInterval: integer("claim_interval").notNull().default(3600), // Time between claims in seconds (default 1 hour)
  isEnabled: boolean("is_enabled").notNull().default(true),
  dailyLimit: decimal("daily_limit", { precision: 18, scale: 8 }), // Maximum daily rewards per currency
  minimumBalance: decimal("minimum_balance", { precision: 18, scale: 8 }), // Minimum FaucetPay balance required
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  unique("unique_currency_config").on(table.currency),
]);

export const faucetClaims = pgTable("faucet_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  currency: text("currency").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 18, scale: 8 }).notNull(),
  cashValue: decimal("cash_value", { precision: 10, scale: 2 }).notNull(),
  claimTime: timestamp("claim_time").notNull().default(sql`now()`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: text("device_fingerprint"),
  faucetpayPayoutId: text("faucetpay_payout_id"), // Reference to FaucetPay transaction
  faucetpayUserHash: text("faucetpay_user_hash"), // FaucetPay user identifier
  status: text("status").notNull().default("pending"), // 'pending', 'paid', 'failed'
  failureReason: text("failure_reason"),
  riskScore: integer("risk_score").default(0),
  metadata: jsonb("metadata"), // Additional tracking data
}, (table) => [
  index("idx_faucet_claims_user_time").on(table.userId, table.claimTime),
  index("idx_faucet_claims_currency").on(table.currency),
  index("idx_faucet_claims_ip").on(table.ipAddress),
]);

export const faucetRevenue = pgTable("faucet_revenue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  currency: text("currency").notNull(),
  totalClaims: integer("total_claims").default(0),
  totalRewards: decimal("total_rewards", { precision: 18, scale: 8 }).default("0"),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"), // Estimated ad revenue
  uniqueUsers: integer("unique_users").default(0),
  adViews: integer("ad_views").default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  unique("unique_date_currency").on(table.date, table.currency),
  index("idx_faucet_revenue_date").on(table.date),
]);

export const faucetWallets = pgTable("faucet_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  currency: text("currency").notNull(),
  faucetpayAddress: text("faucetpay_address"), // User's FaucetPay address for this currency
  totalEarned: decimal("total_earned", { precision: 18, scale: 8 }).default("0"),
  totalClaims: integer("total_claims").default(0),
  lastClaimTime: timestamp("last_claim_time"),
  isVerified: boolean("is_verified").default(false), // Whether address is verified with FaucetPay
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  unique("unique_user_currency").on(table.userId, table.currency),
  index("idx_faucet_wallet_user").on(table.userId),
]);

// ====================== ADVERTISING TABLES ======================
// Real advertising system for crypto faucet monetization with Bitmedia/Cointraffic

export const adImpressions = pgTable("ad_impressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"), // Anonymous tracking for non-logged users
  placementId: text("placement_id").notNull(),
  network: text("network").notNull(), // 'bitmedia', 'cointraffic', 'aads'
  adType: text("ad_type").notNull(), // 'banner', 'video', 'popup', 'interstitial'
  adUnitId: text("ad_unit_id"), // Network-specific ad unit ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  revenue: decimal("revenue", { precision: 10, scale: 6 }).default("0"), // in USD
  cpm: decimal("cpm", { precision: 10, scale: 6 }).default("0"), // cost per mille
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_ad_impressions_user").on(table.userId),
  index("idx_ad_impressions_network").on(table.network),
  index("idx_ad_impressions_placement").on(table.placementId),
  index("idx_ad_impressions_date").on(table.createdAt),
]);

export const adClicks = pgTable("ad_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  impressionId: varchar("impression_id").notNull().references(() => adImpressions.id),
  userId: varchar("user_id").references(() => users.id),
  placementId: text("placement_id").notNull(),
  network: text("network").notNull(),
  clickUrl: text("click_url"),
  revenue: decimal("revenue", { precision: 10, scale: 6 }).default("0"), // in USD
  cpc: decimal("cpc", { precision: 10, scale: 6 }).default("0"), // cost per click
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_ad_clicks_impression").on(table.impressionId),
  index("idx_ad_clicks_user").on(table.userId),
  index("idx_ad_clicks_network").on(table.network),
]);

export const adCompletions = pgTable("ad_completions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  impressionId: varchar("impression_id").notNull().references(() => adImpressions.id),
  sessionId: text("session_id").notNull(), // For verification against bypass attempts
  network: text("network").notNull(),
  completionType: text("completion_type").notNull(), // 'view', 'click', 'conversion'
  verified: boolean("verified").default(false),
  verificationMethod: text("verification_method"), // 'callback', 'timeout', 'manual'
  revenue: decimal("revenue", { precision: 10, scale: 6 }).default("0"),
  faucetClaimId: varchar("faucet_claim_id").references(() => faucetClaims.id), // Link to faucet claim
  expiresAt: timestamp("expires_at").notNull(), // Ad completion expires (prevent reuse)
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_ad_completions_user").on(table.userId),
  index("idx_ad_completions_session").on(table.sessionId),
  index("idx_ad_completions_verified").on(table.verified),
  index("idx_ad_completions_expires").on(table.expiresAt),
]);

// Faucet system schemas
export const insertFaucetConfigSchema = createInsertSchema(faucetConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaucetClaimSchema = createInsertSchema(faucetClaims).omit({
  id: true,
  claimTime: true,
  status: true,
  riskScore: true,
}).extend({
  sessionId: z.string().optional(), // For ad completion verification
});

export const insertFaucetRevenueSchema = createInsertSchema(faucetRevenue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaucetWalletSchema = createInsertSchema(faucetWallets).omit({
  id: true,
  totalEarned: true,
  totalClaims: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

// Faucet system types
export type InsertFaucetConfig = z.infer<typeof insertFaucetConfigSchema>;
export type FaucetConfig = typeof faucetConfig.$inferSelect;
export type InsertFaucetClaim = z.infer<typeof insertFaucetClaimSchema>;
export type FaucetClaim = typeof faucetClaims.$inferSelect;
export type InsertFaucetRevenue = z.infer<typeof insertFaucetRevenueSchema>;
export type FaucetRevenue = typeof faucetRevenue.$inferSelect;
export type InsertFaucetWallet = z.infer<typeof insertFaucetWalletSchema>;
export type FaucetWallet = typeof faucetWallets.$inferSelect;

// Employee Gamification System
export const employeeStats = pgTable("employee_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  totalPoints: integer("total_points").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  jobsCompleted: integer("jobs_completed").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0), // Current streak of consecutive job completions
  longestStreak: integer("longest_streak").notNull().default(0), // Best streak ever achieved
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0.00"), // Customer satisfaction rating
  totalRatings: integer("total_ratings").notNull().default(0),
  onTimeCompletions: integer("on_time_completions").notNull().default(0),
  monthlyGoal: integer("monthly_goal").default(10), // Jobs to complete this month
  monthlyProgress: integer("monthly_progress").notNull().default(0),
  totalEarnedTokens: decimal("total_earned_tokens", { precision: 18, scale: 8 }).default("0.00000000"),
  rankTitle: text("rank_title").default("Rookie Mover"), // Dynamic rank based on performance
  lastActivityDate: timestamp("last_activity_date").default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const achievementTypes = pgTable("achievement_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(), // "Speed Demon", "Customer Champion", "Streak Master"
  description: text("description").notNull(),
  category: text("category").notNull(), // "performance", "quality", "consistency", "milestones"
  iconName: text("icon_name").notNull(), // Lucide icon name
  iconColor: text("icon_color").notNull().default("#3b82f6"), // Hex color
  pointsAwarded: integer("points_awarded").notNull().default(0),
  tokenReward: decimal("token_reward", { precision: 18, scale: 8 }).default("0.00000000"),
  requirements: jsonb("requirements").notNull(), // Conditions to earn this achievement
  isActive: boolean("is_active").notNull().default(true),
  rarity: text("rarity").notNull().default("common"), // "common", "rare", "epic", "legendary"
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const employeeAchievements = pgTable("employee_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  achievementTypeId: varchar("achievement_type_id").notNull().references(() => achievementTypes.id),
  earnedAt: timestamp("earned_at").notNull().default(sql`now()`),
  progress: jsonb("progress"), // Track progress towards achievement if applicable
  notified: boolean("notified").default(false), // Whether user has been notified
  celebrationShown: boolean("celebration_shown").default(false), // Whether celebration animation was shown
}, (table) => [
  index("idx_employee_achievements_user").on(table.userId),
  unique("unique_user_achievement").on(table.userId, table.achievementTypeId),
]);

export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  points: integer("points").notNull(), // Can be positive or negative
  transactionType: text("transaction_type").notNull(), // "job_completion", "bonus", "penalty", "achievement"
  relatedEntityType: text("related_entity_type"), // "lead", "achievement", "bonus"
  relatedEntityId: varchar("related_entity_id"), // ID of the related record
  description: text("description").notNull(),
  metadata: jsonb("metadata"), // Additional data like job details, performance metrics
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_point_transactions_user").on(table.userId, table.createdAt),
]);

export const weeklyLeaderboards = pgTable("weekly_leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weekStartDate: date("week_start_date").notNull(),
  weekEndDate: date("week_end_date").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  pointsEarned: integer("points_earned").notNull().default(0),
  jobsCompleted: integer("jobs_completed").notNull().default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  rank: integer("rank"), // Position in that week's leaderboard
  tokenReward: decimal("token_reward", { precision: 18, scale: 8 }).default("0.00000000"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("idx_weekly_leaderboard_week").on(table.weekStartDate, table.rank),
  unique("unique_user_week").on(table.userId, table.weekStartDate),
]);

export const gamificationConfig = pgTable("gamification_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // "points_per_job", "level_threshold", "streak_bonus"
  value: text("value").notNull(), // JSON stringified value
  description: text("description"),
  category: text("category").notNull().default("general"), // "points", "levels", "rewards", "achievements"
  dataType: text("data_type").notNull().default("number"), // "number", "string", "boolean", "json"
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Gamification schemas
export const insertEmployeeStatsSchema = createInsertSchema(employeeStats).omit({
  id: true,
  totalPoints: true,
  currentLevel: true,
  jobsCompleted: true,
  currentStreak: true,
  longestStreak: true,
  averageRating: true,
  totalRatings: true,
  onTimeCompletions: true,
  monthlyProgress: true,
  totalEarnedTokens: true,
  rankTitle: true,
  lastActivityDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAchievementTypeSchema = createInsertSchema(achievementTypes).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeAchievementSchema = createInsertSchema(employeeAchievements).omit({
  id: true,
  earnedAt: true,
  notified: true,
  celebrationShown: true,
});

export const insertPointTransactionSchema = createInsertSchema(pointTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyLeaderboardSchema = createInsertSchema(weeklyLeaderboards).omit({
  id: true,
  rank: true,
  tokenReward: true,
  createdAt: true,
});

export const insertGamificationConfigSchema = createInsertSchema(gamificationConfig).omit({
  id: true,
  updatedAt: true,
});

// Gamification types
export type InsertEmployeeStats = z.infer<typeof insertEmployeeStatsSchema>;
export type EmployeeStats = typeof employeeStats.$inferSelect;
export type InsertAchievementType = z.infer<typeof insertAchievementTypeSchema>;
export type AchievementType = typeof achievementTypes.$inferSelect;
export type InsertEmployeeAchievement = z.infer<typeof insertEmployeeAchievementSchema>;
export type EmployeeAchievement = typeof employeeAchievements.$inferSelect;
export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertWeeklyLeaderboard = z.infer<typeof insertWeeklyLeaderboardSchema>;
export type WeeklyLeaderboard = typeof weeklyLeaderboards.$inferSelect;
export type InsertGamificationConfig = z.infer<typeof insertGamificationConfigSchema>;
export type GamificationConfig = typeof gamificationConfig.$inferSelect;

// Multi-currency wallet schemas
export const insertSupportedCurrencySchema = createInsertSchema(supportedCurrencies).omit({
  id: true,
  createdAt: true,
});

export const insertUserWalletSchema = createInsertSchema(userWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
});

// Multi-currency wallet types
export type SupportedCurrency = typeof supportedCurrencies.$inferSelect;
export type InsertSupportedCurrency = z.infer<typeof insertSupportedCurrencySchema>;
export type UserWallet = typeof userWallets.$inferSelect;
export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

// Price history schema and types
export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  createdAt: true,
});

export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
