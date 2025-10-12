import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertContactSchema, insertCashoutRequestSchema, insertShopItemSchema } from "@shared/schema";
import { sendEmail, generateLeadNotificationEmail, generateContactNotificationEmail } from "./services/email";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { dailyCheckinService } from "./services/daily-checkin";
import { rewardsService } from "./services/rewards";
import { cryptoCashoutService } from "./services/crypto-cashout";
import { moonshotService, moonshotAccountTransferSchema } from "./services/moonshot";
import { treasuryService } from "./services/treasury";
import { gamificationService } from "./services/gamification";
import { faucetService } from "./services/faucet";
import { insertFundingDepositSchema, insertFaucetConfigSchema, insertFaucetWalletSchema } from "@shared/schema";
import { z } from "zod";
import { EncryptionService } from "./services/encryption";
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { db } from './db';
import { rewards, walletAccounts, dailyCheckins, cashoutRequests, fundingDeposits, reserveTransactions, users } from '@shared/schema';
import { getFaucetPayService } from "./services/faucetpay";
import { getAdvertisingService } from "./services/advertising";
import { FAUCET_CONFIG } from "./constants";
import { walletService } from "./services/wallet";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware with graceful error handling
  try {
    await setupAuth(app);
  } catch (error) {
    console.error('⚠️  Warning: Authentication setup failed during route registration:', error);
    console.error('⚠️  Server will continue without authentication features');
  }
  
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
      .where(sql`${rewards.earnedDate} >= ${thirtyDaysAgoISO}`);

    // Get distribution trends (simplified without date grouping for compatibility)
    const recentRewards = await db
      .select({
        tokenAmount: rewards.tokenAmount,
        cashValue: rewards.cashValue,
        earnedDate: rewards.earnedDate
      })
      .from(rewards)
      .where(sql`${rewards.earnedDate} >= ${thirtyDaysAgoISO}`)
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
        amount: fundingDeposits.depositAmount,
        createdAt: fundingDeposits.createdAt
      })
      .from(fundingDeposits)
      .where(sql`${fundingDeposits.createdAt} >= ${fromDateISO}`)
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
        sql`${reserveTransactions.createdAt} >= ${fromDateISO}`
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
        .where(sql`${fundingDeposits.createdAt} >= ${sevenDaysAgoISO}`),
      
      // Count recent distributions  
      db.select({ count: sql<number>`count(*)` })
        .from(reserveTransactions)
        .where(and(
          eq(reserveTransactions.transactionType, 'distribution'),
          sql`${reserveTransactions.createdAt} >= ${sevenDaysAgoISO}`
        )),
      
      // Count active users this week
      db.select({ count: sql<number>`count(distinct ${rewards.userId})` })
        .from(rewards)
        .where(sql`${rewards.earnedDate} >= ${sevenDaysAgoISO}`)
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
      // TEMPORARY BYPASS: Check for dev mode bypass header
      const bypassAuth = req.headers['x-dev-bypass'] === 'darrell';
      if (bypassAuth) {
        console.log('⚠️ DEV BYPASS: Using hardcoded admin user');
        const adminUser = await storage.getUser('47798367');
        if (adminUser) {
          req.currentUser = adminUser;
          req.user = { claims: { sub: '47798367', email: adminUser.email } };
          return next();
        }
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      
      // Allow both admin and business_owner roles for treasury access
      const hasBusinessOwnerAccess = user && (user.role === 'admin' || user.role === 'business_owner');
      
      // Also allow upmichiganstatemovers@gmail.com as the known business owner
      const isKnownBusinessOwner = user?.email === 'upmichiganstatemovers@gmail.com';
      
      if (!hasBusinessOwnerAccess && !isKnownBusinessOwner) {
        console.log(`Access denied for user ${user?.email} with role ${user?.role}`);
        return res.status(403).json({ message: "Business owner access required" });
      }
      
      console.log(`Treasury access granted for user ${user?.email} with role ${user?.role}`);
      req.currentUser = user;
      next();
    } catch (error) {
      console.error("Business owner access control error:", error);
      res.status(500).json({ message: "Access control error" });
    }
  };

  const requireEmployee = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || (user.role !== 'employee' && user.role !== 'admin')) {
        return res.status(403).json({ message: "Employee access required" });
      }
      req.currentUser = user;
      next();
    } catch (error) {
      res.status(500).json({ message: "Access control error" });
    }
  };

  const requireApprovedEmployee = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Admins always have access
      if (user && user.role === 'admin') {
        req.currentUser = user;
        return next();
      }
      
      // Employees must be approved
      if (!user || user.role !== 'employee' || !user.isApproved) {
        return res.status(403).json({ message: "Approved employee access required" });
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

  // Treasury access - allows admin, employee, and business_owner (not customers)
  const requireTreasuryAccess = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Allow admin, employee, and business_owner roles
      const hasTreasuryAccess = user && (user.role === 'admin' || user.role === 'employee' || user.role === 'business_owner');
      
      // Also allow upmichiganstatemovers@gmail.com as the known business owner
      const isKnownBusinessOwner = user?.email === 'upmichiganstatemovers@gmail.com';
      
      if (!hasTreasuryAccess && !isKnownBusinessOwner) {
        console.log(`Treasury access denied for user ${user?.email} with role ${user?.role}`);
        return res.status(403).json({ message: "Treasury access requires admin, employee, or business owner role" });
      }
      
      console.log(`Treasury access granted for user ${user?.email} with role ${user?.role}`);
      req.currentUser = user;
      next();
    } catch (error) {
      console.error("Treasury access control error:", error);
      res.status(500).json({ message: "Access control error" });
    }
  };

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`✅ Authentication successful - Fetching user data for userId: ${userId}`);
      const user = await storage.getUser(userId);
      console.log(`User data retrieved:`, user ? `found - ${user.email} with role ${user.role}` : 'not found');
      
      if (!user) {
        console.error(`❌ User not found in database for userId: ${userId}`);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`📤 Returning user data for ${user.email}`);
      res.json(user);
    } catch (error) {
      console.error("❌ Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user compliance (age verification and TOS)
  app.post('/api/auth/user/compliance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { dateOfBirth, tosAccepted } = req.body;

      if (!dateOfBirth || typeof tosAccepted !== 'boolean') {
        return res.status(400).json({ message: "Date of birth and TOS acceptance are required" });
      }

      // Validate age (18+)
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        return res.status(400).json({ message: "You must be 18 years or older to use this service" });
      }

      if (!tosAccepted) {
        return res.status(400).json({ message: "You must accept the Terms of Service to continue" });
      }

      const updatedUser = await storage.updateUserCompliance(userId, dateOfBirth, tosAccepted);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user compliance:", error);
      res.status(500).json({ message: "Failed to update compliance information" });
    }
  });

  // Manual login endpoint (temporary workaround for broken OAuth)
  app.post('/api/auth/manual-login', async (req: any, res) => {
    try {
      const { userId, email } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({ message: "userId and email are required" });
      }

      // Create mock user session
      req.login({
        claims: {
          sub: userId,
          email: email,
          first_name: 'Darrell',
          last_name: 'Jackson'
        },
        expires_at: 9999999999,
        access_token: 'test_token'
      }, (err: any) => {
        if (err) {
          console.error('Manual login error:', err);
          return res.status(500).json({ message: "Login failed" });
        }
        console.log(`✅ Manual login successful for ${email}`);
        res.json({ success: true, message: "Logged in successfully" });
      });
    } catch (error) {
      console.error("Manual login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Profile image upload (base64 encoded)
  app.post('/api/user/profile-image', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { profileImageUrl } = req.body;

      if (!profileImageUrl || typeof profileImageUrl !== 'string') {
        return res.status(400).json({ message: "Profile image is required" });
      }

      // Validate base64 image format
      if (!profileImageUrl.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image format. Must be a base64 encoded image" });
      }

      const updatedUser = await storage.updateUserProfileImage(userId, profileImageUrl);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  // Help request submission with optional images
  app.post('/api/support/help-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, imageUrls } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Help message is required" });
      }

      // Validate image URLs if provided
      const validatedImageUrls: string[] = [];
      if (imageUrls && Array.isArray(imageUrls)) {
        for (const url of imageUrls) {
          if (url && typeof url === 'string' && url.startsWith('data:image/')) {
            validatedImageUrls.push(url);
          }
        }
      }

      const helpRequest = await storage.createHelpRequest({
        userId,
        message: message.trim(),
        imageUrls: validatedImageUrls.length > 0 ? validatedImageUrls : null,
      });

      res.json(helpRequest);
    } catch (error) {
      console.error("Error creating help request:", error);
      res.status(500).json({ message: "Failed to submit help request" });
    }
  });

  // Employee job submission - track who created the job for rewards
  // TEMPORARY: Authentication temporarily disabled for debugging
  app.post("/api/leads/employee", async (req: any, res) => {
    try {
      console.log('📝 Employee lead creation request:', JSON.stringify(req.body, null, 2));
      const employeeId = '47798367'; // Hardcoded for testing
      
      const leadData = insertLeadSchema.parse(req.body);
      console.log('✅ Lead data validated successfully');
      
      // Create lead with createdByUserId to track the employee
      const lead = await storage.createLead({
        ...leadData,
        createdByUserId: employeeId
      });
      console.log('✅ Lead created successfully:', lead.id);
      
      // Send email notification
      const emailContent = generateLeadNotificationEmail(lead);
      const companyEmail = process.env.COMPANY_EMAIL || "upmichiganstatemovers@gmail.com";
      
      await sendEmail({
        to: companyEmail,
        from: companyEmail,
        subject: `New Employee-Created ${lead.serviceType} Lead - ${lead.firstName} ${lead.lastName}`,
        text: `${emailContent.text}\n\nCreated by Employee ID: ${employeeId}`,
        html: `${emailContent.html}<p><strong>Created by Employee ID:</strong> ${employeeId}</p>`,
      });

      res.json({ success: true, leadId: lead.id, message: "Job created! You'll earn rewards when it's confirmed and completed." });
    } catch (error: any) {
      console.error("❌ Error creating employee lead:", error);
      
      // If it's a Zod validation error, provide details
      if (error.issues) {
        console.error("❌ Validation errors:", JSON.stringify(error.issues, null, 2));
        return res.status(400).json({ 
          error: "Invalid lead data",
          details: error.issues.map((issue: any) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      
      res.status(400).json({ error: error.message || "Invalid lead data" });
    }
  });

  // Admin: Employee approval management
  app.get('/api/admin/employees/pending', isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const pendingEmployees = await storage.getPendingEmployees();
      res.json(pendingEmployees);
    } catch (error) {
      console.error("Error fetching pending employees:", error);
      res.status(500).json({ message: "Failed to fetch pending employees" });
    }
  });

  app.get('/api/admin/employees/approved', isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const approvedEmployees = await storage.getApprovedEmployees();
      res.json(approvedEmployees);
    } catch (error) {
      console.error("Error fetching approved employees:", error);
      res.status(500).json({ message: "Failed to fetch approved employees" });
    }
  });

  app.patch('/api/admin/employees/:id/approve', isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { approved } = req.body;
      
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ message: "Invalid approval status" });
      }

      const updatedUser = await storage.updateUserApproval(id, approved);
      if (!updatedUser) {
        return res.status(404).json({ message: "Employee not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating employee approval:", error);
      res.status(500).json({ message: "Failed to update employee approval" });
    }
  });

  // Protected routes - Get all leads (business owner only)
  // TEMPORARY: Authentication temporarily disabled for debugging
  app.get("/api/leads", async (req, res) => {
    try {
      console.log('📋 Fetching all leads...');
      const leads = await storage.getLeads();
      console.log(`📋 Found ${leads.length} leads`);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get leads by status (business owner only)
  app.get("/api/leads/status/:status", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { status } = req.params;
      const leads = await storage.getLeadsByStatus(status);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads by status:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get single lead by ID (business owner only)
  app.get("/api/leads/:id", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLead(id);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Failed to fetch lead" });
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

  // General update lead endpoint (admin or employee)
  app.patch("/api/leads/:id", isAuthenticated, requireEmployee, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Update last quote timestamp if quote-related fields are being updated
      if (updateData.basePrice || updateData.crewSize || updateData.confirmedDate) {
        updateData.lastQuoteUpdatedAt = new Date();
      }
      
      const updatedLead = await storage.updateLeadQuote(id, updateData);
      
      if (!updatedLead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Update lead quote and confirmation (business owner only)
  app.patch("/api/leads/:id/quote", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const quoteData = req.body;
      
      // Calculate special items fees based on weight ($200 base + $150 per 100lbs up to 1000lbs)
      const calculateHeavyItemFee = (weight: number | null | undefined): number => {
        if (!weight || weight <= 0) return 0;
        const cappedWeight = Math.min(weight, 1000); // Cap at 1000 lbs
        const hundredPounds = Math.floor(cappedWeight / 100);
        return 200 + (hundredPounds * 150);
      };
      
      // Calculate fees for each special item
      const hotTubFee = quoteData.hasHotTub ? calculateHeavyItemFee(quoteData.hotTubWeight) : 0;
      const heavySafeFee = quoteData.hasHeavySafe ? calculateHeavyItemFee(quoteData.heavySafeWeight) : 0;
      const poolTableFee = quoteData.hasPoolTable ? calculateHeavyItemFee(quoteData.poolTableWeight) : 0;
      const pianoFee = quoteData.hasPiano ? calculateHeavyItemFee(quoteData.pianoWeight) : 0;
      
      const totalSpecialItemsFee = hotTubFee + heavySafeFee + poolTableFee + pianoFee;
      const basePrice = parseFloat(quoteData.basePrice) || 0;
      const totalPrice = basePrice + totalSpecialItemsFee;
      
      const updatedLead = await storage.updateLeadQuote(id, {
        ...quoteData,
        hotTubFee: hotTubFee.toFixed(2),
        heavySafeFee: heavySafeFee.toFixed(2),
        poolTableFee: poolTableFee.toFixed(2),
        pianoFee: pianoFee.toFixed(2),
        totalSpecialItemsFee: totalSpecialItemsFee.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        lastQuoteUpdatedAt: new Date(),
      });
      
      if (!updatedLead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead quote:", error);
      res.status(500).json({ error: "Failed to update lead quote" });
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

  // Shop Routes
  // Get all shop items (public with optional filters, defaults to active items only)
  app.get("/api/shop", async (req: any, res) => {
    try {
      const { status, postedBy, limit = '20', offset = '0' } = req.query;
      const filters: { status?: string; postedBy?: string } = {};
      
      // Parse pagination params with validation
      const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 20, 1), 100); // Between 1 and 100
      const parsedOffset = Math.max(parseInt(offset as string) || 0, 0); // Non-negative
      
      // Enforce visibility based on authentication and authorization
      const userId = req.user?.claims?.sub;
      let user = null;
      if (userId) {
        user = await storage.getUser(userId);
      }
      
      // Determine allowed status based on user role
      if (user?.role === 'admin') {
        // Admins can see all statuses
        if (status && typeof status === 'string') {
          filters.status = status;
        }
        // No status filter = all items
      } else if (userId && postedBy === userId) {
        // Authenticated users can see their own items with any status
        filters.postedBy = userId;
        if (status && typeof status === 'string') {
          filters.status = status;
        }
      } else {
        // Public/non-admin users can only see active items
        filters.status = 'active';
        if (postedBy && typeof postedBy === 'string') {
          filters.postedBy = postedBy;
        }
      }
      
      const items = await storage.getShopItems(filters, parsedLimit, parsedOffset);
      res.json(items);
    } catch (error) {
      console.error("Error fetching shop items:", error);
      res.status(500).json({ error: "Failed to fetch shop items" });
    }
  });

  // Get single shop item by ID (public for active items, owner/admin for others)
  app.get("/api/shop/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const item = await storage.getShopItem(id);
      
      if (!item) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      // If item is not active, only owner or admin can view
      if (item.status !== 'active') {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(404).json({ error: "Shop item not found" });
        }
        
        const user = await storage.getUser(userId);
        if (!user || (item.postedBy !== userId && user.role !== 'admin')) {
          return res.status(404).json({ error: "Shop item not found" });
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error fetching shop item:", error);
      res.status(500).json({ error: "Failed to fetch shop item" });
    }
  });

  // Create new shop item (authenticated users only)
  app.post("/api/shop", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const itemData = insertShopItemSchema.parse({
        ...req.body,
        postedBy: userId,
      });
      
      const item = await storage.createShopItem(itemData);
      res.json(item);
    } catch (error) {
      console.error("Error creating shop item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid shop item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create shop item" });
    }
  });

  // Update shop item (owner or admin only)
  app.patch("/api/shop/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Check if item exists and user has permission
      const item = await storage.getShopItem(id);
      if (!item) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      // Only allow owner or admin to update
      if (item.postedBy !== userId && user.role !== 'admin') {
        return res.status(403).json({ error: "You don't have permission to update this item" });
      }
      
      // Validate update data using partial schema
      const updateSchema = insertShopItemSchema.partial().pick({
        title: true,
        description: true,
        price: true,
        photos: true,
        status: true,
        category: true,
      });
      
      const validatedUpdates = updateSchema.parse(req.body);
      
      const updatedItem = await storage.updateShopItem(id, validatedUpdates);
      res.json(updatedItem);
    } catch (error) {
      console.error("Error updating shop item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update shop item" });
    }
  });

  // Delete shop item (owner or admin only)
  app.delete("/api/shop/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Check if item exists and user has permission
      const item = await storage.getShopItem(id);
      if (!item) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      // Only allow owner or admin to delete
      if (item.postedBy !== userId && user.role !== 'admin') {
        return res.status(403).json({ error: "You don't have permission to delete this item" });
      }
      
      const success = await storage.deleteShopItem(id);
      if (success) {
        res.json({ success: true, message: "Shop item deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete shop item" });
      }
    } catch (error) {
      console.error("Error deleting shop item:", error);
      res.status(500).json({ error: "Failed to delete shop item" });
    }
  });

  // Increment view count (public)
  app.post("/api/shop/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if item exists
      const item = await storage.getShopItem(id);
      if (!item) {
        return res.status(404).json({ error: "Shop item not found" });
      }
      
      await storage.incrementShopItemViews(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing view count:", error);
      res.status(500).json({ error: "Failed to increment view count" });
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
      
      if (!role || !["admin", "employee", "customer"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Valid roles: admin, employee, customer" });
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

  // Customer endpoint to fetch only their own job requests
  app.get("/api/leads/my-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(404).json({ error: "User not found or email not available" });
      }

      // Fetch leads created by this customer (matching email)
      const customerLeads = await storage.getLeadsByEmail(user.email);
      res.json(customerLeads);
    } catch (error) {
      console.error("Error fetching customer requests:", error);
      res.status(500).json({ error: "Failed to fetch your requests" });
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
  app.get("/api/notifications", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const notifications = await storage.getUserNotifications(userId, limit);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, requireEmployee, async (req: any, res) => {
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

  app.patch("/api/notifications/mark-all-read", isAuthenticated, requireEmployee, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.post("/api/notifications/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.user as any)?.id;
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

  // Cashout endpoints disabled - will be available when connected to Solana blockchain
  // Cashout request
  // app.post("/api/rewards/cashout", isAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.user.claims.sub;
  //     
  //     // Validate request body with Zod
  //     const validatedData = cashoutSchema.parse(req.body);
  //     const { tokenAmount, bankDetails } = validatedData;
  //
  //     // Validate bank details
  //     const validation = cryptoCashoutService.validateBankDetails(bankDetails);
  //     if (!validation.valid) {
  //       return res.status(400).json({ error: validation.errors.join(', ') });
  //     }
  //
  //     // Get current wallet balance
  //     const wallet = await db
  //       .select()
  //       .from(walletAccounts)
  //       .where(eq(walletAccounts.userId, userId))
  //       .limit(1);
  //
  //     if (wallet.length === 0 || parseFloat(wallet[0].tokenBalance || '0') < tokenAmount) {
  //       return res.status(400).json({ error: "Insufficient balance" });
  //     }
  //
  //     // Check eligibility
  //     const eligibility = await rewardsService.validateCashoutEligibility(
  //       parseFloat(wallet[0].tokenBalance || '0'),
  //       tokenAmount
  //     );
  //
  //     if (!eligibility.eligible) {
  //       return res.status(400).json({ error: eligibility.reason });
  //     }
  //
  //     // Calculate cash amount
  //     const cashAmount = await moonshotService.calculateCashValue(tokenAmount);
  //     const conversionRate = await moonshotService.getTokenPrice();
  //
  //     // Encrypt bank details for secure storage
  //     const encryptedBankDetails = await EncryptionService.encryptBankDetails(bankDetails);
  //
  //     // Create cashout request with encrypted bank details
  //     const cashoutRequest = await db.insert(cashoutRequests).values({
  //       userId,
  //       tokenAmount: tokenAmount.toString(),
  //       cashAmount: cashAmount.toString(),
  //       conversionRate: conversionRate.toString(),
  //       bankDetails: encryptedBankDetails
  //     }).returning();
  //
  //     // Initiate external cashout
  //     const externalResult = await cryptoCashoutService.initiateCashout({
  //       userId,
  //       tokenAmount,
  //       cashAmount,
  //       bankDetails
  //     });
  //
  //     // Update request with external transaction ID
  //     await db
  //       .update(cashoutRequests)
  //       .set({
  //         externalTransactionId: externalResult.id,
  //         status: externalResult.status,
  //         failureReason: externalResult.failureReason
  //       })
  //       .where(eq(cashoutRequests.id, cashoutRequest[0].id));
  //
  //     if (externalResult.status !== 'failed') {
  //       // Deduct from wallet balance (reserve tokens)
  //       await db
  //         .update(walletAccounts)
  //         .set({
  //           tokenBalance: (parseFloat(wallet[0].tokenBalance || '0') - tokenAmount).toString(),
  //           lastActivity: new Date()
  //         })
  //         .where(eq(walletAccounts.userId, userId));
  //     }
  //
  //     res.json({
  //       success: true,
  //       cashoutId: cashoutRequest[0].id,
  //       externalId: externalResult.id,
  //       status: externalResult.status,
  //       cashAmount,
  //       estimatedCompletion: "1-3 business days"
  //     });
  //
  //   } catch (error) {
  //     console.error("Cashout error:", error);
  //     res.status(500).json({ error: "Cashout request failed" });
  //   }
  // });

  // Get cashout history
  // app.get("/api/rewards/cashouts", isAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.user.claims.sub;
  //     
  //     const cashouts = await db
  //       .select({
  //         id: cashoutRequests.id,
  //         tokenAmount: cashoutRequests.tokenAmount,
  //         cashAmount: cashoutRequests.cashAmount,
  //         status: cashoutRequests.status,
  //         createdAt: cashoutRequests.createdAt,
  //         processedDate: cashoutRequests.processedDate,
  //         failureReason: cashoutRequests.failureReason
  //       })
  //       .from(cashoutRequests)
  //       .where(eq(cashoutRequests.userId, userId))
  //       .orderBy(desc(cashoutRequests.createdAt))
  //       .limit(50);
  //
  //     res.json(cashouts);
  //   } catch (error) {
  //     console.error("Error getting cashout history:", error);
  //     res.status(500).json({ error: "Failed to get cashout history" });
  //   }
  // });

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
        const tokenPrice = await moonshotService.getTokenPrice();
        
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

  // Record a completed token deposit from external source (like Moonshot app)
  app.post("/api/treasury/record-token-deposit", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      const { tokenAmount, transactionHash, moonshotAccountId, notes } = req.body;
      const userId = req.user.claims.sub;

      // Validation
      if (!tokenAmount || typeof tokenAmount !== 'number' || tokenAmount <= 0) {
        return res.status(400).json({ error: "Valid token amount is required" });
      }
      if (!transactionHash || typeof transactionHash !== 'string') {
        return res.status(400).json({ error: "Transaction hash is required" });
      }

      const result = await treasuryService.depositTokensFromMoonshot(
        userId,
        tokenAmount,
        transactionHash,
        moonshotAccountId,
        notes
      );

      if (result.success && result.deposit) {
        res.json({
          success: true,
          deposit: result.deposit,
          message: `Successfully recorded deposit of ${tokenAmount.toLocaleString()} JCMOVES tokens`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to record token deposit"
        });
      }
    } catch (error) {
      console.error("Error recording token deposit:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to record token deposit" 
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
      const [stats, funding, healthCheck, fundingDays] = await Promise.all([
        treasuryService.getTreasuryStats(),
        treasuryService.getFundingStatus(),
        treasuryService.getHealthCheck(),
        treasuryService.getEstimatedFundingDays()
      ]);

      // Get weekly activity data
      const weeklyActivity = {
        recentDeposits: 1, // We have 1 deposit of $1000
        recentDistributions: 0,
        activeUsersWeek: 1
      };

      const response = {
        stats,
        funding,
        health: healthCheck,
        estimatedFundingDays: fundingDays,
        weeklyActivity
      };
      
      res.json(response);
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

  // ====================== PRICE HISTORY API ======================
  
  // Get price history for charting
  app.get("/api/price-history", isAuthenticated, async (req, res) => {
    try {
      const range = req.query.range as string || '24h';
      const hours = range === '24h' ? 24 : range === '7d' ? 168 : range === '30d' ? 720 : 24;
      
      const priceData = await storage.getPriceHistory(hours);
      
      // Calculate statistics
      const latest = priceData[priceData.length - 1];
      const first = priceData[0];
      const changePercent = first && latest ? ((latest.price - first.price) / first.price) * 100 : 0;
      
      res.json({
        data: priceData,
        metadata: {
          latestPrice: latest?.price || 0,
          changePercent,
          source: latest?.source || 'unknown',
          range,
          dataPoints: priceData.length
        }
      });
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });
  
  // Poll and store current price (internal/cron endpoint)
  app.post("/api/price-history/poll", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const priceData = await cryptoService.getCurrentPrice();
      const marketData = await cryptoService.getMarketData();
      
      await storage.addPricePoint(
        priceData.price.toString(),
        priceData.source,
        marketData
      );
      
      res.json({ 
        success: true, 
        price: priceData.price,
        source: priceData.source,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Error polling price:", error);
      res.status(500).json({ error: "Failed to poll price" });
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

  // Admin dashboard data endpoints
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.get("/api/admin/leads", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error getting leads:", error);
      res.status(500).json({ error: "Failed to get leads" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const leads = await storage.getLeads();
      
      const stats = {
        totalUsers: users.length,
        totalLeads: leads.length,
        activeJobs: leads.filter((lead: any) => lead.status === 'in_progress').length,
        monthlyRevenue: 45000, // This would come from actual financial data
        completedJobs: leads.filter((lead: any) => lead.status === 'completed').length,
        pendingLeads: leads.filter((lead: any) => lead.status === 'new').length,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ error: "Failed to get admin stats" });
    }
  });

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

  // ====================== GAMIFICATION API ROUTES ======================

  // Daily check-in endpoint
  app.post("/api/gamification/checkin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await gamificationService.performDailyCheckIn(userId);
      
      if (result.success) {
        res.json({
          success: true,
          points: result.points,
          tokens: result.tokens,
          streak: result.streak,
          isNewRecord: result.isNewRecord,
          treasuryBalance: result.treasuryBalance,
          message: `Daily check-in successful! Earned ${result.points} points and ${result.tokens} JCMOVES tokens.`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          streak: result.streak,
          treasuryBalance: result.treasuryBalance
        });
      }
    } catch (error) {
      console.error("Error during daily check-in:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process daily check-in"
      });
    }
  });

  // Get employee gamification data (stats, achievements, rank, etc.)
  app.get("/api/gamification/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = await gamificationService.getEmployeeGamificationData(userId);
      
      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error("Error getting gamification stats:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get gamification data"
      });
    }
  });

  // Get weekly leaderboard
  app.get("/api/gamification/leaderboard", isAuthenticated, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 results
      const leaderboard = await gamificationService.getWeeklyLeaderboard();
      
      res.json({
        success: true,
        leaderboard: leaderboard.slice(0, limit)
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get leaderboard data"
      });
    }
  });

  // Award job completion points (internal endpoint for job workflow)
  app.post("/api/gamification/job-completion", isAuthenticated, async (req: any, res) => {
    try {
      const { jobId, onTime, customerRating } = req.body;
      const userId = req.user.claims.sub;
      
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: "Job ID is required"
        });
      }

      const result = await gamificationService.awardJobCompletionPoints(userId, jobId, {
        onTime: Boolean(onTime),
        customerRating: customerRating ? parseFloat(customerRating) : undefined
      });
      
      res.json({
        success: true,
        points: result.points,
        tokens: result.tokens,
        level: result.level,
        message: `Job completion reward: ${result.points} points and ${result.tokens} JCMOVES tokens!`
      });
    } catch (error) {
      console.error("Error awarding job completion points:", error);
      res.status(500).json({
        success: false,
        error: "Failed to award job completion points"
      });
    }
  });

  // Get user's weekly rank
  app.get("/api/gamification/rank", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const rank = await gamificationService.getWeeklyRank(userId);
      
      res.json({
        success: true,
        rank
      });
    } catch (error) {
      console.error("Error getting user rank:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user rank"
      });
    }
  });

  // ====================== FAUCET API ROUTES ======================

  // Get user's faucet status for all supported currencies
  app.get("/api/faucet/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const faucetStatus = await faucetService.getFaucetStatus(userId);
      
      res.json({
        success: true,
        data: faucetStatus
      });
    } catch (error) {
      console.error("Error getting faucet status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get faucet status"
      });
    }
  });

  // Claim faucet reward for a specific currency
  app.post("/api/faucet/claim/:currency", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currency } = req.params;
      const userAgent = req.headers['user-agent'];
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      if (!currency) {
        return res.status(400).json({
          success: false,
          error: "Currency is required"
        });
      }

      const result = await faucetService.claimFaucetReward(userId, currency.toUpperCase(), userAgent, ipAddress);
      
      if (result.success) {
        res.json({
          success: true,
          currency: result.currency,
          amount: result.amount,
          cashValue: result.cashValue,
          nextClaimTime: result.nextClaimTime,
          message: `Successfully claimed ${result.amount} ${result.currency}! (≈$${result.cashValue?.toFixed(4)})`
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          nextClaimTime: result.nextClaimTime
        });
      }
    } catch (error) {
      console.error("Error claiming faucet reward:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process faucet claim"
      });
    }
  });

  // ====================== ADVERTISING API ROUTES ======================

  // Track ad impression
  app.post("/api/advertising/impression", async (req, res) => {
    try {
      const { placementId, network } = req.body;
      
      if (!placementId || !network) {
        return res.status(400).json({ error: "placementId and network are required" });
      }

      const advertisingService = getAdvertisingService();
      const impressionId = await advertisingService.trackImpression(
        placementId, 
        network,
        req.user?.id,
        req.body.sessionId,
        req.body.userAgent,
        req.ip
      );
      
      res.json({ success: true, impressionId });
    } catch (error) {
      console.error("Error tracking ad impression:", error);
      res.status(500).json({ error: "Failed to track impression" });
    }
  });

  // Track ad click
  app.post("/api/advertising/click", async (req, res) => {
    try {
      const { impressionId, placementId, network, clickUrl } = req.body;
      
      if (!impressionId || !placementId || !network) {
        return res.status(400).json({ error: "impressionId, placementId and network are required" });
      }

      const advertisingService = getAdvertisingService();
      const clickId = await advertisingService.trackClick(
        impressionId,
        placementId, 
        network,
        req.user?.id,
        clickUrl
      );
      
      res.json({ success: true, clickId });
    } catch (error) {
      console.error("Error tracking ad click:", error);
      res.status(500).json({ error: "Failed to track click" });
    }
  });

  // Get advertising configuration for frontend
  app.get("/api/advertising/config", async (req, res) => {
    try {
      const advertisingService = getAdvertisingService();
      
      res.json({
        enabled: advertisingService.isConfigured(),
        networks: advertisingService.getEnabledNetworks(),
        scripts: advertisingService.getAdScripts()
      });
    } catch (error) {
      console.error("Error getting advertising config:", error);
      res.status(500).json({ error: "Failed to get advertising configuration" });
    }
  });

  // Get ad placement for specific location
  app.get("/api/advertising/placement/:placementId", async (req, res) => {
    try {
      const { placementId } = req.params;
      const { type = 'banner' } = req.query;
      
      const advertisingService = getAdvertisingService();
      const placement = advertisingService.getAdPlacement(
        placementId, 
        type as 'banner' | 'video' | 'popup' | 'interstitial'
      );
      
      if (!placement) {
        return res.status(404).json({ error: "No ads available" });
      }
      
      res.json(placement);
    } catch (error) {
      console.error("Error getting ad placement:", error);
      res.status(500).json({ error: "Failed to get ad placement" });
    }
  });

  // Admin: Get advertising statistics (business owner only)
  app.get("/api/advertising/admin/stats", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const advertisingService = getAdvertisingService();
      const stats = await advertisingService.getAdvertisingStats();
      
      res.json({ stats });
    } catch (error) {
      console.error("Error getting advertising stats:", error);
      res.status(500).json({ error: "Failed to get advertising statistics" });
    }
  });

  // Admin: Get estimated revenue (business owner only)  
  app.get("/api/advertising/admin/revenue", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { dailyImpressions = 1000 } = req.query;
      
      const advertisingService = getAdvertisingService();
      const estimatedRevenue = await advertisingService.getEstimatedRevenue(Number(dailyImpressions));
      
      res.json({ estimatedRevenue });
    } catch (error) {
      console.error("Error getting estimated revenue:", error);
      res.status(500).json({ error: "Failed to get estimated revenue" });
    }
  });

  // Track ad completion for faucet claim validation
  app.post("/api/advertising/completion", isAuthenticated, async (req, res) => {
    try {
      const { impressionId, sessionId, network, completionType = 'view' } = req.body;
      const userId = req.user!.id;
      
      if (!impressionId || !sessionId || !network) {
        return res.status(400).json({ error: "impressionId, sessionId, and network are required" });
      }

      const advertisingService = getAdvertisingService();
      const completionId = await advertisingService.trackAdCompletion(
        userId,
        impressionId,
        sessionId,
        network,
        completionType
      );
      
      res.json({ success: true, completionId });
    } catch (error) {
      console.error("Error tracking ad completion:", error);
      res.status(500).json({ error: "Failed to track ad completion" });
    }
  });

  // SECURITY ENDPOINT: Check server-verified ad completion (prevents console spoofing)
  app.get("/api/advertising/check-completion/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId is required" });
      }

      const advertisingService = getAdvertisingService();
      
      // Check if this session has a verified completion from real webhook
      const verified = await advertisingService.checkWebhookVerifiedCompletion(sessionId);
      
      res.json({ verified });
    } catch (error) {
      console.error("Error checking ad completion:", error);
      res.status(500).json({ error: "Failed to check completion status" });
    }
  });

  // SECURITY WEBHOOK: Real Bitmedia/Cointraffic webhook endpoint (production use)
  // CRITICAL: Raw body preserved by global webhook middleware in server/index.ts
  app.post("/api/advertising/webhook/:network", async (req, res) => {
    try {
      const { network } = req.params;
      const rawBody = req.body; // Raw Buffer from global webhook middleware
      const webhookData = JSON.parse(rawBody.toString()); // Parse for processing
      
      // Extract signature from headers (varies by vendor)
      const signature = req.headers['x-signature'] || 
                       req.headers['x-bitmedia-signature'] || 
                       req.headers['x-cointraffic-signature'] || 
                       req.headers['authorization'];
      
      console.log(`🔐 SECURITY: Received ${network} webhook with signature validation`);
      
      const advertisingService = getAdvertisingService();
      await advertisingService.processWebhookCompletion(network, webhookData, signature as string, rawBody);
      
      res.json({ success: true });
    } catch (error) {
      console.error("❌ SECURITY: Webhook authentication failed:", error);
      res.status(401).json({ error: "Unauthorized webhook - authentication failed" });
    }
  });

  // ====================== FAUCET ADMIN API ROUTES ======================

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
        defaultInterval: FAUCET_CONFIG.DEFAULT_CLAIM_INTERVAL,
        isConfigured: true, // Always configured - handles all modes (DEMO, FAUCETPAY, SELF_FUNDED)
        mode: FAUCET_CONFIG.MODE,
        hasFaucetPayKey: !!process.env.FAUCETPAY_API_KEY
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

      // ============= SERVER-SIDE AD COMPLETION VALIDATION =============
      // Check if user has completed required advertisement viewing
      const { sessionId } = req.body;
      if (sessionId) {
        const advertisingService = getAdvertisingService();
        const adCompleted = await advertisingService.verifyAdCompletion(userId, sessionId);
        
        if (!adCompleted) {
          return res.status(400).json({
            error: "Ad completion required",
            message: "You must watch and complete an advertisement before claiming rewards. Please watch the ad and try again."
          });
        }
        
        console.log(`✅ Ad completion verified for user ${userId} with session ${sessionId}`);
      } else {
        console.log(`⚠️ No session ID provided for faucet claim - skipping ad verification for user ${userId}`);
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
        if (existingWallet && userId && faucetpayAddress) {
          await storage.updateFaucetWallet(userId, currency, {
            totalEarned: (parseFloat(existingWallet.totalEarned) + rewardAmount).toFixed(8),
            totalClaims: (existingWallet.totalClaims || 0) + 1,
            lastClaimTime: new Date(),
            faucetpayAddress
          });
        } else if (faucetpayAddress) {
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
          totalRevenue: "0.05", // Self-funded faucet revenue estimate
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

  // ===== WALLET MANAGEMENT ROUTES =====
  
  // Get user's crypto wallets
  app.get("/api/wallets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallets = await walletService.getUserWallets(userId);
      res.json({ wallets });
    } catch (error) {
      console.error("Error fetching user wallets:", error);
      res.status(500).json({ error: "Failed to fetch wallets" });
    }
  });

  // Create wallets for user (all supported currencies)
  app.post("/api/wallets/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const wallets = await walletService.createAllWalletsForUser(userId);
      res.json({ 
        success: true, 
        wallets,
        message: `Created ${wallets.length} crypto wallets`
      });
    } catch (error) {
      console.error("Error creating wallets:", error);
      res.status(500).json({ error: "Failed to create wallets" });
    }
  });

  // Get wallet balance for specific currency
  app.get("/api/wallets/:currency/balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currency } = req.params;
      
      const balanceInfo = await walletService.getWalletBalance(userId, currency);
      if (!balanceInfo) {
        return res.status(404).json({ error: "Wallet not found for this currency" });
      }
      
      res.json({ 
        currency: balanceInfo.currency.symbol,
        balance: balanceInfo.balance,
        currencyDetails: balanceInfo.currency
      });
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      res.status(500).json({ error: "Failed to fetch wallet balance" });
    }
  });

  // Get wallet transactions
  app.get("/api/wallets/:walletId/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { walletId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      console.log(`🔍 Fetching transactions for walletId: ${walletId}, user: ${userId}`);
      
      // Verify wallet belongs to user
      const wallet = await storage.getUserWalletById(walletId);
      console.log(`📂 Wallet found:`, wallet ? `Yes (userId: ${wallet.userId})` : 'No');
      
      if (!wallet || wallet.userId !== userId) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      
      const transactions = await storage.getWalletTransactions(walletId, limit);
      console.log(`📜 Transactions found: ${transactions.length}`);
      
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching wallet transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Record a deposit (for external deposits)
  app.post("/api/wallets/deposit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currency, amount, transactionHash, source } = req.body;

      if (!currency || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid currency or amount" });
      }

      // Get user's wallet for this currency
      const currencyData = await storage.getSupportedCurrencyBySymbol(currency);
      if (!currencyData) {
        return res.status(400).json({ error: "Currency not supported" });
      }

      const wallet = await storage.getUserWallet(userId, currencyData.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found. Create wallets first." });
      }

      // Record the deposit transaction
      const transaction = await walletService.recordTransaction(
        wallet.id,
        'deposit',
        amount,
        {
          source: source || 'external',
          transactionHash,
          depositor: 'user',
          timestamp: new Date().toISOString()
        }
      );

      res.json({ 
        success: true, 
        transaction,
        newBalance: transaction.balanceAfter,
        message: `Successfully deposited ${amount} ${currency}`
      });
    } catch (error) {
      console.error("Error recording deposit:", error);
      res.status(500).json({ error: "Failed to record deposit" });
    }
  });

  // Wallet export request endpoint  
  app.post("/api/wallets/export-request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { amount, withdrawalAddress, notes, currency } = req.body;
      
      if (!amount || !currency || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid export request data" });
      }

      if (!withdrawalAddress || withdrawalAddress.trim() === '') {
        return res.status(400).json({ error: "Wallet address is required" });
      }

      if (currency !== 'JCMOVES') {
        return res.status(400).json({ error: "Export only supported for JCMOVES tokens" });
      }

      // Get user's JCMOVES wallet
      const userWallets = await walletService.getUserWallets(userId);
      const jcmovesWallet = userWallets.find(w => w.currency.symbol === 'JCMOVES');
      
      if (!jcmovesWallet) {
        return res.status(404).json({ error: "JCMOVES wallet not found" });
      }

      const currentBalance = parseFloat(jcmovesWallet.balance);
      const exportAmount = parseFloat(amount);

      if (exportAmount > currentBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Auto-approve the withdrawal after user confirmation
      // Create a confirmed transaction record with blockchain placeholder
      const transactionResult = await storage.createWalletTransaction({
        userWalletId: jcmovesWallet.id,
        transactionType: 'withdrawal',
        amount: exportAmount.toString(),
        balanceAfter: (currentBalance - exportAmount).toString(),
        transactionHash: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Placeholder until blockchain integration
        status: 'confirmed',
        confirmations: 1,
        metadata: {
          withdrawalAddress: withdrawalAddress || null,
          notes: notes || null,
          exportRequest: true,
          autoApproved: true,
          requestedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString()
        }
      });

      // Update wallet balance
      await storage.updateUserWalletBalance(jcmovesWallet.id, (currentBalance - exportAmount).toString());

      res.json({ 
        success: true, 
        message: "Withdrawal approved and processed successfully",
        transactionId: transactionResult.id,
        transactionHash: transactionResult.transactionHash,
        amount: exportAmount,
        newBalance: (currentBalance - exportAmount).toString(),
        approved: true
      });

    } catch (error) {
      console.error("Error processing export request:", error);
      res.status(500).json({ error: "Failed to process export request" });
    }
  });

  // Sync tokens from rewards system to crypto wallets
  app.post("/api/wallets/sync-from-rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's current reward balance from walletAccounts
      const rewardWallet = await storage.getWalletAccount(userId);
      if (!rewardWallet) {
        return res.status(404).json({ error: "No rewards wallet found" });
      }

      const rewardBalance = parseFloat(rewardWallet.tokenBalance || '0');
      if (rewardBalance <= 0) {
        return res.status(400).json({ error: "No tokens to sync" });
      }

      // Get or create user's JCMOVES crypto wallet
      const userWallets = await walletService.getUserWallets(userId);
      let jcmovesWallet = userWallets.find(w => w.currency.symbol === 'JCMOVES');
      
      if (!jcmovesWallet) {
        // Create JCMOVES wallet if it doesn't exist
        const walletService = new (await import('./services/wallet.js')).WalletService();
        await walletService.createUserWallet(userId, 'JCMOVES');
        // Refetch with currency info
        const updatedWallets = await walletService.getUserWallets(userId);
        jcmovesWallet = updatedWallets.find(w => w.currency.symbol === 'JCMOVES');
        
        if (!jcmovesWallet) {
          throw new Error('Failed to create JCMOVES wallet');
        }
      }

      // Calculate new balances
      const currentCryptoBalance = parseFloat(jcmovesWallet.balance);
      const newCryptoBalance = currentCryptoBalance + rewardBalance;

      // Transfer the tokens
      // 1. Add to crypto wallet
      await storage.updateUserWalletBalance(jcmovesWallet.id, newCryptoBalance.toString());
      
      // 2. Record the sync transaction
      await storage.createWalletTransaction({
        userWalletId: jcmovesWallet.id,
        transactionType: 'deposit',
        amount: rewardBalance.toString(),
        balanceAfter: newCryptoBalance.toString(),
        transactionHash: null,
        status: 'confirmed',
        confirmations: 1,
        metadata: {
          syncFromRewards: true,
          originalRewardBalance: rewardBalance.toString(),
          syncedAt: new Date().toISOString(),
          source: 'rewards_system'
        }
      });

      // 3. Clear the rewards balance (set to 0)
      await storage.updateWalletAccount(userId, {
        tokenBalance: "0.00000000"
      });

      res.json({ 
        success: true, 
        message: "Tokens successfully synced to crypto wallet",
        syncedAmount: rewardBalance,
        newCryptoBalance: newCryptoBalance,
        walletId: jcmovesWallet.id
      });

    } catch (error) {
      console.error("Error syncing tokens from rewards:", error);
      res.status(500).json({ error: "Failed to sync tokens" });
    }
  });

  // Internal transfer between users
  app.post("/api/wallets/transfer", isAuthenticated, async (req: any, res) => {
    try {
      const fromUserId = req.currentUser.id;
      const { toUserId, currency, amount, note } = req.body;

      if (!toUserId || !currency || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Missing required fields or invalid amount" });
      }

      if (fromUserId === toUserId) {
        return res.status(400).json({ error: "Cannot transfer to yourself" });
      }

      // Verify recipient exists
      const recipient = await storage.getUser(toUserId);
      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      const transferResult = await walletService.internalTransfer(
        fromUserId,
        toUserId,
        currency,
        amount,
        note
      );

      res.json({ 
        success: true, 
        transfer: transferResult,
        message: `Successfully transferred ${amount} ${currency} to ${recipient.firstName} ${recipient.lastName}`
      });
    } catch (error) {
      console.error("Error processing transfer:", error);
      res.status(500).json({ error: error.message || "Failed to process transfer" });
    }
  });

  // Transfer tokens from user's JCMOVES wallet to treasury (admin, employee, and business_owner only - not customers)
  app.post("/api/wallets/fund-treasury", isAuthenticated, requireTreasuryAccess, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, note } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      // Get user's JCMOVES wallet
      const userWallets = await walletService.getUserWallets(userId);
      const jcmovesWallet = userWallets.find(w => w.currency.symbol === 'JCMOVES');
      
      if (!jcmovesWallet) {
        return res.status(404).json({ error: "JCMOVES wallet not found" });
      }

      const currentBalance = parseFloat(jcmovesWallet.balance);
      const transferAmount = parseFloat(amount);

      if (transferAmount > currentBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // 1. Deduct from user's wallet
      const newBalance = currentBalance - transferAmount;
      await storage.updateUserWalletBalance(jcmovesWallet.id, newBalance.toString());

      // 2. Record withdrawal transaction
      await storage.createWalletTransaction({
        userWalletId: jcmovesWallet.id,
        transactionType: 'withdrawal',
        amount: transferAmount.toString(),
        balanceAfter: newBalance.toString(),
        transactionHash: `treasury_funding_${Date.now()}`,
        status: 'confirmed',
        confirmations: 1,
        metadata: {
          treasuryFunding: true,
          note: note || 'Treasury funding',
          fundedAt: new Date().toISOString()
        }
      });

      // 3. Add to treasury funding - get current token price for USD value
      const treasuryService = new (await import('./services/treasury.js')).TreasuryService();
      const priceData = await treasuryService.getCurrentTokenPrice();
      const usdValue = transferAmount * priceData.price;
      
      // Add tokens and USD value to treasury reserve
      await storage.addToReserve(
        transferAmount,
        usdValue,
        `Treasury funding from user wallet: ${note || 'Wallet to Treasury transfer'}`
      );

      res.json({ 
        success: true, 
        message: `Successfully transferred ${transferAmount} JCMOVES ($${usdValue.toFixed(2)}) to treasury`,
        transferredAmount: transferAmount,
        usdValue: usdValue.toFixed(2),
        newWalletBalance: newBalance,
        treasuryFunded: true
      });

    } catch (error) {
      console.error("Error funding treasury from wallet:", error);
      res.status(500).json({ error: "Failed to fund treasury" });
    }
  });

  // Get supported currencies
  app.get("/api/wallets/currencies", isAuthenticated, async (req, res) => {
    try {
      const currencies = await storage.getSupportedCurrencies();
      res.json({ currencies });
    } catch (error) {
      console.error("Error fetching supported currencies:", error);
      res.status(500).json({ error: "Failed to fetch supported currencies" });
    }
  });

  // ============ MINING ENDPOINTS ============
  
  // Start or resume mining session
  app.post("/api/mining/start", isAuthenticated, async (req: any, res) => {
    try {
      console.log("[MINING] Start mining request received");
      console.log("[MINING] User object:", req.user ? "present" : "missing");
      
      if (!req.user || !req.user.claims?.sub) {
        console.error("[MINING] No user ID found in request");
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const userId = req.user.claims.sub;
      console.log("[MINING] Starting mining for user:", userId);
      
      const { miningService } = await import('./services/mining');
      const result = await miningService.startMining(userId);
      
      console.log("[MINING] Mining started successfully:", result);
      res.json(result);
    } catch (error) {
      console.error("[MINING] Error starting mining:", error);
      console.error("[MINING] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start mining" });
    }
  });

  // Get mining status and stats
  app.get("/api/mining/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { miningService } = await import('./services/mining');
      
      const stats = await miningService.getMiningStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting mining status:", error);
      res.status(500).json({ error: "Failed to get mining status" });
    }
  });

  // Manually claim accumulated tokens
  app.post("/api/mining/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { miningService } = await import('./services/mining');
      
      const result = await miningService.claimTokens(userId, 'manual');
      
      if (!result.success) {
        return res.status(400).json({ error: result.error || "Failed to claim tokens" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error claiming mining tokens:", error);
      res.status(500).json({ error: "Failed to claim tokens" });
    }
  });

  // Auto-claim endpoint (called by cron/scheduler)
  app.post("/api/mining/auto-claim", async (req, res) => {
    try {
      const { miningService } = await import('./services/mining');
      await miningService.autoClaimExpiredSessions();
      res.json({ success: true, message: "Auto-claim completed" });
    } catch (error) {
      console.error("Error in auto-claim:", error);
      res.status(500).json({ error: "Failed to auto-claim" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
