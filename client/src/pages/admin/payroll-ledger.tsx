import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarRange, CheckCircle2, Loader2, Plus, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

type PeriodMode = "monthly" | "quarterly";
type PayrollLine = {
  id?: string;
  workerId: string;
  leadId?: string | null;
  sourceType: string;
  sourceId: string;
  amount: string | number;
  earningDate: string;
  description: string;
};

type PeriodView = {
  period: {
    id: string | null;
    periodKey: string;
    status: "draft" | "approved" | "recorded_paid";
    startDate: string;
    endDate: string;
    approvedAt?: string | null;
    recordedPaidAt?: string | null;
    paymentReference?: string | null;
  };
  entries: Array<{ entry: PayrollLine; firstName?: string | null; lastName?: string | null; email?: string | null; orderNumber?: number | null }>;
  candidates: PayrollLine[];
  summary: { total: number; byWorker: Array<{ workerId: string; amount: number; firstName?: string | null; lastName?: string | null; email?: string | null }> };
};

type PendingTip = {
  allocation: { id: string; amountUsd: string; tipMethod: string; status: string; createdAt: string };
  orderNumber?: number | null;
  firstName?: string | null;
  lastName?: string | null;
};

function currentKeys() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value || new Date().getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value || new Date().getMonth() + 1);
  const day = Number(parts.find((part) => part.type === "day")?.value || new Date().getDate());
  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    quarter: `${year}-Q${Math.floor((month - 1) / 3) + 1}`,
    today: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return amount.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function workerName(worker: { firstName?: string | null; lastName?: string | null; email?: string | null }) {
  return [worker.firstName, worker.lastName].filter(Boolean).join(" ").trim() || worker.email || "Crew member";
}

function sourceLabel(sourceType: string) {
  if (sourceType === "profit_bonus" || sourceType === "company_tip" || sourceType === "crew_profit_bonus") return "quarterly profit bonus";
  return sourceType.replace(/_/g, " ");
}

