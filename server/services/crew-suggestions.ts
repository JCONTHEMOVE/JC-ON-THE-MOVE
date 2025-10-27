import { db } from "../db";
import { leads, users, reviews } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

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
        eq(users.role, 'employee'),
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

    // Get all employees with their stats
    const employees = await this.getEmployeesWithStats();

    // Calculate scores for each employee
    const suggestions: CrewSuggestion[] = employees.map((employee) => {
      const { score, reason } = this.calculateEmployeeScore(
        employee,
        job.serviceType || 'residential',
        hasSpecialItems
      );

      return {
        employee,
        score,
        reason,
      };
    });

    // Sort by score (highest first)
    suggestions.sort((a, b) => b.score - a.score);

    // Select top employees for recommended crew based on crew size
    const crewSize = job.crewSize || 2;
    const recommendedCrew = suggestions.slice(0, crewSize);

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
