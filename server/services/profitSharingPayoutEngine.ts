import {
  DEFAULT_PROFIT_SHARE_SETTINGS,
  type ProfitShareJobInput,
  type ProfitSharePayoutPreview,
  type ProfitShareRole,
  type ProfitShareSettings,
} from "@shared/jobPayout";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeProfitShareSettings(settings?: Partial<ProfitShareSettings> | null): ProfitShareSettings {
  return {
    ...DEFAULT_PROFIT_SHARE_SETTINGS,
    ...(settings || {}),
  };
}

export function defaultHourlyRateForRole(role: ProfitShareRole, settings: ProfitShareSettings): number {
  if (role === "lead_mover") return settings.leadMoverHourlyRate;
  if (role === "helper") return settings.helperHourlyRate;
  return settings.moverHourlyRate;
}

export function defaultBonusWeightForRole(role: ProfitShareRole, settings: ProfitShareSettings): number {
  if (role === "lead_mover") return settings.leadMoverBonusWeight;
  if (role === "helper") return settings.helperBonusWeight;
  return settings.moverBonusWeight;
}

export function defaultBonusWeightsForCrew(roles: ProfitShareRole[]): number[] {
  return roles.map((role) => {
    if (role === "lead_mover") return DEFAULT_PROFIT_SHARE_SETTINGS.leadMoverBonusWeight;
    if (role === "helper") return DEFAULT_PROFIT_SHARE_SETTINGS.helperBonusWeight;
    return DEFAULT_PROFIT_SHARE_SETTINGS.moverBonusWeight;
  });
}

export function authorityBonusPctForTier(tier: unknown, settings: ProfitShareSettings): number {
  const normalized = String(tier || "worker").trim().toLowerCase();
  if (normalized === "silver") return Math.max(0, settings.silverAuthorityBonusPct);
  if (normalized === "gold" || normalized === "platinum") return Math.max(0, settings.goldAuthorityBonusPct);
  return 0;
}

