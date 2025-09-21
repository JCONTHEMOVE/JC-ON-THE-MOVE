import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertContactSchema } from "@shared/schema";
import { sendEmail, generateLeadNotificationEmail, generateContactNotificationEmail } from "./services/email";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Submit quote request
  app.post("/api/leads", async (req, res) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(leadData);
      
      // Send email notification
      const emailContent = generateLeadNotificationEmail(lead);
      const companyEmail = process.env.COMPANY_EMAIL || "info@jconthemove.com";
      
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

  // Get all leads
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Update lead status
  app.patch("/api/leads/:id/status", async (req, res) => {
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
      const companyEmail = process.env.COMPANY_EMAIL || "info@jconthemove.com";
      
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

  // Get all contacts
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
