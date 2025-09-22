import { type User, type InsertUser, type UpsertUser, type Lead, type InsertLead, type Contact, type InsertContact, type TreasuryAccount, type InsertTreasuryAccount, type FundingDeposit, type InsertFundingDeposit, type ReserveTransaction, type InsertReserveTransaction, leads, contacts, users, walletAccounts, rewards, treasuryAccounts, fundingDeposits, reserveTransactions } from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNull, and } from "drizzle-orm";
import { TREASURY_CONFIG } from "./constants";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser, tokenPrice?: number): Promise<User>;
  
  // User role management
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  getEmployees(): Promise<User[]>;
  
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  updateLeadStatus(id: string, status: string): Promise<Lead | undefined>;
  
  // Job assignment operations
  assignLeadToEmployee(leadId: string, employeeId: string): Promise<Lead | undefined>;
  getAvailableLeads(): Promise<Lead[]>; // Leads not assigned to any employee
  getAssignedLeads(employeeId: string): Promise<Lead[]>; // Leads assigned to specific employee
  
  createContact(contact: InsertContact): Promise<Contact>;
  getContacts(): Promise<Contact[]>;
  
  // Treasury operations
  getTreasuryAccount(id?: string): Promise<TreasuryAccount | undefined>;
  getMainTreasuryAccount(): Promise<TreasuryAccount>;
  createFundingDeposit(deposit: InsertFundingDeposit): Promise<FundingDeposit>;
  getFundingDeposits(treasuryAccountId?: string): Promise<FundingDeposit[]>;
  createReserveTransaction(transaction: InsertReserveTransaction): Promise<ReserveTransaction>;
  getReserveTransactions(treasuryAccountId?: string, limit?: number): Promise<ReserveTransaction[]>;
  checkFundingAvailability(tokenAmount: number, tokenPrice?: number): Promise<{ available: boolean; currentBalance: number; requiredValue: number }>;
  deductFromReserve(tokenAmount: number, description: string, tokenPrice: number, relatedEntityType?: string, relatedEntityId?: string): Promise<ReserveTransaction>;
  addToReserve(tokenAmount: number, cashValue: number, description: string): Promise<ReserveTransaction>;
  atomicDepositFunds(depositedBy: string, usdAmount: number, depositMethod?: string, notes?: string): Promise<FundingDeposit>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser, tokenPrice?: number): Promise<User> {
    // Check if this is a new user (first time registration)
    // Look up by ID first, then by email if ID is not provided
    let existingUser = null;
    if (userData.id) {
      existingUser = await this.getUser(userData.id);
    } else if (userData.email) {
      const [userByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      existingUser = userByEmail || null;
    }
    
    const isNewUser = !existingUser;

    // Update conflict target based on available data
    const conflictTarget = userData.id ? users.id : users.email;
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: conflictTarget,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    // If this is a new user, attempt to give them signup bonus from treasury
    if (isNewUser) {
      try {
        // Check if treasury has sufficient funding for signup bonus using real-time pricing
        const signupTokens = TREASURY_CONFIG.SIGNUP_BONUS_TOKENS;
        const currentPrice = tokenPrice ?? TREASURY_CONFIG.FALLBACK_TOKEN_PRICE;
        const fundingCheck = await this.checkFundingAvailability(signupTokens, currentPrice);
        
        if (fundingCheck.available) {
          // Atomic signup bonus: treasury deduction + wallet creation + reward record in single transaction
          await db.transaction(async (tx) => {
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

            const currentBalance = parseFloat(treasury.availableFunding);
            const currentTokenReserve = parseFloat(treasury.tokenReserve);
            const cashValue = signupTokens * currentPrice; // Use real-time JCMOVES price
            const minimumBalance = TREASURY_CONFIG.MINIMUM_BALANCE;

            // Verify funding availability within transaction
            if (currentBalance < cashValue || currentTokenReserve < signupTokens) {
              throw new Error(`Insufficient funding for signup bonus: ${signupTokens} tokens ($${cashValue.toFixed(2)})`);
            }

            const newBalance = currentBalance - cashValue;
            if (newBalance < minimumBalance) {
              throw new Error(`Signup bonus would leave balance below minimum threshold ($${minimumBalance})`);
            }

            const newTokenReserve = currentTokenReserve - signupTokens;

            // Update treasury account
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
            const [treasuryTransaction] = await tx
              .insert(reserveTransactions)
              .values({
                treasuryAccountId: treasury.id,
                transactionType: 'distribution',
                relatedEntityType: 'signup_bonus',
                relatedEntityId: user.id,
                tokenAmount: signupTokens.toFixed(8),
                cashValue: cashValue.toFixed(2),
                balanceAfter: newBalance.toFixed(2),
                tokenReserveAfter: newTokenReserve.toFixed(8),
                description: `Signup bonus for new user: ${user.email || user.id}`
              })
              .returning();

            // Create wallet account for new user
            await tx.insert(walletAccounts).values({
              userId: user.id,
              tokenBalance: signupTokens.toFixed(1),
              totalEarned: signupTokens.toFixed(1)
            }).onConflictDoNothing();

            // Create signup bonus reward record
            await tx.insert(rewards).values({
              userId: user.id,
              rewardType: 'signup_bonus', 
              tokenAmount: signupTokens.toFixed(1),
              cashValue: cashValue.toFixed(2),
              status: 'earned',
              metadata: { 
                signupBonus: true, 
                automaticReward: true, 
                treasuryFunded: true,
                treasuryTransactionId: treasuryTransaction.id
              }
            }).onConflictDoNothing();
          });

          console.log(`New user registered: ${user.email || user.id} - Awarded ${signupTokens} JCMOVE signup bonus (treasury funded)`);
        } else {
          // Treasury insufficient - create wallet but no bonus tokens
          await db.insert(walletAccounts).values({
            userId: user.id,
            tokenBalance: '0.0',
            totalEarned: '0.0'
          }).onConflictDoNothing();

          console.warn(`New user registered: ${user.email || user.id} - Signup bonus SKIPPED due to insufficient treasury funding (${fundingCheck.currentBalance.toFixed(2)} < ${fundingCheck.requiredValue.toFixed(2)})`);
        }
      } catch (error) {
        console.error(`Failed to process signup bonus for user ${user.id}:`, error);
        
        // Create basic wallet even if bonus fails
        try {
          await db.insert(walletAccounts).values({
            userId: user.id,
            tokenBalance: '0.0',
            totalEarned: '0.0'
          }).onConflictDoNothing();
        } catch (walletError) {
          console.error(`Failed to create wallet for user ${user.id}:`, walletError);
        }
      }
    }

    return user;
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
      query = query.where(eq(reserveTransactions.treasuryAccountId, treasuryAccountId));
    }

    query = query.orderBy(desc(reserveTransactions.createdAt));

    if (limit) {
      query = query.limit(limit);
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
}

export const storage = new DatabaseStorage();
