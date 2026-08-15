import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Radio, DollarSign, Briefcase, Coins, TrendingUp, Circle, Loader2,
  Users, Calendar, ChevronRight, Power, Zap, Send, MapPin, Navigation,
} from "lucide-react";
import type { User } from "@shared/schema";
import type { JobPayoutPreview } from "@shared/jobPayout";
import { UpcomingJobReadiness } from "@/components/upcoming-job-readiness";

// Task #171 — Live Dispatch page. Polls jobs + crew every 3s so operators
// can watch the feed and reassign with one click. Auto-dispatch logic is
// out of scope here; this page is the manual override surface.

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  serviceType: string;
  status: string;
  fromAddress?: string;
  confirmedDate?: string | null;
  moveDate?: string | null;
  arrivalWindow?: string | null;
  totalPrice?: string | null;
  basePrice?: string | null;
  crewMembers?: string[] | null;
  crewSize?: number | null;
  archivedAt?: string | null;
  createdAt?: string;
};

type TodayMetrics = {
  revenueToday: number;
  jobsToday: number;
  completedToday: number;
  avgTicket: number;
  jcmovesIssuedToday: number;
};

type DispatchMetrics = {
  activeOffers: number;
  pendingJobs: number;
  assignedToday: number;
  avgTimeToAssignSec: number;
  acceptRate7d: number;
  failedToday: number;
  enabled: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  quote_requested: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  chatbot_pending: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  new: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  open: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  available: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  assigned: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  in_progress: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

function fmtMoney(n: number) {
  return "$" + Math.round(n).toLocaleString();
}

function MetricCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: string;
}) {
  return (
    <Card className="border-white/5 bg-white/[0.03]">
      <CardContent className="p-4">
        <Icon className={`h-5 w-5 ${color} mb-1.5`} />
        <p className={`text-xl font-black ${color}`}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function JobCard({
  lead, employees, onReassign, onDispatchNow, onViewPayout, isReassigning, isDispatching,
}: {
  lead: Lead;
  employees: User[];
  onReassign: (leadId: string, crewId: string) => void;
  onDispatchNow: (leadId: string) => void;
  onViewPayout: (leadId: string) => void;
  isReassigning: boolean;
  isDispatching: boolean;
}) {
  const assigned = Array.isArray(lead.crewMembers) ? lead.crewMembers : [];
  const primary = assigned[0];
  const primaryEmployee = primary ? employees.find(e => e.id === primary) : null;
  const total = parseFloat(lead.totalPrice || lead.basePrice || "0");
  const date = lead.confirmedDate || lead.moveDate;

  return (
    <Card className="bg-slate-800/40 border-slate-700/50 hover:border-blue-500/40 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-mono text-slate-500 bg-slate-900/70 px-1.5 py-0.5 rounded"
                title={lead.id}
                data-testid={`job-id-${lead.id}`}
              >
                #{lead.id.slice(0, 8)}
              </span>
              <p className="font-bold text-white text-sm truncate">
                {lead.firstName} {lead.lastName}
              </p>
              <Badge className={`text-[10px] border ${STATUS_COLOR[lead.status] || "bg-slate-700/50 text-slate-400"}`}>
                {lead.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="capitalize">{lead.serviceType}</span>
              {date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
              {lead.arrivalWindow && (
                <span className="text-slate-500">{lead.arrivalWindow}</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {total > 0 && (
              <p className="font-bold text-green-400 text-sm">{fmtMoney(total)}</p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Users className="h-3 w-3 text-slate-500" />
            {primaryEmployee
              ? `${primaryEmployee.firstName || "Crew"} ${primaryEmployee.lastName?.[0] || ""}`
              : "Unassigned"}
            {assigned.length > 1 && (
              <span className="text-slate-500">+{assigned.length - 1}</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
              onClick={() => onDispatchNow(lead.id)}
              disabled={isDispatching}
              title="Start Uber-style offer loop: the engine picks the best crew and sends them a 20s offer."
              data-testid={`button-dispatch-now-${lead.id}`}
            >
              <Send className="h-3 w-3 mr-1" />
              Dispatch
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              onClick={() => onViewPayout(lead.id)}
              data-testid={`button-payout-${lead.id}`}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              Payout
            </Button>
            <Select
              value={primary || ""}
              onValueChange={(v) => onReassign(lead.id, v)}
              disabled={isReassigning}
            >
              <SelectTrigger className="h-7 w-36 text-xs bg-slate-900/80 border-slate-700" data-testid={`select-reassign-${lead.id}`}>
                <SelectValue placeholder="Reassign…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName || "Crew"} {e.lastName?.[0] || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href={`/lead/${lead.id}`}>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CrewStatus({
  e, jobsToday, currentJob,
}: { e: User; jobsToday: number; currentJob: Lead | null }) {
  // Minimal "online/offline" stub — we don't track presence yet, so
  // approved+active employees are shown as available. Real presence lands
  // with the Crew app (Task #173).
  const online = (e.status === "approved" || e.status === "active");
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <Circle className={`h-2.5 w-2.5 ${online ? "fill-green-400 text-green-400" : "fill-slate-600 text-slate-600"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">
          {e.firstName || "Crew"} {e.lastName || ""}
        </p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
          {online ? "Available" : "Offline"} · {jobsToday} today
        </p>
        {currentJob ? (
          <p className="text-[11px] text-blue-300 mt-0.5 truncate" data-testid={`crew-current-${e.id}`}>
            <span className="font-mono text-slate-500">#{currentJob.id.slice(0, 8)}</span>
            {" · "}
            {currentJob.firstName} {currentJob.lastName}
            <span className="text-slate-500"> ({currentJob.status.replace(/_/g, " ")})</span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-600 mt-0.5">No current job</p>
        )}
      </div>
    </div>
  );
}

export default function AdminDispatchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [payoutLeadId, setPayoutLeadId] = useState<string | null>(null);

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    refetchInterval: 3000,
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
    refetchInterval: 15000,
  });

  const { data: metrics } = useQuery<TodayMetrics>({
    queryKey: ["/api/admin/today-metrics"],
    refetchInterval: 10000,
  });

  const { data: dispatchMetrics } = useQuery<DispatchMetrics>({
    queryKey: ["/api/admin/dispatch/metrics"],
    refetchInterval: 5000,
  });

  const { data: payoutPreview, isLoading: payoutLoading } = useQuery<JobPayoutPreview | null>({
    queryKey: payoutLeadId ? [`/api/admin/jobs/${payoutLeadId}/payout-preview`] : ["/api/admin/jobs/payout-preview/idle"],
    enabled: !!payoutLeadId,
  });

  const killSwitchMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/admin/dispatch/kill-switch", { enabled });
      if (!res.ok) throw new Error("Failed to toggle");
      return res.json();
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dispatch/metrics"] });
      toast({ title: d.enabled ? "Dispatch ENABLED" : "Dispatch DISABLED" });
    },
    onError: (e: Error) => toast({ title: "Toggle failed", description: e.message, variant: "destructive" }),
  });

  const manualDispatchMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/admin/jobs/${leadId}/dispatch`, {
        reason: "manual re-dispatch from admin console",
      });
      if (!res.ok) throw new Error("Failed to dispatch");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dispatch/metrics"] });
      toast({ title: "Offer loop started" });
    },
    onError: (e: Error) => toast({ title: "Dispatch failed", description: e.message, variant: "destructive" }),
  });

  // Task #172 — Uses the audited /reassign endpoint so every manual
  // override lands in dispatch_log with the admin's user id + reason.
  // The legacy /assign endpoint still exists for bulk-crew edits from
  // the quote panel but isn't used from the dispatch console.
  const reassignMutation = useMutation({
    mutationFn: async ({ leadId, crewId }: { leadId: string; crewId: string }) => {
      const res = await apiRequest("POST", `/api/admin/jobs/${leadId}/reassign`, {
        crewId,
        reason: "manual reassignment from live dispatch console",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reassign");
      }
      return res.json();
    },
    onMutate: ({ leadId }) => setReassigningId(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dispatch/metrics"] });
      toast({ title: "Crew reassigned" });
    },
    onError: (e: Error) => toast({ title: "Reassign failed", description: e.message, variant: "destructive" }),
    onSettled: () => setReassigningId(null),
  });

  const activeLeads = useMemo(
    () => leads.filter(l => !l.archivedAt && l.status !== "completed" && l.status !== "cancelled")
               .slice(0, 40),
    [leads]
  );

  const { crewJobsToday, crewCurrentJob } = useMemo(() => {
    const countMap = new Map<string, number>();
    const currentMap = new Map<string, Lead>();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ACTIVE = new Set(["assigned", "in_progress", "available"]);
    for (const l of leads) {
      if (l.archivedAt) continue;
      const d = new Date(l.confirmedDate || l.moveDate || l.createdAt || 0);
      if (d >= todayStart) {
        for (const uid of l.crewMembers || []) {
          countMap.set(uid, (countMap.get(uid) || 0) + 1);
        }
      }
      if (ACTIVE.has(l.status)) {
        for (const uid of l.crewMembers || []) {
          if (!currentMap.has(uid)) currentMap.set(uid, l);
        }
      }
    }
    return { crewJobsToday: countMap, crewCurrentJob: currentMap };
  }, [leads]);

  const activeEmployees = useMemo(
    () => employees.filter(e => e.role !== "customer"),
    [employees]
  );

  const handleReassign = (leadId: string, crewId: string) => {
    reassignMutation.mutate({ leadId, crewId });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-blue-400" />
          <h1 className="text-2xl font-black text-white">Live Dispatch</h1>
          <Badge variant="outline" className="ml-2 text-xs border-green-500/40 text-green-400">
            LIVE · 3s
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <Power className={`h-4 w-4 ${dispatchMetrics?.enabled ? "text-green-400" : "text-red-400"}`} />
            <span className="text-xs text-slate-300 font-medium">
              Auto-dispatch
            </span>
            <Switch
              checked={dispatchMetrics?.enabled ?? true}
              onCheckedChange={(v) => killSwitchMutation.mutate(v)}
              disabled={killSwitchMutation.isPending}
              data-testid="toggle-dispatch-kill-switch"
            />
          </div>
        </div>
      </div>

      {/* Dispatch engine status strip */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Active offers</p>
          <p className="text-lg font-black text-blue-300" data-testid="dispatch-active-offers">
            {dispatchMetrics?.activeOffers ?? 0}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Pending jobs</p>
          <p className="text-lg font-black text-amber-300">{dispatchMetrics?.pendingJobs ?? 0}</p>
        </div>
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Assigned today</p>
          <p className="text-lg font-black text-green-300">{dispatchMetrics?.assignedToday ?? 0}</p>
        </div>
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg time to assign</p>
          <p className="text-lg font-black text-purple-300">
            {dispatchMetrics ? `${dispatchMetrics.avgTimeToAssignSec}s` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Accept rate 7d</p>
          <p className="text-lg font-black text-orange-300">
            {dispatchMetrics ? `${Math.round((dispatchMetrics.acceptRate7d || 0) * 100)}%` : "—"}
          </p>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard
          icon={DollarSign}
          label="Revenue Today"
          value={fmtMoney(metrics?.revenueToday ?? 0)}
          color="text-green-400"
        />
        <MetricCard
          icon={Briefcase}
          label="Jobs Today"
          value={String(metrics?.jobsToday ?? 0)}
          color="text-blue-400"
        />
        <MetricCard
          icon={Coins}
          label="JCMOVES Issued"
          value={Math.round(metrics?.jcmovesIssuedToday ?? 0).toLocaleString()}
          color="text-purple-400"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Ticket"
          value={fmtMoney(metrics?.avgTicket ?? 0)}
          color="text-orange-400"
        />
      </div>

      {/* Task #174 — Demand heatmap strip. Operators can glance at per-zone
          demand intensity from the dispatch screen before manually reassigning. */}
      <DemandHeatmapStrip />

      <UpcomingJobReadiness />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        {/* Jobs feed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Job Feed
            </h2>
            <span className="text-xs text-slate-500">{activeLeads.length} active</span>
          </div>
          <div className="space-y-2" data-testid="dispatch-job-feed">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-10 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading jobs…
              </div>
            ) : activeLeads.length === 0 ? (
              <Card className="bg-slate-900/40 border-slate-800/60">
                <CardContent className="p-6 text-center text-slate-500 text-sm">
                  No active jobs in the queue.
                </CardContent>
              </Card>
            ) : (
              activeLeads.map(l => (
                <JobCard
                  key={l.id}
                  lead={l}
                  employees={activeEmployees}
                  onReassign={handleReassign}
                  onDispatchNow={(id) => manualDispatchMutation.mutate(id)}
                  onViewPayout={setPayoutLeadId}
                  isReassigning={reassigningId === l.id}
                  isDispatching={manualDispatchMutation.isPending &&
                    manualDispatchMutation.variables === l.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Crew panel */}
        <aside>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Crew
            </h2>
            <span className="text-xs text-slate-500">{activeEmployees.length}</span>
          </div>
          <div className="space-y-2" data-testid="dispatch-crew-panel">
            {activeEmployees.length === 0 ? (
              <Card className="bg-slate-900/40 border-slate-800/60">
                <CardContent className="p-4 text-center text-slate-500 text-sm">
                  No crew on file.
                </CardContent>
              </Card>
            ) : (
              activeEmployees.map(e => (
                <CrewStatus
                  key={e.id}
                  e={e}
                  jobsToday={crewJobsToday.get(e.id) || 0}
                  currentJob={crewCurrentJob.get(e.id) || null}
                />
              ))
            )}
          </div>

          {/* Task #173 — Live crew positions pulled from the GPS beacon.
              Polls every 15s so the admin sees movement as crews drive. */}
          <LiveCrewPositions />
        </aside>
      </div>

      <Dialog open={!!payoutLeadId} onOpenChange={(open) => !open && setPayoutLeadId(null)}>
        <DialogContent className="max-w-3xl border-slate-800 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>Quick Payout Estimate</DialogTitle>
            <p className="text-sm text-slate-400">
              This uses the same canonical classification, driver, authority bonus, and quarterly profit-bonus rules as Finance.
            </p>
          </DialogHeader>

          {payoutLoading || !payoutPreview ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading payout preview...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card className="border-white/5 bg-white/[0.03]"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Job Total</p><p className="text-lg font-black text-green-400">${payoutPreview.jobTotal.toLocaleString()}</p></CardContent></Card>
                <Card className="border-white/5 bg-white/[0.03]"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Service</p><p className="text-lg font-black text-blue-300 capitalize">{payoutPreview.serviceType.replace(/_/g, " ")}</p></CardContent></Card>
                <Card className="border-white/5 bg-white/[0.03]"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Hours</p><p className="text-lg font-black text-purple-300">{payoutPreview.confirmedHours}</p></CardContent></Card>
                <Card className="border-white/5 bg-white/[0.03]"><CardContent className="p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Crew</p><p className="text-lg font-black text-amber-300">{payoutPreview.crewCount}</p></CardContent></Card>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Canonical Earnings Pools</p>
                    {[
                      ["Monthly job earnings", payoutPreview.pools.laborPool],
                      ["5% / 10% authority bonus", payoutPreview.pools.ownerAdminPool],
                      ["Company Profit", payoutPreview.pools.companyProfitPool],
                      ["Referral", payoutPreview.pools.referralPool],
                      ["Equipment", payoutPreview.pools.equipmentPool],
                      ["Growth", payoutPreview.pools.mealCultureFund],
                      ["Reserve", payoutPreview.pools.reserveFund],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{label}</span>
                        <span className="font-bold text-white">${Number(value).toLocaleString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Canonical Calculation</p>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300">From company profit</span><span className="font-bold text-white">${payoutPreview.topUpFunding.fromCompanyProfit.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300">From owner/admin</span><span className="font-bold text-white">${payoutPreview.topUpFunding.fromOwnerAdmin.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300">From reserve</span><span className="font-bold text-white">${payoutPreview.topUpFunding.fromReserve.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-300">Uncovered</span><span className={`font-bold ${payoutPreview.topUpFunding.uncovered > 0 ? "text-red-400" : "text-emerald-400"}`}>${payoutPreview.topUpFunding.uncovered.toLocaleString()}</span></div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Crew Take-Home</p>
                  <div className="space-y-2">
                    {payoutPreview.crewPayouts.map((worker) => (
                      <div key={worker.workerId} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{worker.name}</p>
                            <p className="text-xs text-slate-500">{worker.hoursWorked} hrs • weight {worker.weight.toFixed(2)} • min ${worker.minRate}/hr</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-300">${worker.totalTakeHome.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">${worker.effectiveHourly.toLocaleString()}/hr</p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                          <div className="rounded bg-slate-900 px-2 py-1.5"><span className="text-slate-500">Weighted</span><p className="font-semibold text-white">${worker.weightedPay.toLocaleString()}</p></div>
                          <div className="rounded bg-slate-900 px-2 py-1.5"><span className="text-slate-500">Minimum</span><p className="font-semibold text-white">${worker.minimumPay.toLocaleString()}</p></div>
                          <div className="rounded bg-slate-900 px-2 py-1.5"><span className="text-slate-500">Top-up</span><p className="font-semibold text-white">${worker.topUpApplied.toLocaleString()}</p></div>
                          <div className="rounded bg-slate-900 px-2 py-1.5"><span className="text-slate-500">Labor Pay</span><p className="font-semibold text-white">${worker.finalLaborPay.toLocaleString()}</p></div>
                        </div>
                        {worker.additionalPayouts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {worker.additionalPayouts.map((item, idx) => (
                              <Badge key={`${item.type}-${idx}`} variant="outline" className="border-emerald-500/40 text-emerald-300">
                                {item.type.replace("_", " ")} +${item.amount.toLocaleString()}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {payoutPreview.rolePayouts.length > 0 && (
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Role Payouts</p>
                    {payoutPreview.rolePayouts.map((item, idx) => (
                      <div key={`${item.type}-${idx}`} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{item.recipientName} • {item.reason}</span>
                        <span className="font-bold text-white">${item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Retained Pools</p>
                  <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    {Object.entries(payoutPreview.retainedPools).map(([key, value]) => (
                      <div key={key} className="rounded bg-slate-950/70 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">{key.replace(/([A-Z])/g, " $1")}</p>
                        <p className="font-bold text-white">${Number(value).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-1 text-xs text-slate-400">
                <p>Use Finance for approved actual hours, monthly payroll and tips, quarterly profit bonuses, daily cash offsets, and final payout status.</p>
                {payoutPreview.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CrewPosition = {
  userId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  updatedAt: string;
  firstName: string | null;
  lastName: string | null;
  isAvailable: boolean | null;
};

function LiveCrewPositions() {
  const { data: positions = [] } = useQuery<CrewPosition[]>({
    queryKey: ["/api/admin/crew/locations"],
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const { data: declineData = [] } = useQuery<{ userId: string; firstName: string | null; lastName: string | null; declineCount: number; lastDeclinedAt: string | null }[]>({
    queryKey: ["/api/admin/crew/decline-counts"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  function fmtAge(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-green-400" /> Live Positions
        </h2>
        <span className="text-xs text-slate-500" data-testid="live-positions-count">{positions.length}</span>
      </div>
      <Card className="bg-slate-900/40 border-slate-800/60">
        <CardContent className="p-3">
          {positions.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-3">No crew reporting GPS right now.</p>
          ) : (
            <ul className="space-y-1.5" data-testid="live-positions-list">
              {positions.map(p => {
                const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.userId.slice(0, 6);
                const mapUrl = `https://www.google.com/maps?q=${p.lat},${p.lng}`;
                return (
                  <li key={p.userId} className="flex items-center justify-between text-xs bg-slate-900/60 rounded px-2 py-1.5" data-testid={`position-${p.userId}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className={`h-2 w-2 flex-shrink-0 ${p.isAvailable ? "fill-green-400 text-green-400" : "fill-slate-500 text-slate-500"}`} />
                      <span className="text-slate-200 font-medium truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-500 text-[10px] tabular-nums">{fmtAge(p.updatedAt)}</span>
                      <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        <Navigation className="h-3 w-3" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Task #173 — chronic decliner visibility. Sorted desc by count. */}
      {declineData.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Decline Counts
          </h2>
          <Card className="bg-slate-900/40 border-slate-800/60">
            <CardContent className="p-3">
              <ul className="space-y-1" data-testid="decline-counts-list">
                {declineData.map(d => {
                  const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || d.userId.slice(0, 6);
                  return (
                    <li key={d.userId} className="flex items-center justify-between text-xs bg-slate-900/60 rounded px-2 py-1" data-testid={`decline-${d.userId}`}>
                      <span className="text-slate-200 truncate">{name}</span>
                      <span className={`font-bold tabular-nums ${d.declineCount >= 5 ? "text-red-400" : d.declineCount >= 3 ? "text-amber-400" : "text-slate-300"}`}>
                        {d.declineCount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

type DemandSnapshot = {
  zones: Array<{
    zoneCode: string;
    zoneName: string;
    score: number;
    counts: { q15m: number; q60m: number; q24h: number; activeJobs: number; onlineCrew: number };
    surge: { multiplier: number; band: string };
    center?: { lat: number; lng: number };
    radiusMi?: number;
  }>;
};

function DemandHeatmapStrip() {
  const { data } = useQuery<DemandSnapshot>({
    queryKey: ["/api/admin/demand"],
    refetchInterval: 15000,
  });
  const zones = data?.zones ?? [];
  if (zones.length === 0) return null;
  const sorted = [...zones].sort((a, b) => b.score - a.score);

  // Compute a bounding box around all zones with centers, then project
  // each to SVG coordinates. Zones without centers fall through to the
  // supplemental strip below.
  const geo = sorted
    .map(z => ({ z, c: z.center }))
    .filter((x): x is { z: typeof sorted[number]; c: { lat: number; lng: number } } => !!x.c);
  const hasGeo = geo.length > 0;
  const lats = geo.map(g => g.c.lat);
  const lngs = geo.map(g => g.c.lng);
  const pad = 0.05;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const W = 800, H = 260;
  const project = (lat: number, lng: number) => ({
    x: ((lng - minLng) / Math.max(1e-6, maxLng - minLng)) * W,
    y: H - ((lat - minLat) / Math.max(1e-6, maxLat - minLat)) * H,
  });
  const heatColor = (score: number) => {
    if (score > 1.0) return { fill: "#ef4444", stroke: "#fca5a5" };
    if (score > 0.7) return { fill: "#f97316", stroke: "#fdba74" };
    if (score > 0.4) return { fill: "#f59e0b", stroke: "#fcd34d" };
    if (score < 0.2) return { fill: "#0ea5e9", stroke: "#7dd3fc" };
    return { fill: "#64748b", stroke: "#cbd5e1" };
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-3.5 w-3.5 text-amber-400" />
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Demand Heatmap
        </h2>
      </div>
      {hasGeo && (
        <div className="rounded-xl bg-slate-950/50 border border-slate-700/50 p-2 mb-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Demand heatmap">
            <rect x={0} y={0} width={W} height={H} fill="#0f172a" />
            {geo.map(({ z, c }) => {
              const p = project(c.lat, c.lng);
              const r = Math.max(18, Math.min(90, 22 + z.score * 50));
              const color = heatColor(z.score);
              const opacity = Math.max(0.18, Math.min(0.75, 0.2 + z.score * 0.5));
              return (
                <g key={z.zoneCode} data-testid={`heatmap-circle-${z.zoneCode}`}>
                  <circle cx={p.x} cy={p.y} r={r} fill={color.fill} opacity={opacity} />
                  <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={color.stroke} strokeOpacity={0.7} strokeWidth={1.5} />
                  <text x={p.x} y={p.y - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">{z.zoneName}</text>
                  <text x={p.x} y={p.y + 10} textAnchor="middle" fill="#e2e8f0" fontSize="10">
                    {Math.round(z.score * 100)}% · {z.surge.multiplier}×
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
      {/* Supplemental strip (ordered list) — renders for all zones */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {sorted.map(z => {
          const color = heatColor(z.score);
          return (
            <div
              key={z.zoneCode}
              className="rounded-lg border px-2.5 py-2"
              style={{ borderColor: color.stroke + "55", background: color.fill + "14" }}
              data-testid={`heatmap-zone-${z.zoneCode}`}
            >
              <p className="text-[11px] font-bold truncate text-slate-100">{z.zoneName}</p>
              <div className="flex items-baseline justify-between mt-0.5">
                <span className="text-lg font-black" style={{ color: color.stroke }}>{Math.round(z.score * 100)}%</span>
                <span className="text-[10px] text-slate-400">{z.surge.multiplier}×</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                q60m {z.counts.q60m} · crew {z.counts.onlineCrew}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
