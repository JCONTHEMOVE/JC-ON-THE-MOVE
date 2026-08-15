import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CashWorker = { workerId: string; firstName?: string | null; lastName?: string | null; email?: string | null; eligibleEarnings: number; targetPercent: number; cashPaid: number; remainingPayroll: number; quarterlyProfitBonus: number; latestAdjustmentAt?: string | null };
type CashHistory = { id: string; workerId: string; previousPercent: string; targetPercent: string; previousCashAmount: string; targetCashAmount: string; deltaAmount: string; reason: string; createdAt: string; createdByName?: string };
type CashSplitView = { paymentPlan?: string | null; workers: CashWorker[]; history: CashHistory[] };

const dollars = (value: unknown) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const name = (worker: CashWorker) => [worker.firstName, worker.lastName].filter(Boolean).join(" ").trim() || worker.email || "Crew member";

export function DailyCashSplit({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<CashSplitView>({ queryKey: [`/api/admin/job-payouts/jobs/${jobId}/cash-splits`] });
  const [percents, setPercents] = useState<Record<string, number>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (data) setPercents(Object.fromEntries(data.workers.map((worker) => [worker.workerId, worker.targetPercent])));
  }, [data]);
  const mutation = useMutation({
    mutationFn: async (workerId: string) => (await apiRequest("POST", `/api/admin/job-payouts/jobs/${jobId}/cash-splits/${workerId}`, {
      targetPercent: percents[workerId] || 0,
      reason: reasons[workerId] || "Admin cash payout reconciliation",
      confirmCashReceived: true,
    })).json(),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/job-payouts/jobs/${jobId}/cash-splits`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/job-payouts/jobs"] });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0] || "").startsWith("/api/admin/payroll/periods/") });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/planner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
      setConfirmed({});
      toast({ title: "Cash split ledgered", description: response.warning || "Monthly payroll offset updated." });
    },
    onError: (error: Error) => toast({ title: "Cash split failed", description: error.message, variant: "destructive" }),
  });
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading cash payout ledger</div>;
  if (!data?.workers.length) return null;
  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div><h3 className="flex items-center gap-2 font-bold text-white"><Banknote className="h-4 w-4 text-emerald-300" /> Same-day cash split</h3><p className="text-xs text-slate-400">Move 0–100% of finalized monthly job earnings to cash. Every edit creates a new delta entry; customer tips, quarterly profit bonuses, and JCMOVES are excluded.</p></div>
      {data.paymentPlan && !data.paymentPlan.toLowerCase().includes("cash") && <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">Payment plan is currently “{data.paymentPlan}”. Saving still records the admin confirmation and audit reason.</p>}
      {data.workers.map((worker) => {
        const percent = percents[worker.workerId] ?? worker.targetPercent;
        const targetCash = Math.round(worker.eligibleEarnings * percent) / 100;
        return <div key={worker.workerId} className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-white">{name(worker)}</p><p className="text-xs text-slate-500">Eligible monthly earnings {dollars(worker.eligibleEarnings)} · quarterly profit bonus {dollars(worker.quarterlyProfitBonus)}</p></div><div className="text-right"><p className="text-xl font-black text-emerald-300">{percent}% cash</p><p className="text-xs text-slate-400">{dollars(targetCash)} cash · {dollars(worker.eligibleEarnings - targetCash)} payroll</p></div></div>
          <Slider aria-label={`Cash percentage for ${name(worker)}`} value={[percent]} min={0} max={100} step={1} onValueChange={([value]) => setPercents((current) => ({ ...current, [worker.workerId]: value }))} />
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]"><Input value={reasons[worker.workerId] || ""} onChange={(event) => setReasons((current) => ({ ...current, [worker.workerId]: event.target.value }))} placeholder="Reason for cash payout or correction" /><label className="flex items-center gap-2 text-xs text-slate-300"><Checkbox checked={confirmed[worker.workerId] || false} onCheckedChange={(value) => setConfirmed((current) => ({ ...current, [worker.workerId]: value === true }))} />Cash/recovery reconciled</label><Button size="sm" onClick={() => mutation.mutate(worker.workerId)} disabled={mutation.isPending || !confirmed[worker.workerId] || (reasons[worker.workerId] || "").trim().length < 3}>Save audited split</Button></div>
        </div>;
      })}
      {data.history.length > 0 && <details><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-300"><History className="h-4 w-4" /> Edit history ({data.history.length})</summary><div className="mt-2 max-h-52 space-y-1 overflow-y-auto">{data.history.map((entry) => { const worker = data.workers.find((item) => item.workerId === entry.workerId); return <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1.5 text-xs"><span className="text-slate-300">{worker ? name(worker) : "Crew member"}: {entry.previousPercent}% → {entry.targetPercent}% · {entry.reason}<span className="ml-1 text-slate-500">by {entry.createdByName || "Administrator"} on {new Date(entry.createdAt).toLocaleString()}</span></span><span className={Number(entry.deltaAmount) < 0 ? "text-amber-300" : "text-emerald-300"}>{Number(entry.deltaAmount) >= 0 ? "+" : ""}{dollars(entry.deltaAmount)}</span></div>; })}</div></details>}
    </div>
  );
}