export default function AdminPayrollLedgerPage() {
  const keys = useMemo(currentKeys, []);
  const { toast } = useToast();
  const [mode, setMode] = useState<PeriodMode>("monthly");
  const [monthKey, setMonthKey] = useState(keys.month);
  const [quarterKey, setQuarterKey] = useState(keys.quarter);
  const [paymentReference, setPaymentReference] = useState("");
  const [periodNote, setPeriodNote] = useState("");
  const [adjustmentWorker, setAdjustmentWorker] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [tipReferences, setTipReferences] = useState<Record<string, string>>({});
  const periodKey = mode === "monthly" ? monthKey : quarterKey;

  const { data, isLoading } = useQuery<PeriodView>({ queryKey: [`/api/admin/payroll/periods/${periodKey}`] });
  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: pendingTips = [] } = useQuery<PendingTip[]>({
    queryKey: ["/api/admin/payroll/tips?status=pending_payment"],
    enabled: mode === "monthly",
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/admin/payroll/periods/${periodKey}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/payroll/tips?status=pending_payment"] });
  };
  const approveMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/payroll/periods/${periodKey}/approve`, { note: periodNote })).json(),
    onSuccess: () => { refresh(); toast({ title: mode === "monthly" ? "Monthly payroll and tips approved" : "Quarterly profit bonus approved" }); },
    onError: (error: Error) => toast({ title: "Approval blocked", description: error.message, variant: "destructive" }),
  });
  const paidMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/payroll/periods/${periodKey}/record-paid`, { paymentReference, note: periodNote })).json(),
    onSuccess: () => { refresh(); setPaymentReference(""); toast({ title: "Payment recorded in the ledger" }); },
    onError: (error: Error) => toast({ title: "Payment record failed", description: error.message, variant: "destructive" }),
  });
  const adjustmentMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/admin/payroll/periods/${periodKey}/adjustments`, {
      workerId: adjustmentWorker,
      amount: Number(adjustmentAmount),
      reason: adjustmentReason,
    })).json(),
    onSuccess: () => { refresh(); setAdjustmentAmount(""); setAdjustmentReason(""); toast({ title: "Audited adjustment added" }); },
    onError: (error: Error) => toast({ title: "Adjustment failed", description: error.message, variant: "destructive" }),
  });
  const tipMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmed" | "failed" }) => (await apiRequest("PATCH", `/api/admin/payroll/tips/${id}/status`, {
      status,
      confirmationReference: tipReferences[id] || "admin verified",
      confirmFundsReceived: true,
    })).json(),
    onSuccess: refresh,
    onError: (error: Error) => toast({ title: "Tip update failed", description: error.message, variant: "destructive" }),
  });

  const lines = data?.entries.length ? data.entries.map((row) => row.entry) : data?.candidates || [];
  const status = data?.period.status || "draft";
  const periodLabel = mode === "monthly" ? "monthly payroll and tips" : "quarterly profit bonus";
  const approvalWindowOpen = mode === "monthly" || Boolean(data?.period.endDate && data.period.endDate < keys.today);

  return (
    <div className="space-y-4">
      <Card className="border-slate-700/60 bg-slate-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-white"><CalendarRange className="h-5 w-5 text-cyan-300" /> Earnings periods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Ledger</Label><Select value={mode} onValueChange={(value) => setMode(value as PeriodMode)}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly payroll &amp; tips</SelectItem><SelectItem value="quarterly">Quarterly profit bonus</SelectItem></SelectContent></Select></div>
            <div className="space-y-1"><Label htmlFor="earnings-period">Period</Label><Input id="earnings-period" className="w-40" value={periodKey} onChange={(event) => mode === "monthly" ? setMonthKey(event.target.value) : setQuarterKey(event.target.value.toUpperCase())} placeholder={mode === "monthly" ? "YYYY-MM" : "YYYY-Q1"} /></div>
            <Badge variant="outline" className="mb-2 capitalize">{status.replace(/_/g, " ")}</Badge>
            <div className="mb-1 ml-auto text-right"><p className="text-xs uppercase text-slate-500">Period total</p><p className="text-2xl font-black text-emerald-300">{money(data?.summary.total)}</p></div>
          </div>
          <p className="text-sm text-slate-400">{mode === "monthly" ? "Classification wages, driver premiums, 5%/10% authority bonuses, confirmed customer tips, and daily cash offsets." : "The crew profit-bonus pool is settled quarterly and remains separate from monthly payroll and customer tips."}</p>
          {mode === "quarterly" && !approvalWindowOpen && <p className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">This profit-bonus quarter remains open through {data?.period.endDate}. Profit bonuses continue accumulating until the quarter closes.</p>}
          {isLoading ? <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading ledger</div> : (
            <div className="grid gap-2 md:grid-cols-3">
              {(data?.summary.byWorker || []).map((worker) => <div key={worker.workerId} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3"><p className="text-sm text-slate-300">{workerName(worker)}</p><p className="text-lg font-black text-white">{money(worker.amount)}</p></div>)}
              {!data?.summary.byWorker.length && <p className="text-sm text-slate-500">No eligible entries in this period.</p>}
            </div>
          )}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {lines.map((line) => <div key={`${line.sourceType}-${line.sourceId}`} className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"><div><p className="text-slate-200">{line.description}</p><p className="text-xs capitalize text-slate-500">{sourceLabel(line.sourceType)}</p></div><p className={Number(line.amount) < 0 ? "font-bold text-amber-300" : "font-bold text-emerald-300"}>{money(line.amount)}</p></div>)}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={periodNote} onChange={(event) => setPeriodNote(event.target.value)} placeholder="Period note (optional)" disabled={status !== "draft"} />
            <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Payroll/check reference" disabled={status !== "approved"} />
            {status === "draft" ? <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || !lines.length || !approvalWindowOpen}>{approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve {periodLabel}</Button> : status === "approved" ? <Button onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending || paymentReference.trim().length < 2}><CheckCircle2 className="mr-2 h-4 w-4" />Record paid</Button> : <Badge className="h-10 justify-center bg-emerald-600">Paid and ledgered</Badge>}
          </div>
        </CardContent>
      </Card>

      {status === "draft" && <Card className="border-slate-700/60 bg-slate-900/50"><CardHeader className="pb-3"><CardTitle className="text-base text-white">Audited correction</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-[1fr_140px_2fr_auto]"><Select value={adjustmentWorker} onValueChange={setAdjustmentWorker}><SelectTrigger><SelectValue placeholder="Crew member" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{workerName(employee)}</SelectItem>)}</SelectContent></Select><Input type="number" step="0.01" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} placeholder="Amount" /><Input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Reason for this correction" /><Button variant="outline" onClick={() => adjustmentMutation.mutate()} disabled={!adjustmentWorker || Math.abs(Number(adjustmentAmount)) < 0.01 || adjustmentReason.trim().length < 3 || adjustmentMutation.isPending}><Plus className="mr-2 h-4 w-4" />Add</Button></div></CardContent></Card>}

      {mode === "monthly" && <Card className="border-slate-700/60 bg-slate-900/50"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base text-white"><ReceiptText className="h-4 w-4 text-amber-300" /> Pending external tips</CardTitle></CardHeader><CardContent className="space-y-2">{pendingTips.map(({ allocation, ...tip }) => <div key={allocation.id} className="grid items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 md:grid-cols-[1.5fr_100px_1fr_auto_auto]"><div><p className="text-sm font-semibold text-white">{workerName(tip)}</p><p className="text-xs text-slate-500">JC-{tip.orderNumber || "job"} · {allocation.tipMethod}</p></div><p className="font-black text-amber-300">{money(allocation.amountUsd)}</p><Input aria-label={`Confirmation reference for ${workerName(tip)}`} value={tipReferences[allocation.id] || ""} onChange={(event) => setTipReferences((current) => ({ ...current, [allocation.id]: event.target.value }))} placeholder="Receipt/reference" /><Button size="sm" onClick={() => tipMutation.mutate({ id: allocation.id, status: "confirmed" })} disabled={(tipReferences[allocation.id] || "").trim().length < 2}>Confirm</Button><Button size="sm" variant="outline" onClick={() => tipMutation.mutate({ id: allocation.id, status: "failed" })}>Failed</Button></div>)}{!pendingTips.length && <p className="text-sm text-slate-500">No external tips need confirmation for monthly payroll.</p>}</CardContent></Card>}
    </div>
  );
}
