export type JobPayoutSplit = {
  laborPool: number;
  ownerAdmin: number;
  companyProfit: number;
  referralPool: number;
  equipmentPool: number;
  mealCultureFund: number;
  reserveFund: number;
};

export const DEFAULT_JOB_PAYOUT_SPLIT: JobPayoutSplit = {
  laborPool: 0.45,
  ownerAdmin: 0.10,
  companyProfit: 0.27,
  referralPool: 0.05,
  equipmentPool: 0.08,
  mealCultureFund: 0.03,
  reserveFund: 0.02,
};

export type WorkerPayoutProfile = {
  key: string;
  name: string;
  minRate: number;
  maxRate: number;
  baseWeight: number;
  roles: string[];
  aliases: string[];
};

export type JobPayoutRolePayment = {
  type: "owner_admin" | "referral" | "equipment";
  recipientId: string | null;
  recipientName: string;
  amount: number;
  reason: string;
};

export type JobPayoutWorker = {
  workerId: string;
  name: string;
  hoursWorked: number;
  minRate: number;
  maxRate: number;
  weight: number;
  roles: string[];
  weightedPay: number;
  minimumPay: number;
  topUpApplied: number;
  finalLaborPay: number;
  effectiveHourly: number;
  maxRateExceeded: boolean;
  additionalPayouts: JobPayoutRolePayment[];
  totalTakeHome: number;
};

export type JobPayoutPreview = {
  jobId: string;
  jobTotal: number;
  serviceType: string;
  confirmedHours: number;
  crewCount: number;
  split: JobPayoutSplit;
  pools: {
    laborPool: number;
    ownerAdminPool: number;
    companyProfitPool: number;
    referralPool: number;
    equipmentPool: number;
    mealCultureFund: number;
    reserveFund: number;
  };
  topUpFunding: {
    fromCompanyProfit: number;
    fromOwnerAdmin: number;
    fromReserve: number;
    uncovered: number;
  };
  rolePayouts: JobPayoutRolePayment[];
  crewPayouts: JobPayoutWorker[];
  retainedPools: {
    companyProfit: number;
    ownerAdmin: number;
    referralPool: number;
    equipmentPool: number;
    mealCultureFund: number;
    reserveFund: number;
  };
  totals: {
    laborPaid: number;
    rolePaid: number;
    totalTakeHome: number;
    retainedByCompany: number;
  };
  notes: string[];
};

export type ProfitShareRole = "lead_mover" | "mover" | "helper";
export type ProfitSharePayoutStatus = "preview" | "calculated" | "payroll_pending" | "payroll_approved" | "payroll_recorded_paid" | "manual_pending" | "manual_paid" | "stripe_pending" | "stripe_paid" | "failed";

export type ProfitShareSettings = {
  fuelReservePct: number;
  vehicleReservePct: number;
  insuranceReservePct: number;
  processingFeePct: number;
  companyProfitPct: number;
  crewBonusPct: number;
  referralPct: number;
  growthFundPct: number;
  leadMoverHourlyRate: number;
  moverHourlyRate: number;
  helperHourlyRate: number;
  driverHourlyPremium: number;
  leadMoverBonusWeight: number;
  moverBonusWeight: number;
  helperBonusWeight: number;
  silverAuthorityBonusPct: number;
  goldAuthorityBonusPct: number;
  payrollTimezone: string;
  rewardPointsPerDollarEarned: number;
};

export const DEFAULT_PROFIT_SHARE_SETTINGS: ProfitShareSettings = {
  fuelReservePct: 0.05,
  vehicleReservePct: 0.05,
  insuranceReservePct: 0.025,
  processingFeePct: 0.03,
  companyProfitPct: 0.7,
  crewBonusPct: 0.2,
  referralPct: 0.05,
  growthFundPct: 0.05,
  leadMoverHourlyRate: 30,
  moverHourlyRate: 25,
  helperHourlyRate: 20,
  driverHourlyPremium: 5,
  leadMoverBonusWeight: 1.5,
  moverBonusWeight: 1,
  helperBonusWeight: 0.75,
  silverAuthorityBonusPct: 0.05,
  goldAuthorityBonusPct: 0.1,
  payrollTimezone: "America/Chicago",
  // Kept for historical snapshots only. Paid-completion JCMOVES are issued
  // exclusively by the job JCMOVES ledger, never by cash payroll.
  rewardPointsPerDollarEarned: 0,
};

export type ProfitShareWorkerInput = {
  assignmentId?: string | null;
  workerId: string;
  workerName: string;
  roleOnJob: ProfitShareRole;
  hourlyRate: number;
  hoursWorked: number;
  bonusWeight: number;
  bonusWeightOverrideReason?: string | null;
  isDriverForJob?: boolean;
  driverHourlyPremium?: number;
  authorityTier?: string | null;
  stripeAccountId?: string | null;
};

export type ProfitShareJobInput = {
  jobId: string;
  customerName: string;
  jobType: string;
  status: string;
  grossRevenue: number;
  dumpFees: number;
  otherExpenses: number;
  referralPartnerId?: string | null;
  referralPartnerName?: string | null;
  workers: ProfitShareWorkerInput[];
  settings: ProfitShareSettings;
};

export type ProfitShareWorkerPayout = ProfitShareWorkerInput & {
  classificationPay: number;
  hourlyPay: number;
  driverPremiumPay: number;
  crewBonusPay: number;
  authorityBonusPct: number;
  authorityBonusPay: number;
  bonusPay: number;
  totalPay: number;
  jobRevenueSharePct: number;
  jcmovesRewardAmount: number;
};

export type ProfitSharePayoutPreview = {
  jobId: string;
  customerName: string;
  jobType: string;
  status: string;
  grossRevenue: number;
  guaranteedLaborTotal: number;
  driverPremiumTotal: number;
  authorityBonusTotal: number;
  fuelReserve: number;
  vehicleReserve: number;
  insuranceReserve: number;
  processingFees: number;
  dumpFees: number;
  otherExpenses: number;
  totalExpensesAndReserves: number;
  netJobProfit: number;
  companyProfit: number;
  crewBonusPool: number;
  referralPayout: number;
  growthFund: number;
  totalLaborHours: number;
  profitMarginPct: number;
  profitPerLaborHour: number;
  referralPartnerId: string | null;
  referralPartnerName: string | null;
  adminOverrideRequired: boolean;
  workerPayouts: ProfitShareWorkerPayout[];
  notes: string[];
  settingsSnapshot: ProfitShareSettings;
};
