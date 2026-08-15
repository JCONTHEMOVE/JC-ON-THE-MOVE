import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Coins, Download, Loader2, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DailyCashSplit } from "@/components/daily-cash-split";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import type { ProfitSharePayoutPreview, ProfitSharePayoutStatus, ProfitShareRole } from "@shared/jobPayout";

type AdminWorkerPayout = {
  id: string;
  workerId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  roleOnJob: ProfitShareRole;
  hoursWorked: string;
  hourlyPay: string;
  hourlyRate: string;
  driverPremiumPay: string;
  crewBonusPay: string;
  authorityBonusPct: string;
  authorityBonusPay: string;
  jobRevenueSharePct: string;
  authorityTierSnapshot?: string | null;
  bonusPay: string;
  totalPay: string;
  payoutStatus: ProfitSharePayoutStatus;
  stripeTransferId?: string | null;
  jcmovesRewardAmount: string;
  rewardsIssuedAt?: string | null;
};

type PayoutJob = {
  id: string;
  orderNumber?: number | string | null;
  firstName: string;
  lastName: string;
  serviceType: string;
  status: string;
  totalPrice?: string | null;
  basePrice?: string | null;
  confirmedHours?: number | null;
  paymentPlan?: string | null;
  paymentPaidAt?: string | null;
  recognizedRevenueUsd?: number | null;
  refundedRevenueUsd?: number | null;
  payout?: {
    id: string;
    status: string;
    netJobProfit: string;
    profitPerLaborHour: string;
    workerPayouts?: AdminWorkerPayout[];
  } | null;
};

type ReferralPartner = {
  id: string;
  name: string;
  isActive: boolean;
};

type Settings = Record<string, string | number | boolean | null>;

type AssignmentDraft = {
  workerId: string;
  roleOnJob: ProfitShareRole;
  hourlyRate: number;
  hoursWorked: number;
  bonusWeight: number;
  bonusWeightOverrideReason?: string | null;
  isDriverForJob: boolean;
};

const ROLE_LABELS: Record<ProfitShareRole, string> = {
  lead_mover: "Lead Mover",
  mover: "Mover",
  helper: "Helper",
};

const roleOptions: ProfitShareRole[] = ["lead_mover", "mover", "helper"];

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function percent(value: unknown) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return `${(n * 100).toFixed(1)}%`;
}

