import { type User, type InsertUser, type UpsertUser, type Lead, type InsertLead, type Contact, type InsertContact, leads, contacts, users, walletAccounts, rewards } from "@shared/schema";
import { db } from "./db";
import { eq, desc, isNull, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if this is a new user (first time registration)
    const existingUser = userData.id ? await this.getUser(userData.id) : null;
    const isNewUser = !existingUser;

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    // If this is a new user, give them 1 JCMOVE token as signup bonus
    if (isNewUser) {
      try {
        // Create wallet account for new user
        await db.insert(walletAccounts).values({
          userId: user.id,
          tokenBalance: '1.0', // 1 JCMOVE signup bonus
          totalEarned: '1.0'
        });

        // Create reward record for signup bonus
        await db.insert(rewards).values({
          userId: user.id,
          rewardType: 'signup_bonus',
          tokenAmount: '1.0',
          cashValue: '0.001', // 1 token * $0.001 price
          status: 'earned',
          metadata: { signupBonus: true, automaticReward: true }
        });

        console.log(`New user registered: ${user.email || user.id} - Awarded 1 JCMOVE signup bonus`);
      } catch (error) {
        console.error(`Failed to create signup bonus for user ${user.id}:`, error);
        // Don't fail the user creation if bonus fails - user is already created
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
}

export const storage = new DatabaseStorage();
