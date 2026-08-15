import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ReadinessJob = { id: string; orderNumber?: number | null; customerName: string; serviceType: string; date?: string | null; arrivalWindow?: string | null; requiredCrew: number; assignedCrew: string[]; paymentPlan?: string | null; paidInFull: boolean; missing: string[]; ready: boolean };
type ReadinessView = { from: string; to: string; ready: ReadinessJob[]; blocked: ReadinessJob[]; recipientCount: number };
const labels: Record<string, string> = { confirmedSchedule: "confirm date/arrival", quoteAccepted: "accept quote", crewFilled: "fill crew", crewLeadSelected: "choose crew lead", payoutAssignmentsSynced: "sync payout roles", calendarVisible: "add calendar date" };

export function UpcomingJobReadiness() {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const { data, isLoading } = useQuery<ReadinessView>({ queryKey: ["/api/admin/jobs/upcoming-reminders/preview"] });
  const mutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/jobs/upcoming-reminders/send", { confirm: true, from: data?.from, to: data?.to })).json(),
    onSuccess: (result) => {
      setConfirmed(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/jobs/upcoming-reminders/preview"] });
      toast({ title: "Upcoming job reminders sent", description: `${result.recipientCount} crew notification${result.recipientCount === 1 ? "" : "s"} ledgered.` });
    },
    onError: (error: Error) => toast({ title: "Reminder send failed", description: error.message, variant: "destructive" }),
  });
  return (
    <Card className="mb-5 border-cyan-500/20 bg-cyan-950/10">
      <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base text-white"><BellRing className="h-4 w-4 text-cyan-300" /> Upcoming-week readiness</CardTitle><p className="mt-1 text-xs text-slate-400">Only ready, assigned jobs receive the admin-confirmed calendar reminder.</p></div>{data && <Badge variant="outline">{data.from} – {data.to}</Badge>}</div></CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking upcoming jobs</div> : <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="flex items-center gap-2 text-sm font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Ready ({data?.ready.length || 0})</p>{data?.ready.map((job) => <p key={job.id} className="mt-1 text-xs text-slate-300">JC-{job.orderNumber || "job"} · {job.customerName} · {job.assignedCrew.length} crew</p>)}</div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"><p className="flex items-center gap-2 text-sm font-bold text-amber-300"><AlertTriangle className="h-4 w-4" /> Needs attention ({data?.blocked.length || 0})</p>{data?.blocked.map((job) => <p key={job.id} className="mt-1 text-xs text-slate-300">JC-{job.orderNumber || "job"} · {(job.missing || []).map((item) => labels[item] || item).join(", ")}</p>)}</div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-slate-300"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} />I reviewed the ready jobs and recipient count.</label><Button onClick={() => mutation.mutate()} disabled={!confirmed || !data?.ready.length || mutation.isPending}>{mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}Send {data?.recipientCount || 0} crew reminders</Button></div>
        </>}
      </CardContent>
    </Card>
  );
}
