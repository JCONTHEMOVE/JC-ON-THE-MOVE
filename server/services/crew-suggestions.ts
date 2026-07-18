import { db } from "../db";
import { leads, users, reviews, workerDayBlocks, workerSchedule, workerHourOverrides } from "@shared/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";

export interface EmployeeWithStats {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  activeJobsCount: number;
  completedJobsCount: number;
  averageRating: number;
  totalReviews: number;
  isApproved: boolean;
}

export interface CrewSuggestion {
  employee: EmployeeWithStats;
  score: number;
  reason: string;
  isAvailable: boolean;
}

export interface CrewAssignmentSuggestion {
  jobId: string;
  jobType: string;
  crewSize: number;
  suggestions: CrewSuggestion[];
  recommendedCrew: CrewSuggestion[];
}

class CrewSuggestionService {
  /**
   * Get all employees with their current workload and performance stats
   */
  async getEmployeesWithStats(): Promise<EmployeeWithStats[]> {
    // Get all approved employees
    const employees = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isApproved: users.isApproved,
      })
      .from(users)
      .where(and(
        or(
          eq(users.role, 'employee'),
          and(
            inArray(users.role, ['admin', 'business_owner']),
            sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
          ),
        ),
        eq(users.isApproved, true)
      ));

    // Get stats for each employee
    const employeesWithStats: EmployeeWithStats[] = await Promise.all(
      employees.map(async (employee) => {
        // Count active jobs (jobs where employee is in crewMembers array)
        const activeJobs = await db
          .select({ count: sql<number>`count(*)` })
          .from(leads)
          .where(
            and(
              sql`${employee.id} = ANY(${leads.crewMembers})`,
              inArray(leads.status, ['confirmed', 'accepted', 'in_progress'])
            )
          );

        // Count completed jobs
        const completedJobs = await db
          .select({ count: sql<number>`count(*)` })
          .from(leads)
          .where(
            and(
              sql`${employee.id} = ANY(${leads.crewMembers})`,
              eq(leads.status, 'completed')
            )
          );

        // Get review statistics
        const reviewStats = await db
          .select({
            avgRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
            totalReviews: sql<number>`COUNT(*)`,
          })
          .from(reviews)
          .where(eq(reviews.employeeId, employee.id));

        return {
          id: employee.id,
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          email: employee.email || '',
          activeJobsCount: Number(activeJobs[0]?.count || 0),
          completedJobsCount: Number(completedJobs[0]?.count || 0),
          averageRating: Number(reviewStats[0]?.avgRating || 0),
          totalReviews: Number(reviewStats[0]?.totalReviews || 0),
          isApproved: employee.isApproved,
        };
      })
    );

    return employeesWithStats;
  }

  /**
   * Calculate a suggestion score for an employee based on job requirements
   */
  calculateEmployeeScore(
    employee: EmployeeWithStats,
    jobType: string,
    hasSpecialItems: boolean
  ): { score: number; reason: string } {
    let score = 100;
    const reasons: string[] = [];

    // Factor 1: Workload balance (prefer employees with fewer active jobs)
    // Penalty: -15 points per active job
    const workloadPenalty = employee.activeJobsCount * 15;
    score -= workloadPenalty;
    if (employee.activeJobsCount === 0) {
      reasons.push("Available");
    } else if (employee.activeJobsCount === 1) {
      reasons.push("1 active job");
    } else {
      reasons.push(`${employee.activeJobsCount} active jobs`);
    }

    // Factor 2: Performance rating (bonus for high ratings)
    // Bonus: +20 points for 5-star average, scaled down for lower ratings
    if (employee.totalReviews > 0) {
      const ratingBonus = (employee.averageRating / 5) * 20;
      score += ratingBonus;
      reasons.push(`${employee.averageRating.toFixed(1)}★ rating`);
    }

    // Factor 3: Experience (bonus for completed jobs)
    // Bonus: +2 points per completed job, capped at +30
    const experienceBonus = Math.min(employee.completedJobsCount * 2, 30);
    score += experienceBonus;
    if (employee.completedJobsCount > 0) {
      reasons.push(`${employee.completedJobsCount} jobs completed`);
    } else {
      reasons.push("New employee");
    }

    // Factor 4: Special items handling (bonus for experienced employees)
    if (hasSpecialItems && employee.completedJobsCount >= 5) {
      score += 10;
      reasons.push("Experienced with special items");
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    return {
      score: Math.round(score),
      reason: reasons.join(" • "),
    };
  }

  /**
   * Check if a worker is available on a specific date string (YYYY-MM-DD).
   * Returns an object with available flag and optional reason.
   */
  async checkWorkerAvailabilityOnDate(userId: string, dateStr: string): Promise<{ available: boolean; reason?: string }> {
    const results = await this.batchCheckAvailability([userId], dateStr);
    return results.get(userId) ?? { available: true };
  }

  /**
   * Batch-check availability for multiple employees on the same date.
   * Uses 3 queries total regardless of employee count (eliminates N+1).
   * Returns a Map<userId, { available, reason? }>.
   */
  async batchCheckAvailability(
    userIds: string[],
    dateStr: string
  ): Promise<Map<string, { available: boolean; reason?: string }>> {
    if (userIds.length === 0) return new Map();
    const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();

    const [allBlocks, allSchedules, allOverrides] = await Promise.all([
      db.select().from(workerDayBlocks).where(
        and(inArray(workerDayBlocks.userId, userIds), eq(workerDayBlocks.date, dateStr))
      ),
      db.select().from(workerSchedule).where(
        and(inArray(workerSchedule.userId, userIds), eq(workerSchedule.dayOfWeek, dayOfWeek))
      ),
      db.select().from(workerHourOverrides).where(
        and(inArray(workerHourOverrides.userId, userIds), eq(workerHourOverrides.date, dateStr))
      ),
    ]);

    const blocksByUser = new Map(allBlocks.map(b => [b.userId, b]));
    const schedByUser = new Map(allSchedules.map(s => [s.userId, s]));
    const overrideByUser = new Map(allOverrides.map(o => [o.userId, o]));

    const result = new Map<string, { available: boolean; reason?: string }>();
    for (const uid of userIds) {
      const block = blocksByUser.get(uid);
      if (block) {
        result.set(uid, { available: false, reason: `Blocked: ${block.reason || "day off"}` });
        continue;
      }
      const override = overrideByUser.get(uid);
      if (override) {
        result.set(uid, { available: true, reason: `Custom hours ${override.startHour}–${override.endHour}` });
        continue;
      }
      const sched = schedByUser.get(uid);
      if (sched && !sched.isAvailable) {
        result.set(uid, { available: false, reason: "Not available this day of week" });
        continue;
      }
      result.set(uid, { available: true });
    }
    return result;
  }

  /**
   * Generate crew assignment suggestions for a job
   */
  async suggestCrewForJob(jobId: string): Promise<CrewAssignmentSuggestion | null> {
    // Get the job details
    const [job] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, jobId));

    if (!job) {
      return null;
    }

    // Determine if job has special items requiring extra care
    const hasSpecialItems = !!(
      job.hasHotTub ||
      job.hasHeavySafe ||
      job.hasPoolTable ||
      job.hasPiano
    );

    // Get the job date for availability checking
    const jobDate = job.confirmedDate || job.moveDate;

    // Get all employees with their stats
    const employees = await this.getEmployeesWithStats();

    // Batch-fetch availability for all employees in 3 queries (not N+1)
    const availabilityMap = jobDate
      ? await this.batchCheckAvailability(employees.map(e => e.id), jobDate)
      : new Map<string, { available: boolean; reason?: string }>();

    // Calculate scores for each employee
    const suggestions: CrewSuggestion[] = employees.map((employee) => {
      const { score, reason: baseReason } = this.calculateEmployeeScore(
        employee,
        job.serviceType || 'residential',
        hasSpecialItems
      );

      const avail = availabilityMap.get(employee.id) ?? { available: true };
      let reason = baseReason;
      let isAvailable = avail.available;

      if (!avail.available) {
        reason = `Unavailable on ${jobDate}` + (avail.reason ? ` (${avail.reason})` : "");
      } else if (avail.reason) {
        reason += ` • ${avail.reason}`;
      }

      return { employee, score, reason, isAvailable };
    });

    // Sort by score (highest first), unavailable workers sink to the bottom
    suggestions.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      return b.score - a.score;
    });

    // Select top available employees for recommended crew based on crew size
    const crewSize = job.crewSize || 2;
    const availableSuggestions = suggestions.filter(s => s.isAvailable);
    const recommendedCrew = availableSuggestions.slice(0, crewSize);

    return {
      jobId: job.id,
      jobType: job.serviceType || 'Unknown',
      crewSize,
      suggestions,
      recommendedCrew,
    };
  }

  /**
   * Get suggestions for multiple jobs
   */
  async suggestCrewForMultipleJobs(jobIds: string[]): Promise<CrewAssignmentSuggestion[]> {
    const suggestions = await Promise.all(
      jobIds.map((jobId) => this.suggestCrewForJob(jobId))
    );

    return suggestions.filter((s): s is CrewAssignmentSuggestion => s !== null);
  }
}

export const crewSuggestionService = new CrewSuggestionService();
