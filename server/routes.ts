import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertContactSchema } from "@shared/schema";
import { sendEmail, generateLeadNotificationEmail, generateContactNotificationEmail } from "./services/email";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
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

  // Role-based access control middleware
  const requireBusinessOwner = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'business_owner') {
        return res.status(403).json({ message: "Business owner access required" });
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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Protected routes - Get all leads (dashboard only)
  app.get("/api/leads", isAuthenticated, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Protected routes - Update lead status (dashboard only)
  app.patch("/api/leads/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !["new", "contacted", "quoted", "confirmed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedLead = await storage.updateLeadStatus(id, status);
      if (!updatedLead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead status:", error);
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

  // Protected routes - Get all contacts (dashboard only)
  app.get("/api/contacts", isAuthenticated, async (req, res) => {
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

  app.patch("/api/employees/:id/role", isAuthenticated, requireBusinessOwner, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role || !["business_owner", "employee"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
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
      
      // Check if lead exists and is available
      const existingLead = await storage.getLead(id);
      if (!existingLead) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (existingLead.assignedToUserId) {
        return res.status(400).json({ error: "Job already assigned to another employee" });
      }

      const updatedLead = await storage.assignLeadToEmployee(id, employeeId);
      if (!updatedLead) {
        return res.status(500).json({ error: "Failed to assign job" });
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error accepting job:", error);
      res.status(500).json({ error: "Failed to accept job" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