function numberValue(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function employeeName(user: User) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Worker";
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminJobPayoutsPage() {
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [grossRevenue, setGrossRevenue] = useState<number | null>(null);
  const [dumpFees, setDumpFees] = useState<number>(0);
  const [otherExpenses, setOtherExpenses] = useState<number>(0);
  const [referralPartnerId, setReferralPartnerId] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState("");
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);

  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/admin/job-payouts/settings"] });
  const { data: jobs = [] } = useQuery<PayoutJob[]>({ queryKey: ["/api/admin/job-payouts/jobs"] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: referralPartners = [] } = useQuery<ReferralPartner[]>({ queryKey: ["/api/admin/job-payouts/referral-partners"] });

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || null;
  const selectedJobCompleted = ["completed", "customer_approved", "payout_calculated", "payout_sent", "closed"].includes(String(selectedJob?.status || "").toLowerCase());
  const selectedJobCanFinalize = Boolean(selectedJobCompleted && selectedJob?.paymentPaidAt && !selectedJob?.payout);

  const previewBody = {
    ...(grossRevenue !== null ? { grossRevenue } : {}),
    dumpFees,
    otherExpenses,
    referralPartnerId: referralPartnerId || null,
  };

  const previewQueryKey = selectedJobId
    ? ["/api/admin/job-payouts/jobs", selectedJobId, "preview", previewBody]
    : ["/api/admin/job-payouts/idle"];

  const { data: preview, isFetching: previewLoading } = useQuery<ProfitSharePayoutPreview>({
    queryKey: previewQueryKey,
    enabled: !!selectedJobId,
    queryFn: async () => {
      const res = await apiRequest("POST", `/api/admin/job-payouts/jobs/${selectedJobId}/preview`, previewBody);
      return res.json();
    },
  });

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) =>
      `${job.firstName} ${job.lastName} ${job.serviceType} ${job.status}`.toLowerCase().includes(q),
    );
  }, [jobs, search]);

  const payoutQueueSummary = useMemo(() => {
    const finalized = jobs.filter((job) => !!job.payout);
    const totalNetProfit = finalized.reduce((sum, job) => sum + numberValue(job.payout?.netJobProfit), 0);
    const averageProfitPerLaborHour = finalized.length
      ? finalized.reduce((sum, job) => sum + numberValue(job.payout?.profitPerLaborHour), 0) / finalized.length
      : 0;
    const customerApprovedAwaitingPayout = jobs.filter((job) => ["completed", "customer_approved", "closed"].includes(job.status) && job.paymentPaidAt && !job.payout).length;
    const manualPendingWorkers = finalized.reduce(
      (sum, job) => sum + (job.payout?.workerPayouts || []).filter((payout) => payout.payoutStatus === "payroll_pending").length,
      0,
    );
    return {
      finalizedCount: finalized.length,
      totalNetProfit,
      averageProfitPerLaborHour,
      customerApprovedAwaitingPayout,
      manualPendingWorkers,
    };
  }, [jobs]);

  const exportVisibleJobsReport = () => {
    const rows = [
      [
        "Order Number",
        "Customer",
        "Service",
        "Job Status",
        "Gross Revenue",
        "Payout Status",
        "Net Job Profit",
        "Profit Per Labor Hour",
        "Worker Payout Records",
        "Manual Paid",
        "Manual Pending",
        "Stripe Pending",
        "Stripe Paid",
        "Failed",
      ],
      ...filteredJobs.map((job) => {
        const payouts = job.payout?.workerPayouts || [];
        const countByStatus = (status: ProfitSharePayoutStatus) => payouts.filter((payout) => payout.payoutStatus === status).length;
        return [
          job.orderNumber || "",
          `${job.firstName} ${job.lastName}`.trim(),
          job.serviceType.replace(/_/g, " "),
          job.status.replace(/_/g, " "),
          numberValue(job.totalPrice || job.basePrice).toFixed(2),
          job.payout?.status || "not finalized",
          job.payout?.netJobProfit || "",
          job.payout?.profitPerLaborHour || "",
          payouts.length,
          countByStatus("manual_paid"),
          countByStatus("manual_pending"),
          countByStatus("stripe_pending"),
          countByStatus("stripe_paid"),
          countByStatus("failed"),
        ];
      }),
    ];
    downloadCsv(`jc-payout-queue-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const seedAssignmentsFromPreview = () => {
    if (!preview) return;
    setAssignments(preview.workerPayouts.map((worker) => ({
      workerId: worker.workerId,
      roleOnJob: worker.roleOnJob,
      hourlyRate: worker.hourlyRate,
      hoursWorked: worker.hoursWorked,
      bonusWeight: worker.bonusWeight,
      bonusWeightOverrideReason: worker.bonusWeightOverrideReason || null,
      isDriverForJob: worker.isDriverForJob === true,
    })));
  };

  const settingsMutation = useMutation({
    mutationFn: async (updates: Record<string, number>) => {
      const res = await apiRequest("PATCH", "/api/admin/job-payouts/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-payouts/settings"] });
      queryClient.invalidateQueries({ queryKey: previewQueryKey });
      toast({ title: "Payout settings saved" });
    },
    onError: (error: Error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });

  const assignmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/job-payouts/jobs/${selectedJobId}/assignments`, {
        ...previewBody,
        assignments,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: previewQueryKey });
      toast({ title: "Assignments saved" });
    },
    onError: (error: Error) => toast({ title: "Save failed", description: error.message, variant: "destructive" }),
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/job-payouts/jobs/${selectedJobId}/finalize`, {
        ...previewBody,
        adminOverrideReason: overrideReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-payouts/jobs"] });
      queryClient.invalidateQueries({ queryKey: previewQueryKey });
      toast({ title: "Payout finalized", description: "Worker payout records are now pending manual payment." });
    },
    onError: (error: Error) => toast({ title: "Finalize blocked", description: error.message, variant: "destructive" }),
  });

  const actualHoursMutation = useMutation({
    mutationFn: async () => {
      const source = assignments.length ? assignments : preview?.workerPayouts || [];
      const res = await apiRequest("PATCH", `/api/admin/job-payouts/jobs/${selectedJobId}/actual-hours`, {
        assignments: source.map((worker) => ({ workerId: worker.workerId, actualHours: worker.hoursWorked })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: previewQueryKey });
      toast({ title: "Actual hours approved", description: "The approval is timestamped and ready for final earnings." });
    },
    onError: (error: Error) => toast({ title: "Hours approval blocked", description: error.message, variant: "destructive" }),
  });

  const defaultHours = selectedJob?.confirmedHours || 4;
  const finalizedWorkerPayouts = selectedJob?.payout?.workerPayouts || [];

  const exportPayoutReport = () => {
    if (!preview || !selectedJob) return;
    const rows = [
      ["Job", `${selectedJob.firstName} ${selectedJob.lastName}`],
      ["Order Number", selectedJob.orderNumber || ""],
      ["Status", selectedJob.status],
      ["Payout Gate", selectedJobCanFinalize ? "Completed, paid, and finalizable" : "Preview only - complete payment/hours requirements first"],
      ["Existing Payout Status", selectedJob.payout?.status || "not finalized"],
      ["Gross Revenue", preview.grossRevenue],
      ["Guaranteed Labor", preview.guaranteedLaborTotal],
      ["Total Labor Hours", preview.totalLaborHours],
      ["Total Expenses And Reserves", preview.totalExpensesAndReserves],
      ["Net Job Profit", preview.netJobProfit],
      ["Profit Per Labor Hour", preview.profitPerLaborHour],
      ["Company Profit", preview.companyProfit],
      ["Quarterly Profit Bonus Pool", preview.crewBonusPool],
      ["Referral Payout", preview.referralPayout],
      ["Growth Fund", preview.growthFund],
      ["Admin Override Required", preview.adminOverrideRequired ? "yes" : "no"],
      ["Referral Partner", preview.referralPartnerName || ""],
      [],
      ["Worker", "Role", "Hours", "Classification Pay", "Driver Premium", "Quarterly Profit Bonus", "Authority Bonus", "Total Pay", "Revenue Share", "Payroll Status"],
      ...preview.workerPayouts.map((payout) => {
        const employee = employees.find((item) => item.id === payout.workerId);
        const finalizedPayout = finalizedWorkerPayouts.find((item) => item.workerId === payout.workerId);
        return [
          employee ? employeeName(employee) : payout.workerId,
          ROLE_LABELS[payout.roleOnJob],
          payout.hoursWorked,
          payout.hourlyPay,
          payout.driverPremiumPay,
          payout.crewBonusPay,
          payout.authorityBonusPay,
          payout.totalPay,
          percent(payout.jobRevenueSharePct),
          finalizedPayout?.payoutStatus || "",
        ];
      }),
    ];
    downloadCsv(`jc-job-payout-${selectedJob.id}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
        <p className="text-xs font-black uppercase tracking-widest text-blue-300">Business cockpit</p>
        <h2 className="mt-1 text-xl font-black text-white">Profit per labor hour is the main score.</h2>
        <p className="mt-1 text-sm text-slate-300">
          Preview the unified calculation anytime. Final earnings require a completed job, confirmed customer payment, and admin-approved actual hours.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Payout reports" value={String(payoutQueueSummary.finalizedCount)} />
        <Metric label="Net profit tracked" value={money(payoutQueueSummary.totalNetProfit)} accent={payoutQueueSummary.totalNetProfit >= 0 ? "green" : "red"} />
        <Metric label="Avg profit / labor hour" value={money(payoutQueueSummary.averageProfitPerLaborHour)} accent="blue" />
        <Metric label="Paid jobs awaiting finalization" value={String(payoutQueueSummary.customerApprovedAwaitingPayout)} />
        <Metric label="Worker payouts pending" value={String(payoutQueueSummary.manualPendingWorkers)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="bg-slate-900/50 border-slate-700/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-300" /> Jobs
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={exportVisibleJobsReport}
                disabled={filteredJobs.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search jobs" />
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredJobs.map((job) => {
                const selected = job.id === selectedJobId;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => {
                      setSelectedJobId(job.id);
                      setGrossRevenue(job.recognizedRevenueUsd != null
                        ? numberValue(job.recognizedRevenueUsd)
                        : numberValue(job.totalPrice || job.basePrice));
                      setDumpFees(0);
                      setOtherExpenses(0);
                      setReferralPartnerId("");
                      setAssignments([]);
                    }}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${selected ? "border-blue-400 bg-blue-500/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-500"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{job.firstName} {job.lastName}</p>
                        <p className="text-xs text-slate-400 capitalize">{job.serviceType} - {job.status.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-300">
                          {money(job.recognizedRevenueUsd ?? job.totalPrice ?? job.basePrice)}
                        </p>
                        {job.recognizedRevenueUsd != null && (
                          <p className="text-[10px] text-slate-500">BTC collected - quote {money(job.totalPrice || job.basePrice)}</p>
                        )}
                      </div>
                    </div>
                    {job.payout && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Payout {job.payout.status} - P/L hour {money(job.payout.profitPerLaborHour)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-slate-900/50 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-300" /> Payout Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedJob ? (
                <p className="text-sm text-slate-400">Select a job to preview payout math.</p>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Gross revenue</span>
                      <Input type="number" value={grossRevenue ?? ""} onChange={(e) => setGrossRevenue(e.target.value === "" ? null : numberValue(e.target.value))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Dump fees</span>
                      <Input type="number" value={dumpFees} onChange={(e) => setDumpFees(numberValue(e.target.value))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Other expenses</span>
                      <Input type="number" value={otherExpenses} onChange={(e) => setOtherExpenses(numberValue(e.target.value))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-400">Referral partner</span>
                      <select
                        className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                        value={referralPartnerId}
                        onChange={(e) => setReferralPartnerId(e.target.value)}
                      >
                        <option value="">None</option>
                        {referralPartners.filter((p) => p.isActive).map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {selectedJob.paymentPlan === "btc_lightning" && selectedJob.recognizedRevenueUsd != null && (
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      Bitcoin payout math uses the {money(selectedJob.recognizedRevenueUsd)} USD accounting value collected after the 5% customer discount
                      {numberValue(selectedJob.refundedRevenueUsd) > 0 ? ` and ${money(selectedJob.refundedRevenueUsd)} in recorded refunds` : ""}. The original {money(selectedJob.totalPrice || selectedJob.basePrice)} quote remains unchanged.
                    </p>
                  )}

                  {previewLoading || !preview ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Calculating
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Metric label="Gross" value={money(preview.grossRevenue)} />
                        <Metric label="Net job profit" value={money(preview.netJobProfit)} accent={preview.netJobProfit >= 0 ? "green" : "red"} />
                        <Metric label="Profit / labor hour" value={money(preview.profitPerLaborHour)} accent="blue" />
                        <Metric label="Margin" value={percent(preview.profitMarginPct)} />
                        <Metric label="Labor" value={money(preview.guaranteedLaborTotal)} />
                        <Metric label="Reserves/expenses" value={money(preview.totalExpensesAndReserves)} />
                        <Metric label="Quarterly profit bonus pool" value={money(preview.crewBonusPool)} />
                        <Metric label="Driver premiums" value={money(preview.driverPremiumTotal)} />
                        <Metric label="5% / 10% bonuses" value={money(preview.authorityBonusTotal)} />
                        <Metric label="Company profit" value={money(preview.companyProfit)} />
                        <Metric label="Referral" value={money(preview.referralPayout)} />
                        <Metric label="Growth fund" value={money(preview.growthFund)} />
                        <Metric label="Labor hours" value={preview.totalLaborHours.toFixed(2)} />
                        <Metric label="Processing" value={money(preview.processingFees)} />
                      </div>

                      {preview.notes.length > 0 && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                          {preview.notes.join(" ")}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={seedAssignmentsFromPreview}>
                          Load workers
                        </Button>
                        <Button variant="outline" onClick={exportPayoutReport}>
                          <Download className="h-4 w-4 mr-2" />
                          Export CSV
                        </Button>
                        <Button onClick={() => assignmentMutation.mutate()} disabled={!assignments.length || assignmentMutation.isPending}>
                          {assignmentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save workers
                        </Button>
                        {selectedJobCompleted && !selectedJob?.payout && (
                          <Button
                            variant="outline"
                            onClick={() => actualHoursMutation.mutate()}
                            disabled={actualHoursMutation.isPending}
                            className="border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/15"
                          >
                            {actualHoursMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Approve actual hours
                          </Button>
                        )}
                        <Button
                          onClick={() => finalizeMutation.mutate()}
                          disabled={!selectedJobCanFinalize || finalizeMutation.isPending}
                          title={selectedJobCanFinalize ? "Finalize earnings" : "Job must be completed, paid, and have approved actual hours"}
                        >
                          {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Finalize
                        </Button>
                      </div>

                      <div className={`rounded-lg border p-3 text-sm ${selectedJobCanFinalize ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-amber-500/30 bg-amber-500/10 text-amber-100"}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={selectedJobCanFinalize ? "border-emerald-400/50 text-emerald-200" : "border-amber-400/50 text-amber-200"}>
                            {selectedJobCanFinalize ? "Ready to finalize" : "Preview only"}
                          </Badge>
                          <span className="font-semibold">
                            {selectedJobCanFinalize
                              ? "Completed and paid; approve actual hours, then finalize the immutable earnings record."
                              : "Finalize is locked until the job is completed and customer payment is recorded."}
                          </span>
                        </div>
                        {!selectedJobCanFinalize && (
                          <p className="mt-1 text-xs opacity-85">
                            Current status: {selectedJob.status.replace(/_/g, " ")}. Payment: {selectedJob.paymentPaidAt ? "confirmed" : "not confirmed"}. Calculations remain estimates until finalized.
                          </p>
                        )}
                      </div>

                      {preview.adminOverrideRequired && (
                        <label className="block space-y-1">
                          <span className="text-xs text-amber-300">Admin override reason required for zero/loss jobs</span>
                          <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Explain why payout is approved" />
                        </label>
                      )}

                      <WorkerEditor
                        employees={employees}
                        assignments={assignments}
                        setAssignments={setAssignments}
                        defaultHours={defaultHours}
                        preview={preview}
                      />

                      <FinalizedPayoutStatusPanel payouts={finalizedWorkerPayouts} />
                      {selectedJob.payout && <DailyCashSplit jobId={selectedJob.id} />}
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Default Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {settings && (
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["fuelReservePct", "Fuel %"],
                    ["vehicleReservePct", "Vehicle %"],
                    ["insuranceReservePct", "Insurance %"],
                    ["processingFeePct", "Processing %"],
                    ["companyProfitPct", "Company %"],
                    ["crewBonusPct", "Quarterly profit bonus pool %"],
                    ["referralPct", "Referral %"],
                    ["growthFundPct", "Growth %"],
                    ["leadMoverHourlyRate", "Lead rate"],
                    ["moverHourlyRate", "Mover rate"],
                    ["helperHourlyRate", "Helper rate"],
                    ["driverHourlyPremium", "Driver premium / hour"],
                    ["leadMoverBonusWeight", "Lead profit-bonus weight"],
                    ["moverBonusWeight", "Mover profit-bonus weight"],
                    ["helperBonusWeight", "Helper profit-bonus weight"],
                    ["silverAuthorityBonusPct", "Silver bonus %"],
                    ["goldAuthorityBonusPct", "Gold/Platinum bonus %"],
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-1">
                      <span className="text-xs text-slate-400">{label}</span>
                      <Input
                        type="number"
                        step="0.0001"
                        defaultValue={String(key.endsWith("Pct") ? numberValue(settings[key]) * 100 : settings[key] ?? "")}
                        onBlur={(e) => {
                          const raw = numberValue(e.target.value);
                          const value = key.endsWith("Pct") ? raw / 100 : raw;
                          if (Number.isFinite(value)) settingsMutation.mutate({ [key]: value });
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" | "blue" }) {
  const color = accent === "green" ? "text-emerald-300" : accent === "red" ? "text-red-300" : accent === "blue" ? "text-blue-300" : "text-white";
  return (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}

function payoutWorkerName(payout: AdminWorkerPayout) {
  return [payout.firstName, payout.lastName].filter(Boolean).join(" ").trim() || payout.email || payout.workerId;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function FinalizedPayoutStatusPanel({ payouts }: { payouts: AdminWorkerPayout[] }) {
  if (payouts.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Finalized employee earnings</h3>
          <p className="text-xs text-slate-400">Monthly earnings and customer tips post through monthly payroll; profit bonuses post quarterly. JCMOVES use the paid-completion job ledger.</p>
        </div>
        <Badge variant="outline" className="border-blue-400/40 text-blue-200">
          {payouts.length} record{payouts.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="space-y-2">
        {payouts.map((payout) => (
          <div
            key={payout.id}
            className="grid gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 md:grid-cols-[1.3fr_repeat(5,0.8fr)]"
          >
            <div>
              <p className="text-sm font-semibold text-white">{payoutWorkerName(payout)}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[payout.roleOnJob] || payout.roleOnJob}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Hours</p>
              <p className="text-sm text-slate-200">{numberValue(payout.hoursWorked).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Classification</p>
              <p className="text-sm text-slate-200">{money(payout.hourlyPay)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Driver</p>
              <p className="text-sm text-slate-200">{money(payout.driverPremiumPay)}</p>
            </div>
            <div><p className="text-[10px] uppercase tracking-wide text-slate-500">5% / 10%</p><p className="text-sm text-slate-200">{money(payout.authorityBonusPay)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Quarterly profit bonus</p><p className="text-sm text-amber-200">{money(payout.crewBonusPay)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p><p className="text-sm font-black text-emerald-300">{money(payout.totalPay)}</p><p className="text-[10px] capitalize text-slate-500">{statusLabel(payout.payoutStatus)}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkerEditor({
  employees,
  assignments,
  setAssignments,
  defaultHours,
  preview,
}: {
  employees: User[];
  assignments: AssignmentDraft[];
  setAssignments: (next: AssignmentDraft[]) => void;
  defaultHours: number;
  preview: ProfitSharePayoutPreview;
}) {
  const addWorker = () => {
    const unused = employees.find((employee) => !assignments.some((a) => a.workerId === employee.id));
    if (!unused) return;
    setAssignments([
      ...assignments,
      { workerId: unused.id, roleOnJob: assignments.length === 0 ? "lead_mover" : "mover", hourlyRate: assignments.length === 0 ? 30 : 25, hoursWorked: defaultHours, bonusWeight: assignments.length === 0 ? 1.5 : 1, bonusWeightOverrideReason: null, isDriverForJob: false },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Worker payouts</h3>
        <Button size="sm" variant="outline" onClick={addWorker}>Add worker</Button>
      </div>

      <div className="space-y-2">
        {(assignments.length ? assignments : preview.workerPayouts).map((assignment, index) => {
          const employee = employees.find((item) => item.id === assignment.workerId);
          const payout = preview.workerPayouts.find((item) => item.workerId === assignment.workerId);
          const draft = assignments[index] || assignment;

          return (
            <div key={`${assignment.workerId}-${index}`} className="grid gap-2 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 md:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_0.7fr_1fr]">
              <select
                className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                value={draft.workerId}
                onChange={(e) => {
                  const next = [...assignments];
                  next[index] = { ...draft, workerId: e.target.value };
                  setAssignments(next);
                }}
              >
                {employees.map((item) => <option key={item.id} value={item.id}>{employeeName(item)}</option>)}
              </select>
              <select
                className="h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                value={draft.roleOnJob}
                onChange={(e) => {
                  const role = e.target.value as ProfitShareRole;
                  const next = [...assignments];
                  next[index] = { ...draft, roleOnJob: role, hourlyRate: role === "lead_mover" ? 30 : role === "helper" ? 20 : 25, bonusWeight: role === "lead_mover" ? 1.5 : role === "helper" ? 0.75 : 1, bonusWeightOverrideReason: null };
                  setAssignments(next);
                }}
              >
                {roleOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
              <Input type="number" value={draft.hourlyRate} onChange={(e) => {
                const next = [...assignments];
                next[index] = { ...draft, hourlyRate: numberValue(e.target.value) };
                setAssignments(next);
              }} />
              <Input type="number" value={draft.hoursWorked} onChange={(e) => {
                const next = [...assignments];
                next[index] = { ...draft, hoursWorked: numberValue(e.target.value) };
                setAssignments(next);
              }} />
              <Input type="number" value={draft.bonusWeight} onChange={(e) => {
                const next = [...assignments];
                next[index] = { ...draft, bonusWeight: numberValue(e.target.value) };
                setAssignments(next);
              }} />
              <label className="flex items-center gap-2 text-xs text-slate-300"><Checkbox checked={draft.isDriverForJob === true} onCheckedChange={(value) => {
                const base = assignments.length ? assignments : preview.workerPayouts.map((worker) => ({ ...worker, isDriverForJob: worker.isDriverForJob === true }));
                setAssignments(base.map((item, itemIndex) => ({ ...item, isDriverForJob: itemIndex === index ? value === true : false })));
              }} />Driver</label>
              <Input className="md:col-span-full" value={draft.bonusWeightOverrideReason || ""} onChange={(event) => {
                const next = [...assignments];
                next[index] = { ...draft, bonusWeightOverrideReason: event.target.value };
                setAssignments(next);
              }} placeholder="Reason required only when profit-bonus weight differs from the role default" />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-sm font-black text-emerald-300">{money(payout?.totalPay || 0)}</p>
                </div>
                <Badge variant="outline" className="border-amber-400/40 text-amber-200">Profit bonus {money(payout?.crewBonusPay || 0)}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