export function calculateProfitSharingPayout(input: ProfitShareJobInput): ProfitSharePayoutPreview {
  const settings = normalizeProfitShareSettings(input.settings);
  const grossRevenue = roundMoney(Math.max(0, asFiniteNumber(input.grossRevenue)));
  const dumpFees = roundMoney(Math.max(0, asFiniteNumber(input.dumpFees)));
  const otherExpenses = roundMoney(Math.max(0, asFiniteNumber(input.otherExpenses)));

  const workers = input.workers.map((worker) => ({
    ...worker,
    hourlyRate: roundMoney(Math.max(0, asFiniteNumber(worker.hourlyRate, defaultHourlyRateForRole(worker.roleOnJob, settings)))),
    hoursWorked: roundMoney(Math.max(0, asFiniteNumber(worker.hoursWorked))),
    bonusWeight: Math.max(0, asFiniteNumber(worker.bonusWeight)),
    isDriverForJob: worker.isDriverForJob === true,
    driverHourlyPremium: roundMoney(Math.max(0, asFiniteNumber(worker.driverHourlyPremium, settings.driverHourlyPremium))),
    authorityTier: String(worker.authorityTier || "worker").toLowerCase(),
  }));

  const workerGuaranteed = workers.map((worker) => {
    const classificationPay = roundMoney(worker.hourlyRate * worker.hoursWorked);
    const driverPremiumPay = worker.isDriverForJob
      ? roundMoney(worker.driverHourlyPremium * worker.hoursWorked)
      : 0;
    return { classificationPay, driverPremiumPay };
  });
  const driverPremiumTotal = roundMoney(workerGuaranteed.reduce((sum, pay) => sum + pay.driverPremiumPay, 0));
  const guaranteedLaborTotal = roundMoney(
    workerGuaranteed.reduce((sum, pay) => sum + pay.classificationPay + pay.driverPremiumPay, 0),
  );
  const totalLaborHours = roundMoney(workers.reduce((sum, worker) => sum + worker.hoursWorked, 0));

  const fuelReserve = roundMoney(grossRevenue * settings.fuelReservePct);
  const vehicleReserve = roundMoney(grossRevenue * settings.vehicleReservePct);
  const insuranceReserve = roundMoney(grossRevenue * settings.insuranceReservePct);
  const processingFees = roundMoney(grossRevenue * settings.processingFeePct);
  const totalExpensesAndReserves = roundMoney(
    fuelReserve + vehicleReserve + insuranceReserve + processingFees + dumpFees + otherExpenses,
  );
  const netJobProfit = roundMoney(grossRevenue - guaranteedLaborTotal - totalExpensesAndReserves);
  const positiveProfit = Math.max(0, netJobProfit);
  const hasReferral = !!input.referralPartnerId;

  const referralPayout = hasReferral ? roundMoney(positiveProfit * settings.referralPct) : 0;
  const growthFund = roundMoney(positiveProfit * settings.growthFundPct);
  const crewBonusPool = roundMoney(positiveProfit * settings.crewBonusPct);
  const companyReferralFallback = hasReferral ? 0 : roundMoney(positiveProfit * settings.referralPct);
  const companyProfitBeforeAuthorityBonus = roundMoney(
    netJobProfit < 0
      ? netJobProfit
      : positiveProfit * settings.companyProfitPct + companyReferralFallback,
  );

  const totalBonusWeight = workers.reduce((sum, worker) => sum + worker.bonusWeight, 0);
  const rawAuthorityBonuses = workers.map((worker, index) => {
    const authorityBonusPct = authorityBonusPctForTier(worker.authorityTier, settings);
    const base = workerGuaranteed[index].classificationPay + workerGuaranteed[index].driverPremiumPay;
    return {
      authorityBonusPct,
      amount: roundMoney(base * authorityBonusPct),
    };
  });
  const rawAuthorityBonusTotal = roundMoney(rawAuthorityBonuses.reduce((sum, item) => sum + item.amount, 0));
  const authorityBonusBudget = Math.max(0, companyProfitBeforeAuthorityBonus);
  const authorityScale = rawAuthorityBonusTotal > authorityBonusBudget && rawAuthorityBonusTotal > 0
    ? authorityBonusBudget / rawAuthorityBonusTotal
    : 1;
  const authorityBonusTotal = roundMoney(Math.min(rawAuthorityBonusTotal, authorityBonusBudget));
  const companyProfit = roundMoney(companyProfitBeforeAuthorityBonus - authorityBonusTotal);

  const workerPayouts = workers.map((worker, index) => {
    const classificationPay = workerGuaranteed[index].classificationPay;
    const hourlyPay = classificationPay;
    const driverPremiumPay = workerGuaranteed[index].driverPremiumPay;
    const crewBonusPay = totalBonusWeight > 0 ? roundMoney(crewBonusPool * (worker.bonusWeight / totalBonusWeight)) : 0;
    const authorityBonusPct = rawAuthorityBonuses[index].authorityBonusPct;
    const authorityBonusPay = roundMoney(rawAuthorityBonuses[index].amount * authorityScale);
    const bonusPay = roundMoney(crewBonusPay + authorityBonusPay);
    const totalPay = roundMoney(classificationPay + driverPremiumPay + bonusPay);
    return {
      ...worker,
      classificationPay,
      hourlyPay,
      driverPremiumPay,
      crewBonusPay,
      authorityBonusPct,
      authorityBonusPay,
      bonusPay,
      totalPay,
      jobRevenueSharePct: grossRevenue > 0 ? roundRatio(totalPay / grossRevenue) : 0,
      jcmovesRewardAmount: 0,
    };
  });

  const notes: string[] = [];
  if (!hasReferral && positiveProfit > 0) {
    notes.push("No referral partner is attached; referral share rolls into company profit.");
  }
  if (netJobProfit <= 0) {
    notes.push("Net job profit is zero or negative; final non-hourly payouts require admin override.");
  }
  if (totalBonusWeight <= 0 && crewBonusPool > 0) {
    notes.push("The quarterly profit bonus pool is available but no crew bonus weights are assigned.");
  }
  if (authorityScale < 1) {
    notes.push("Authority bonuses were prorated to avoid exceeding the remaining positive company profit.");
  }

  return {
    jobId: input.jobId,
    customerName: input.customerName,
    jobType: input.jobType,
    status: input.status,
    grossRevenue,
    guaranteedLaborTotal,
    driverPremiumTotal,
    authorityBonusTotal,
    fuelReserve,
    vehicleReserve,
    insuranceReserve,
    processingFees,
    dumpFees,
    otherExpenses,
    totalExpensesAndReserves,
    netJobProfit,
    companyProfit,
    crewBonusPool,
    referralPayout,
    growthFund,
    totalLaborHours,
    profitMarginPct: grossRevenue > 0 ? roundRatio(netJobProfit / grossRevenue) : 0,
    profitPerLaborHour: totalLaborHours > 0 ? roundMoney(netJobProfit / totalLaborHours) : 0,
    referralPartnerId: input.referralPartnerId || null,
    referralPartnerName: input.referralPartnerName || null,
    adminOverrideRequired: netJobProfit <= 0,
    workerPayouts,
    notes,
    settingsSnapshot: settings,
  };
}
