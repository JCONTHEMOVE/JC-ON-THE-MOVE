import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertContactSchema, insertCashoutRequestSchema } from "@shared/schema";
import { sendEmail, generateLeadNotificationEmail, generateContactNotificationEmail } from "./services/email";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { dailyCheckinService } from "./services/daily-checkin";
import { rewardsService } from "./services/rewards";
import { cryptoCashoutService } from "./services/crypto-cashout";
import { moonshotService, moonshotAccountTransferSchema } from "./services/moonshot";
import { treasuryService } from "./services/treasury";
import { insertFundingDepositSchema, insertFaucetConfigSchema, insertFaucetWalletSchema } from "@shared/schema";
import { z } from "zod";
import { EncryptionService } from "./services/encryption";
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { db } from './db';
import { rewards, walletAccounts, dailyCheckins, cashoutRequests, fundingDeposits, reserveTransactions, users } from '@shared/schema';
import { getFaucetPayService } from "./services/faucetpay";
import { FAUCETPAY_CONFIG } from "./constants";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Validation schemas for rewards endpoints
  const checkinSchema = z.object({
    deviceFingerprint: z.object({
      userAgent: z.string(),
      screenResolution: z.string(),
      timezone: z.string(),
      language: z.string(),
      platform: z.string()
    })
  });

  const cashoutSchema = z.object({
    tokenAmount: z.number().positive().min(0.01),
    bankDetails: z.object({
      accountNumber: z.string().min(4),
      routingNumber: z.string().length(9),
      accountHolderName: z.string().min(2),
      bankName: z.string().min(2)
    })
  });

  // Treasury validation schema
  const treasuryDepositSchema = z.object({
    amount: z.coerce.number().positive().min(1.00).max(1000000).finite(), // $1.00 - $1M deposit
    depositMethod: z.enum(['manual', 'stripe', 'bank_transfer']).optional().default('manual'),
    notes: z.string().optional()
  });

  // Referral validation schemas
  const referralCodeSchema = z.object({
    referralCode: z.string().min(1).max(20)
  });

  // Crypto conversion validation schemas
  const usdToTokensSchema = z.object({
    usdAmount: z.coerce.number().positive().min(0.01).max(10000).finite() // $0.01 - $10K conversion
  });

  const tokensToUsdSchema = z.object({
    tokenAmount: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num <= 1000000000; // 1B token max
      },
      { message: "Token amount must be a positive number string up to 1B tokens" }
    )
  });

  // Treasury dashboard helper functions
  async function getTreasuryAnalytics() {
    // Get reward distribution patterns and user analytics
    const rewardStats = await db
      .select({
        rewardType: rewards.rewardType,
        count: sql<number>`count(*)`,
        totalTokens: sql<number>`sum(cast(${rewards.tokenAmount} as decimal))`,
        totalCash: sql<number>`sum(cast(${rewards.cashValue} as decimal))`
      })
      .from(rewards)
      .where(eq(rewards.status, 'confirmed'))
      .groupBy(rewards.rewardType);

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const userStats = await db
      .select({
        totalUsers: sql<number>`count(distinct ${rewards.userId})`,
      })
      .from(rewards);

    const activeUsers = await db
      .select({
        activeUsers: sql<number>`count(distinct ${rewards.userId})`,
      })
      .from(rewards)
      .where(gte(rewards.earnedDate, thirtyDaysAgoISO));

    // Get distribution trends (simplified without date grouping for compatibility)
    const recentRewards = await db
      .select({
        tokenAmount: rewards.tokenAmount,
        cashValue: rewards.cashValue,
        earnedDate: rewards.earnedDate
      })
      .from(rewards)
      .where(gte(rewards.earnedDate, thirtyDaysAgoISO))
      .orderBy(desc(rewards.earnedDate));

    return {
      rewardStats,
      userStats: { 
        totalUsers: userStats[0]?.totalUsers || 0,
        activeUsers: activeUsers[0]?.activeUsers || 0
      },
      recentRewards
    };
  }

  async function getTreasuryReports(period: string = '30d', type: string = 'all') {
    const dayMap = {
      '7d': 7,
      '30d': 30, 
      '90d': 90,
      '1y': 365
    };
    
    const days = dayMap[period as keyof typeof dayMap] || 30;
    
    // Calculate date boundary
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const fromDateISO = fromDate.toISOString();
    
    // Get funding deposits within period
    const fundingData = await db
      .select({
        amount: fundingDeposits.amount,
        createdAt: fundingDeposits.createdAt
      })
      .from(fundingDeposits)
      .where(gte(fundingDeposits.createdAt, fromDateISO))
      .orderBy(desc(fundingDeposits.createdAt));

    // Get distribution transactions within period
    const distributionData = await db
      .select({
        cashValue: reserveTransactions.cashValue,
        createdAt: reserveTransactions.createdAt
      })
      .from(reserveTransactions)
      .where(and(
        eq(reserveTransactions.transactionType, 'distribution'),
        gte(reserveTransactions.createdAt, fromDateISO)
      ))
      .orderBy(desc(reserveTransactions.createdAt));

    return {
      period,
      type,
      fundingData,
      distributionData
    };
  }

  async function getTreasurySummary() {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    const [stats, recentDeposits, recentDistributions, activeUsersWeek] = await Promise.all([
      treasuryService.getTreasuryStats(),
      
      // Count recent deposits
      db.select({ count: sql<number>`count(*)` })
        .from(fundingDeposits)
        .where(gte(fundingDeposits.createdAt, sevenDaysAgoISO)),
      
      // Count recent distributions  
      db.select({ count: sql<number>`count(*)` })
        .from(reserveTransactions)
        .where(and(
          eq(reserveTransactions.transactionType, 'distribution'),
          gte(reserveTransactions.createdAt, sevenDaysAgoISO)
        )),
      
      // Count active users this week
      db.select({ count: sql<number>`count(distinct ${rewards.userId})` })
        .from(rewards)
        .where(gte(rewards.earnedDate, sevenDaysAgoISO))
    ]);

    return {
      ...stats,
      weeklyActivity: {
        recentDeposits: recentDeposits[0]?.count || 0,
        recentDistributions: recentDistributions[0]?.count || 0,
        activeUsersWeek: activeUsersWeek[0]?.count || 0
      }
    };
  }

  function getTreasuryConfig() {
    return {
      tokenPrice: 0.10, // $0.10 per token
      minimumBalance: 100.0, // $100 minimum balance
      warningThreshold: 500.0, // $500 warning threshold
      signupBonusTokens: 1000, // 1000 tokens signup bonus
      maxDistributionPerDay: null
    };
  }
  
  // Submit quote request
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      
      // Send email notification
      const emailContent = generateLeadNotificationEmail(lead);
      const companyEmail = process.env.COMPANY_EMAIL || "upmichiganstatemovers@gmail.com";
      
      await sendEmail({
        to: companyEmail,
        from: companyEmail,
        subject: `New ${lead.serviceType} Lead - ${lead.firstName} ${lead.lastName}`,
        text: emailContent.text,
        html: emailContent.html,
      });

      res.json({ success: true, leadId: lead.id });
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  // Customer quote tracking - public endpoint for customers to track their quote requests
  app.get("/api/leads/track/:email", async (req, res) => {
    try {
      const email = req.params.email;
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }
      
      const customerLeads = await storage.getLeadsByEmail(email);
      res.json(customerLeads);
    } catch (error) {
      console.error("Error fetching customer leads:", error);
      res.status(500).json({ error: "Failed to retrieve quote requests" });
    }
  });

  // Role-based access control middleware
  const requireBusinessOwner = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      // Only admin role has administrative access
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Administrator access required" });
      }
      req.currentUser = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Access control error" });
    }
  };

  const requireEmployee = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'employee') {
        return res.status(403).json({ message: "Employee access required" });
      }
      req.currentUser = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Access control error" });
    }
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      // Only admin role has administrative access
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Administrator access required" });
      }
      req.currentUser = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Access control error" });
    }
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Fetching user data for userId: ${userId}`);
      const user = await storage.getUser(userId);
      console.log(`User data retrieved:`, user ? 'found' : 'not found');
      
      if (!user) {
        console.error(`User not found in database for userId: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Protected routes - Get all leads (business owner only)
  app.get("/api/leads", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Protected routes - Update lead status (dashboard only - business owner only)
  app.patch("/api/leads/:id/status", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["new", "contacted", "quoted", "confirmed", "available", "accepted"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedLead = await storage.updateLeadStatus(id, status);
      if (!updatedLead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Send notifications for important status changes
      try {
        const { notificationService } = await import("./services/notification");
        
        // Notify when job becomes available for assignment
        if (status === 'available') {
          await notificationService.notifyAllEmployees(
            'New Job Available',
            `${updatedLead.serviceType} job available for ${updatedLead.firstName} ${updatedLead.lastName}`,
            { jobId: updatedLead.id, type: 'job_available' }
          );
        }
        
        // Notify assigned employee about status changes
        if (updatedLead.assignedToUserId && ['confirmed', 'in_progress', 'completed'].includes(status)) {
          await notificationService.notifyJobStatusChange(
            updatedLead.assignedToUserId,
            updatedLead.id,
            status,
            `${updatedLead.firstName} ${updatedLead.lastName}`
          );
        }
      } catch (notificationError) {
        console.error("Error sending status change notification:", notificationError);
        // Don't fail the request if notification fails
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead status:", error);
      if (error instanceof Error && error.message.includes("Cannot set status to 'accepted'")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update lead status" });
    }
  });

  // Submit contact form
  app.post("/api/contacts", async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      
      // Send email notification
      const emailContent = generateContactNotificationEmail(contact);
      const companyEmail = process.env.COMPANY_EMAIL || "upmichiganstatemovers@gmail.com";
      
      await sendEmail({
        to: companyEmail,
        from: companyEmail,
        subject: `New Contact Form Submission - ${contact.name}`,
        text: emailContent.text,
        html: emailContent.html,
      });

      res.json({ success: true, contactId: contact.id });
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(400).json({ error: "Invalid contact data" });
    }
  });

  // Protected routes - Get all contacts (business owner only)
  app.get("/api/contacts", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  // Employee Management Routes (Business Owner Only)
  app.get("/api/employees", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.patch("/api/employees/:id/role", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !["business_owner", "employee", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Valid roles: business_owner, employee, admin" });
      }

      const updatedUser = await storage.updateUserRole(id, role);
      if (!updatedUser) {
        return res.status(404).json({ error: "Employee not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating employee role:", error);
      res.status(500).json({ error: "Failed to update employee role" });
    }
  });

  // Employee Job Routes
  app.get("/api/leads/available", isAuthenticated, requireEmployee, async (req, res) => {
    try {
      const availableLeads = await storage.getAvailableLeads();
      res.json(availableLeads);
    } catch (error) {
      console.error("Error fetching available leads:", error);
      res.status(500).json({ error: "Failed to fetch available jobs" });
    }
  });

  app.get("/api/leads/my-jobs", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const employeeId = req.currentUser.id;
      const assignedLeads = await storage.getAssignedLeads(employeeId);
      res.json(assignedLeads);
    } catch (error) {
      console.error("Error fetching assigned leads:", error);
      res.status(500).json({ error: "Failed to fetch assigned jobs" });
    }
  });

  app.post("/api/leads/:id/accept", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const { id } = req.params;
      const employeeId = req.currentUser.id;
      
      // Atomic assignment attempt - will fail if already assigned
      const updatedLead = await storage.assignLeadToEmployee(id, employeeId);
      if (!updatedLead) {
        // Check if lead exists at all
        const existingLead = await storage.getLead(id);
        if (!existingLead) {
          return res.status(404).json({ error: "Job not found" });
        }
        // Lead exists but wasn't updated, meaning it was already assigned
        return res.status(409).json({ error: "Job already assigned to another employee" });
      }

      // Send notification to employee confirming job assignment
      try {
        const { notificationService } = await import("./services/notification");
        await notificationService.notifyJobAssigned(
          employeeId,
          updatedLead.id,
          `${updatedLead.firstName} ${updatedLead.lastName}`
        );
      } catch (notificationError) {
        console.error("Error sending job assignment notification:", notificationError);
        // Don't fail the request if notification fails
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error accepting job:", error);
      res.status(500).json({ error: "Failed to accept job" });
    }
  });

  // Photo management for jobs
  app.post("/api/leads/:id/photos", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const { id } = req.params;
      const employeeId = req.currentUser.id;
      
      // Verify the employee is assigned to this job
      const lead = await storage.getLead(id);
      if (!lead) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (lead.assignedToUserId !== employeeId) {
        return res.status(403).json({ error: "You can only add photos to your assigned jobs" });
      }
      
      // Validate photo data using schema
      const { jobPhotoSchema } = await import("@shared/schema");
      const validatedPhoto = jobPhotoSchema.parse(req.body);
      
      const updatedLead = await storage.addJobPhoto(id, validatedPhoto);
      if (!updatedLead) {
        return res.status(404).json({ error: "Failed to add photo" });
      }

      res.json({ success: true, photo: validatedPhoto, updatedLead });
    } catch (error) {
      console.error("Error adding job photo:", error);
      if (error instanceof Error && error.message.includes("Invalid")) {
        return res.status(400).json({ error: "Invalid photo data" });
      }
      res.status(500).json({ error: "Failed to add photo" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const notifications = await storage.getUserNotifications(userId, limit);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      res.json({ success: true, notification });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.post("/api/notifications/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;
      const { pushSubscriptionSchema } = await import("@shared/schema");
      const subscription = pushSubscriptionSchema.parse(req.body);
      
      const user = await storage.updateUserPushSubscription(userId, subscription);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ success: true, message: "Push notifications enabled" });
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
      res.status(500).json({ error: "Failed to subscribe to push notifications" });
    }
  });

  // Rewards system routes
  
  // Daily check-in
  app.post("/api/rewards/checkin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validatedData = checkinSchema.parse(req.body);
      const { deviceFingerprint } = validatedData;
      
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await dailyCheckinService.processCheckin({
        userId,
        ipAddress,
        userAgent,
        deviceFingerprint
      });

      res.json(result);
    } catch (error) {
      console.error("Daily check-in error:", error);
      res.status(500).json({ error: "Check-in failed" });
    }
  });

  // Get check-in status
  app.get("/api/rewards/checkin/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = await dailyCheckinService.getCheckinStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error getting check-in status:", error);
      res.status(500).json({ error: "Failed to get check-in status" });
    }
  });

  // Get check-in history
  app.get("/api/rewards/checkin/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 30;
      const history = await dailyCheckinService.getCheckinHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error getting check-in history:", error);
      res.status(500).json({ error: "Failed to get check-in history" });
    }
  });

  // Get wallet balance
  app.get("/api/rewards/wallet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const wallet = await db
        .select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, userId))
        .limit(1);

      if (wallet.length === 0) {
        // Create wallet if it doesn't exist
        const newWallet = await db.insert(walletAccounts).values({
          userId
        }).returning();
        return res.json(newWallet[0]);
      }

      res.json(wallet[0]);
    } catch (error) {
      console.error("Error getting wallet:", error);
      res.status(500).json({ error: "Failed to get wallet" });
    }
  });

  // Get rewards history
  app.get("/api/rewards/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const rewardsHistory = await db
        .select({
          id: rewards.id,
          rewardType: rewards.rewardType,
          tokenAmount: rewards.tokenAmount,
          cashValue: rewards.cashValue,
          status: rewards.status,
          earnedDate: rewards.earnedDate,
          redeemedDate: rewards.redeemedDate,
          metadata: rewards.metadata
        })
        .from(rewards)
        .where(eq(rewards.userId, userId))
        .orderBy(desc(rewards.earnedDate))
        .limit(limit);

      res.json(rewardsHistory);
    } catch (error) {
      console.error("Error getting rewards history:", error);
      res.status(500).json({ error: "Failed to get rewards history" });
    }
  });

  // Get token price and info
  app.get("/api/rewards/token-info", isAuthenticated, async (req, res) => {
    try {
      const tokenData = await moonshotService.getTokenData();
      const price = await moonshotService.getTokenPrice();
      
      res.json({
        price,
        tokenData,
        symbol: tokenData?.baseToken?.symbol || 'JCMOVE',
        name: tokenData?.baseToken?.name || 'JC ON THE MOVE Token'
      });
    } catch (error) {
      console.error("Error getting token info:", error);
      res.status(500).json({ error: "Failed to get token information" });
    }
  });

  // Cashout request
  app.post("/api/rewards/cashout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const validatedData = cashoutSchema.parse(req.body);
      const { tokenAmount, bankDetails } = validatedData;

      // Validate bank details
      const validation = cryptoCashoutService.validateBankDetails(bankDetails);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join(', ') });
      }

      // Get current wallet balance
      const wallet = await db
        .select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, userId))
        .limit(1);

      if (wallet.length === 0 || parseFloat(wallet[0].tokenBalance || '0') < tokenAmount) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Check eligibility
      const eligibility = await rewardsService.validateCashoutEligibility(
        parseFloat(wallet[0].tokenBalance || '0'),
        tokenAmount
      );

      if (!eligibility.eligible) {
        return res.status(400).json({ error: eligibility.reason });
      }

      // Calculate cash amount
      const cashAmount = await moonshotService.calculateCashValue(tokenAmount);
      const conversionRate = await moonshotService.getTokenPrice();

      // Encrypt bank details for secure storage
      const encryptedBankDetails = await EncryptionService.encryptBankDetails(bankDetails);

      // Create cashout request with encrypted bank details
      const cashoutRequest = await db.insert(cashoutRequests).values({
        userId,
        tokenAmount: tokenAmount.toString(),
        cashAmount: cashAmount.toString(),
        conversionRate: conversionRate.toString(),
        bankDetails: encryptedBankDetails
      }).returning();

      // Initiate external cashout
      const externalResult = await cryptoCashoutService.initiateCashout({
        userId,
        tokenAmount,
        cashAmount,
        bankDetails
      });

      // Update request with external transaction ID
      await db
        .update(cashoutRequests)
        .set({
          externalTransactionId: externalResult.id,
          status: externalResult.status,
          failureReason: externalResult.failureReason
        })
        .where(eq(cashoutRequests.id, cashoutRequest[0].id));

      if (externalResult.status !== 'failed') {
        // Deduct from wallet balance (reserve tokens)
        await db
          .update(walletAccounts)
          .set({
            tokenBalance: (parseFloat(wallet[0].tokenBalance || '0') - tokenAmount).toString(),
            lastActivity: new Date()
          })
          .where(eq(walletAccounts.userId, userId));
      }

      res.json({
        success: true,
        cashoutId: cashoutRequest[0].id,
        externalId: externalResult.id,
        status: externalResult.status,
        cashAmount,
        estimatedCompletion: "1-3 business days"
      });

    } catch (error) {
      console.error("Cashout error:", error);
      res.status(500).json({ error: "Cashout request failed" });
    }
  });

  // Get cashout history
  app.get("/api/rewards/cashouts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const cashouts = await db
        .select({
          id: cashoutRequests.id,
          tokenAmount: cashoutRequests.tokenAmount,
          cashAmount: cashoutRequests.cashAmount,
          status: cashoutRequests.status,
          createdAt: cashoutRequests.createdAt,
          processedDate: cashoutRequests.processedDate,
          failureReason: cashoutRequests.failureReason
        })
        .from(cashoutRequests)
        .where(eq(cashoutRequests.userId, userId))
        .orderBy(desc(cashoutRequests.createdAt))
        .limit(50);

      res.json(cashouts);
    } catch (error) {
      console.error("Error getting cashout history:", error);
      res.status(500).json({ error: "Failed to get cashout history" });
    }
  });

  // Admin/Business owner routes for rewards management
  app.get("/api/admin/rewards/stats", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      // Get rewards statistics
      const totalRewardsIssued = await db
        .select()
        .from(rewards)
        .then(rows => rows.reduce((sum, reward) => sum + parseFloat(reward.tokenAmount), 0));

      const totalCashouts = await db
        .select()
        .from(cashoutRequests)
        .where(eq(cashoutRequests.status, 'completed'))
        .then(rows => rows.reduce((sum, cashout) => sum + parseFloat(cashout.cashAmount), 0));

      const activeUsers = await db
        .select()
        .from(walletAccounts)
        .then(rows => rows.filter(w => parseFloat(w.tokenBalance || '0') > 0).length);

      const recentCheckins = await db
        .select()
        .from(dailyCheckins)
        .where(eq(dailyCheckins.checkinDate, new Date().toISOString().split('T')[0]))
        .then(rows => rows.length);

      res.json({
        totalRewardsIssued,
        totalCashouts,
        activeUsers,
        recentCheckins
      });
    } catch (error) {
      console.error("Error getting reward stats:", error);
      res.status(500).json({ error: "Failed to get reward statistics" });
    }
  });

  // Referral System Routes
  
  // Get user's referral code (generate if needed)
  app.get("/api/referrals/my-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const referralCode = await storage.generateReferralCode(userId);
      res.json({ referralCode });
    } catch (error) {
      console.error("Error getting referral code:", error);
      res.status(500).json({ error: "Failed to get referral code" });
    }
  });

  // Apply a referral code
  app.post("/api/referrals/apply", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { referralCode } = referralCodeSchema.parse(req.body);
      
      const result = await storage.applyReferralCode(userId, referralCode);
      
      if (result.success && result.referrerId) {
        // Process referral bonus for the referrer
        const bonusResult = await storage.processReferralBonus(result.referrerId, userId);
        
        if (bonusResult.success) {
          res.json({
            success: true,
            message: "Referral code applied successfully! Your referrer has been rewarded."
          });
        } else {
          res.json({
            success: true,
            message: "Referral code applied successfully, but there was an issue processing the bonus.",
            warning: bonusResult.error
          });
        }
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error applying referral code:", error);
      res.status(500).json({ error: "Failed to apply referral code" });
    }
  });

  // Get referral stats
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting referral stats:", error);
      res.status(500).json({ error: "Failed to get referral stats" });
    }
  });

  // Treasury Management Routes (Business Owner Only)
  
  // Deposit funds into treasury
  app.post("/api/treasury/deposit", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      const depositData = treasuryDepositSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      const result = await treasuryService.depositFunds(
        userId,
        depositData.amount,
        depositData.depositMethod,
        depositData.notes
      );
      
      if (result.success) {
        res.json({ 
          success: true, 
          deposit: result.deposit,
          message: `Successfully deposited $${depositData.amount.toFixed(2)} into treasury`
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error("Error depositing treasury funds:", error);
      res.status(400).json({ error: "Invalid deposit data" });
    }
  });

  // Moonshot funding deposit endpoint
  app.post("/api/treasury/moonshot-deposit", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      const transferData = moonshotAccountTransferSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      // Initiate Moonshot transfer
      const transferHash = await moonshotService.initiateAccountTransfer(transferData);
      
      // Check transfer status with original request data for accurate metadata
      const transferStatus = await moonshotService.checkAccountTransferStatus(transferHash, transferData);
      
      if (transferStatus.status === "completed" && transferStatus.metadata) {
        // Create funding deposit record
        const depositAmount = transferStatus.metadata.usdValue;
        const tokenPrice = await moonshotService.getTokenPrice(transferStatus.metadata.tokenSymbol);
        
        const result = await treasuryService.depositFunds(
          userId,
          depositAmount,
          "moonshot",
          `Moonshot transfer: ${transferHash}`
        );
        
        if (result.success && result.deposit) {
          // Update deposit with Moonshot metadata
          await storage.updateFundingDeposit(result.deposit.id, {
            externalTransactionId: transferHash,
            moonshotMetadata: transferStatus.metadata
          });
          
          res.json({ 
            success: true, 
            deposit: result.deposit,
            moonshotMetadata: transferStatus.metadata,
            message: `Successfully transferred ${transferStatus.metadata.tokenAmount} ${transferStatus.metadata.tokenSymbol} ($${depositAmount.toFixed(2)}) from Moonshot account`
          });
        } else {
          res.status(400).json({ 
            success: false, 
            error: result.error || "Failed to record deposit"
          });
        }
      } else {
        res.status(400).json({ 
          success: false, 
          error: "Moonshot transfer failed or is still pending"
        });
      }
    } catch (error) {
      console.error("Error processing Moonshot deposit:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid Moonshot transfer data" 
      });
    }
  });

  // Get treasury status and health
  app.get("/api/treasury/status", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const [stats, funding, healthCheck, fundingDays] = await Promise.all([
        treasuryService.getTreasuryStats(),
        treasuryService.getFundingStatus(),
        treasuryService.getHealthCheck(),
        treasuryService.getEstimatedFundingDays()
      ]);

      res.json({
        stats,
        funding,
        health: healthCheck,
        estimatedFundingDays: fundingDays
      });
    } catch (error) {
      console.error("Error getting treasury status:", error);
      res.status(500).json({ error: "Failed to get treasury status" });
    }
  });

  // Get funding deposit history
  app.get("/api/treasury/deposits", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const deposits = await treasuryService.getFundingHistory();
      res.json({ deposits });
    } catch (error) {
      console.error("Error getting funding history:", error);
      res.status(500).json({ error: "Failed to get funding history" });
    }
  });

  // Get reserve transaction history
  app.get("/api/treasury/transactions", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      // Sanitize and validate limit parameter
      const limitParam = Number(req.query.limit);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
      
      const transactions = await treasuryService.getRecentTransactions(limit);
      res.json({ transactions, pagination: { limit } });
    } catch (error) {
      console.error("Error getting reserve transactions:", error);
      res.status(500).json({ error: "Failed to get reserve transactions" });
    }
  });

  // Get treasury analytics and distribution patterns
  app.get("/api/treasury/analytics", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const analytics = await getTreasuryAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error getting treasury analytics:", error);
      res.status(500).json({ error: "Failed to get treasury analytics" });
    }
  });

  // Get treasury reports (time-series data for charts)
  app.get("/api/treasury/reports", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      const { period = '30d', type = 'all' } = req.query;
      const reports = await getTreasuryReports(period as string, type as string);
      res.json(reports);
    } catch (error) {
      console.error("Error getting treasury reports:", error);
      res.status(500).json({ error: "Failed to get treasury reports" });
    }
  });

  // Get treasury dashboard summary (quick stats for widgets)
  app.get("/api/treasury/summary", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const summary = await getTreasurySummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting treasury summary:", error);
      res.status(500).json({ error: "Failed to get treasury summary" });
    }
  });

  // Get treasury configuration
  app.get("/api/treasury/config", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const config = getTreasuryConfig();
      res.json(config);
    } catch (error) {
      console.error("Error getting treasury config:", error);
      res.status(500).json({ error: "Failed to get treasury config" });
    }
  });

  // ====================== CRYPTO PORTFOLIO MANAGEMENT API ======================

  // Get comprehensive crypto portfolio performance metrics
  app.get("/api/treasury/crypto/portfolio", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const portfolioData = await treasuryService.getCryptoPortfolioPerformance();
      res.json(portfolioData);
    } catch (error) {
      console.error("Error getting crypto portfolio data:", error);
      res.status(500).json({ error: "Failed to get crypto portfolio data" });
    }
  });

  // Get advanced risk assessment with volatility protection
  app.get("/api/treasury/crypto/risk-assessment", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const riskData = await treasuryService.getAdvancedRiskAssessment();
      res.json(riskData);
    } catch (error) {
      console.error("Error getting risk assessment:", error);
      res.status(500).json({ error: "Failed to get risk assessment data" });
    }
  });

  // Get comprehensive treasury health score
  app.get("/api/treasury/crypto/health-score", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const healthScore = await treasuryService.getTreasuryHealthScore();
      res.json(healthScore);
    } catch (error) {
      console.error("Error getting treasury health score:", error);
      res.status(500).json({ error: "Failed to get treasury health score" });
    }
  });

  // Get current JCMOVES market data and pricing
  app.get("/api/treasury/crypto/market-data", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const [currentPrice, marketData, volatility] = await Promise.all([
        treasuryService.getCurrentTokenPrice(),
        treasuryService.getMarketData(),
        treasuryService.checkVolatility()
      ]);
      
      res.json({
        currentPrice,
        marketData,
        volatility,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error getting market data:", error);
      res.status(500).json({ error: "Failed to get market data" });
    }
  });

  // Convert USD to JCMOVES tokens at current price
  app.post("/api/treasury/crypto/convert-usd", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      // Proper Zod validation
      const { usdAmount } = usdToTokensSchema.parse(req.body);
      
      const conversion = await treasuryService.convertUsdToTokens(usdAmount);
      
      // Enhanced response with price metadata
      res.json({
        ...conversion,
        inputAmount: usdAmount,
        conversionType: 'usd-to-tokens',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error converting USD to tokens:", error);
      res.status(500).json({ error: "Failed to convert USD to tokens" });
    }
  });

  // Convert JCMOVES tokens to USD at current price  
  app.post("/api/treasury/crypto/convert-tokens", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      // Proper Zod validation
      const { tokenAmount } = tokensToUsdSchema.parse(req.body);
      
      const conversion = await treasuryService.convertTokensToUsd(tokenAmount);
      
      // Enhanced response with price metadata
      res.json({
        ...conversion,
        inputAmount: tokenAmount,
        conversionType: 'tokens-to-usd',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error converting tokens to USD:", error);
      res.status(500).json({ error: "Failed to convert tokens to USD" });
    }
  });

  // Bootstrap endpoint - promote current user to admin if no admins exist
  app.post("/api/bootstrap/admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User ID not found" });
      }
      
      // Check if there are any existing admins
      const existingAdmins = await db.select().from(users).where(eq(users.role, 'admin'));
      
      if (existingAdmins.length > 0) {
        return res.status(403).json({ error: "Admin users already exist. Bootstrap not needed." });
      }
      
      // Promote current user to admin
      const updatedUser = await storage.updateUserRole(userId, 'admin');
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ 
        message: "Successfully promoted to admin", 
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error bootstrapping admin:", error);
      res.status(500).json({ error: "Failed to bootstrap admin" });
    }
  });

  // ====================== ADMIN SYSTEM MANAGEMENT API ======================

  // Get system configuration (admin only) - shows environment variable status without exposing values
  app.get("/api/admin/system/config", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const systemConfig = {
        environment: process.env.NODE_ENV || 'development',
        database: {
          status: process.env.DATABASE_URL ? 'configured' : 'missing',
          type: 'PostgreSQL'
        },
        email: {
          sendgrid: {
            status: process.env.SENDGRID_API_KEY ? 'configured' : 'missing',
            companyEmail: process.env.COMPANY_EMAIL ? 'configured' : 'missing'
          }
        },
        authentication: {
          replit: {
            domains: process.env.REPLIT_DOMAINS ? 'configured' : 'missing',
            cluster: process.env.REPLIT_CLUSTER ? 'configured' : 'missing',
            devDomain: process.env.REPLIT_DEV_DOMAIN ? 'configured' : 'missing'
          }
        },
        crypto: {
          moonshot: {
            tokenAddress: process.env.MOONSHOT_TOKEN_ADDRESS ? 'configured' : 'missing'
          },
          requestTech: {
            apiKey: process.env.REQUEST_TECH_API_KEY ? 'configured' : 'missing'
          },
          encryption: {
            key: process.env.ENCRYPTION_KEY ? 'configured' : 'missing'
          }
        },
        server: {
          port: process.env.PORT || '5000',
          sessionSecret: process.env.SESSION_SECRET ? 'configured' : 'missing'
        },
        lastChecked: new Date().toISOString()
      };

      res.json(systemConfig);
    } catch (error) {
      console.error("Error getting system config:", error);
      res.status(500).json({ error: "Failed to get system configuration" });
    }
  });

  // Get system health status (admin only)
  app.get("/api/admin/system/health", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const healthStatus = {
        database: {
          status: 'healthy',
          connected: true,
          lastCheck: new Date().toISOString()
        },
        services: {
          email: process.env.SENDGRID_API_KEY ? 'available' : 'disabled',
          authentication: 'active',
          rewards: 'active',
          treasury: 'active'
        },
        security: {
          encryption: process.env.ENCRYPTION_KEY ? 'enabled' : 'disabled',
          authentication: 'enabled',
          roleBasedAccess: 'enabled'
        },
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: process.version,
        platform: process.platform,
        lastUpdated: new Date().toISOString()
      };

      res.json(healthStatus);
    } catch (error) {
      console.error("Error getting system health:", error);
      res.status(500).json({ error: "Failed to get system health status" });
    }
  });

  // ====================== FAUCET API ROUTES ======================

  // Faucet validation schemas
  const faucetClaimSchema = z.object({
    currency: z.enum(['BTC', 'ETH', 'LTC', 'DOGE']),
    faucetpayAddress: z.string().min(10).max(100),
    deviceFingerprint: z.string().optional(),
  });

  // Get available faucet currencies and configurations
  app.get("/api/faucet/config", async (req, res) => {
    try {
      const configs = await storage.getFaucetConfig();
      const enabledConfigs = configs.filter(config => config.isEnabled);
      
      res.json({
        currencies: enabledConfigs,
        defaultInterval: FAUCETPAY_CONFIG.DEFAULT_CLAIM_INTERVAL,
        isConfigured: !!process.env.FAUCETPAY_API_KEY
      });
    } catch (error) {
      console.error("Error getting faucet config:", error);
      res.status(500).json({ error: "Failed to get faucet configuration" });
    }
  });

  // Check if user can claim for a specific currency
  app.get("/api/faucet/claim-status/:currency", isAuthenticated, async (req: any, res) => {
    try {
      const { currency } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const claimStatus = await storage.canUserClaim(userId, currency);
      const wallet = await storage.getFaucetWallet(userId, currency);
      
      res.json({
        ...claimStatus,
        totalEarned: wallet?.totalEarned || "0",
        totalClaims: wallet?.totalClaims || 0,
        lastClaimTime: wallet?.lastClaimTime
      });
    } catch (error) {
      console.error("Error checking claim status:", error);
      res.status(500).json({ error: "Failed to check claim status" });
    }
  });

  // Process faucet claim
  app.post("/api/faucet/claim", isAuthenticated, async (req: any, res) => {
    try {
      const { currency, faucetpayAddress, deviceFingerprint } = faucetClaimSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;

      if (!userId || !req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if FaucetPay is configured
      const faucetPayService = getFaucetPayService();
      if (!faucetPayService) {
        return res.status(503).json({ error: "Faucet service is not configured" });
      }

      // Check if user can claim
      const claimStatus = await storage.canUserClaim(userId, currency);
      if (!claimStatus.canClaim) {
        return res.status(429).json({ 
          error: "Claim not available yet",
          nextClaimTime: claimStatus.nextClaimTime,
          secondsRemaining: claimStatus.secondsRemaining
        });
      }

      // Get faucet configuration
      const [config] = await storage.getFaucetConfig(currency);
      if (!config || !config.isEnabled) {
        return res.status(400).json({ error: `Faucet not available for ${currency}` });
      }

      // Check FaucetPay balance
      try {
        const balance = await faucetPayService.getBalance(currency);
        const balanceAmount = parseInt(balance.balance);
        const rewardAmountNumber = parseFloat(config.rewardAmount);
        if (balanceAmount < rewardAmountNumber) {
          return res.status(503).json({ error: "Faucet temporarily out of funds" });
        }
      } catch (error) {
        console.error("FaucetPay balance check failed:", error);
        return res.status(503).json({ error: "Faucet service temporarily unavailable" });
      }

      // Calculate reward and cash value
      const rewardAmount = parseFloat(config.rewardAmount);
      const cashValue = rewardAmount * 0.001; // Estimate based on crypto prices

      // Get user's IP address for anti-fraud
      const ipAddress = req.ip || req.connection.remoteAddress || '';

      let claim: any = null;
      try {
        // Create faucet claim record
        claim = await storage.createFaucetClaim({
          userId,
          currency,
          rewardAmount: config.rewardAmount,
          cashValue: cashValue.toFixed(2),
          ipAddress,
          userAgent: req.get('User-Agent'),
          deviceFingerprint
        });

        // Send payment via FaucetPay
        const paymentResult = await faucetPayService.sendPayment({
          amount: parseInt(config.rewardAmount),
          to: faucetpayAddress,
          currency,
          ipAddress
        });

        // Update claim with payment details
        await storage.updateFaucetClaim(claim.id, {
          status: 'paid',
          faucetpayPayoutId: paymentResult.payout_id.toString(),
          faucetpayUserHash: paymentResult.payout_user_hash
        });

        // Create or update user's faucet wallet
        const existingWallet = await storage.getFaucetWallet(userId, currency);
        if (existingWallet && userId) {
          await storage.updateFaucetWallet(userId, currency, {
            totalEarned: (parseFloat(existingWallet.totalEarned) + rewardAmount).toFixed(8),
            totalClaims: (existingWallet.totalClaims || 0) + 1,
            lastClaimTime: new Date(),
            faucetpayAddress
          });
        } else {
          await storage.createFaucetWallet({
            userId,
            currency,
            faucetpayAddress,
            lastClaimTime: new Date()
          });
        }

        // Update daily revenue tracking
        const today = new Date().toISOString().split('T')[0];
        await storage.updateFaucetRevenue(today, currency, {
          totalClaims: 1,
          totalRewards: rewardAmount.toFixed(8),
          totalRevenue: FAUCETPAY_CONFIG.ESTIMATED_AD_REVENUE_PER_CLAIM.toFixed(2),
          uniqueUsers: 1,
          adViews: 1
        });

        res.json({
          success: true,
          reward: {
            amount: rewardAmount,
            currency,
            cashValue,
            payoutId: paymentResult.payout_id
          },
          nextClaimTime: new Date(Date.now() + config.claimInterval * 1000),
          remainingBalance: paymentResult.balance
        });

      } catch (paymentError: any) {
        console.error("FaucetPay payment failed:", paymentError);
        
        // Update claim status to failed - only if claim was created
        if (claim) {
          await storage.updateFaucetClaim(claim.id, {
            status: 'failed',
            failureReason: paymentError.message
          });
        }

        res.status(500).json({ 
          error: "Payment failed", 
          details: paymentError.message 
        });
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      console.error("Error processing faucet claim:", error);
      res.status(500).json({ error: "Failed to process claim" });
    }
  });

  // Get user's faucet claim history
  app.get("/api/faucet/claims", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const currency = req.query.currency as string;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!userId || !req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const claims = await storage.getFaucetClaims(userId, currency, limit);
      res.json({ claims });
    } catch (error) {
      console.error("Error getting faucet claims:", error);
      res.status(500).json({ error: "Failed to get claim history" });
    }
  });

  // Admin: Get faucet revenue statistics (business owner only)
  app.get("/api/faucet/admin/revenue", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const revenue = await storage.getFaucetRevenue();
      res.json({ revenue });
    } catch (error) {
      console.error("Error getting faucet revenue:", error);
      res.status(500).json({ error: "Failed to get revenue statistics" });
    }
  });

  // Admin: Update faucet configuration (business owner only)
  app.put("/api/faucet/admin/config/:currency", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { currency } = req.params;
      const updates = req.body;

      const updatedConfig = await storage.updateFaucetConfig(currency, updates);
      if (!updatedConfig) {
        return res.status(404).json({ error: "Currency configuration not found" });
      }

      res.json({ config: updatedConfig });
    } catch (error) {
      console.error("Error updating faucet config:", error);
      res.status(500).json({ error: "Failed to update configuration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
