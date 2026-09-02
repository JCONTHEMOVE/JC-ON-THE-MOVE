import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, CalendarClock, CheckCircle2, Mail, PhoneCall, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Briefing = {
  summary: string;
  priorities: Array<{ title: string; reason: string }>;
  facts: Record<string, number>;
  model: string;
  aiFallback: boolean;
};

type ScheduleRequest = {
  id: string;
  lead_id: string;
  status: "pending_confirmation" | "confirmed" | "change_requested";
  first_name: string;
  last_name: string;
  service_type: string;
  preferred_date: string;
  preferred_start_time: string;
  pending_change_date?: string | null;
  pending_change_start_time?: string | null;
  capacity_status: "open" | "limited" | "ask_jc";
  selected_crew_size: number;
  planning_minutes: number;
  urgent: boolean;
};

type SafetyLead = {
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  service_type: string;
  created_at: string;
  age_hours: string | number;
  red_flag: number;
  reminder: number;
};

type DraftAction = {
  id: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  rationale: string;
  status: string;
};

function shortDate(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function shortTime(value: string | null | undefined) {
  return String(value || "").slice(0, 5);
}

function createdDisplay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(value));
}

export default function ChiefOfStaffPage() {
  const { toast } = useToast();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [draft, setDraft] = useState<DraftAction | null>(null);
  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<{ requests: ScheduleRequest[] }>({
    queryKey: ["/api/admin/schedule-requests"],
    refetchInterval: 30_000,
  });
  const { data: safetyData } = useQuery<{ leads: SafetyLead[] }>({
    queryKey: ["/api/admin/lead-safety/status"],
    refetchInterval: 30_000,
  });
  const alertLeads = (safetyData?.leads || []).filter((lead) => Number(lead.red_flag) || Number(lead.reminder));

  const briefingMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/chief-of-staff/briefing", {})).json() as Promise<Briefing>,
    onSuccess: setBriefing,
    onError: (error: Error) => toast({ title: "Could not prepare the briefing", description: error.message, variant: "destructive" }),
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "confirm" | "decline" | "approve_change" | "reject_change" }) => (
      await apiRequest("PATCH", `/api/admin/schedule-requests/${id}`, { decision })
    ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedule-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/planner"] });
      toast({ title: "Schedule request updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update the schedule", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const contactMutation = useMutation({
    mutationFn: async ({ leadId, outcome }: { leadId: string; outcome: "attempted" | "reached" }) => (
      await apiRequest("POST", `/api/admin/leads/${leadId}/contact-events`, { outcome })
    ).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lead-safety/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/planner"] });
      toast({ title: "Customer contact recorded" });
    },
  });

  const draftMutation = useMutation({
    mutationFn: async (leadId: string) => (await apiRequest("POST", "/api/admin/chief-of-staff/email-drafts", { leadId })).json() as Promise<{ action: DraftAction }>,
    onSuccess: (result) => setDraft(result.action),
    onError: (error: Error) => toast({ title: "Could not draft the email", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => (await apiRequest("POST", `/api/admin/chief-of-staff/actions/${actionId}/approve`, {})).json(),
    onSuccess: () => {
      setDraft(null);
      toast({ title: "Approved email sent", description: "The exact previewed draft was sent to the customer." });
    },
    onError: (error: Error) => toast({ title: "Could not send the approved email", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-3 py-6 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Owner only · Grok</p><h1 className="mt-1 text-3xl font-black">Chief of Staff</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Prioritizes JC work and prepares drafts. Every customer email, schedule decision, price, assignment, dispatch, payment, and reward stays under human control.</p></div>
        <Button onClick={() => briefingMutation.mutate()} disabled={briefingMutation.isPending} className="gap-2 bg-violet-600 hover:bg-violet-500"><Bot className="h-4 w-4" />{briefingMutation.isPending ? "Preparing…" : "Prepare owner briefing"}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="48-hour red flags" value={alertLeads.filter((lead) => Number(lead.red_flag)).length} tone="red" />
        <Metric label="24-hour reminders" value={alertLeads.filter((lead) => Number(lead.reminder)).length} tone="amber" />
        <Metric label="Schedule decisions" value={(scheduleData?.requests || []).filter((request) => request.status !== "confirmed").length} tone="blue" />
      </div>

      {briefing && <Card className="border-violet-500/30 bg-violet-500/[0.06] text-slate-100"><CardHeader><div className="flex flex-wrap items-center gap-2"><Bot className="h-5 w-5 text-violet-300" /><CardTitle>Owner briefing</CardTitle><Badge variant="outline">{briefing.aiFallback ? "Deterministic fallback" : briefing.model}</Badge></div><CardDescription>{briefing.summary}</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{briefing.priorities.map((priority, index) => <div key={`${priority.title}-${index}`} className="rounded-xl border border-violet-400/20 bg-slate-950/50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-violet-300">Priority {index + 1}</p><h3 className="mt-1 font-black">{priority.title}</h3><p className="mt-1 text-sm text-slate-400">{priority.reason}</p></div>)}</CardContent></Card>}

      <section>
        <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-300" /><h2 className="text-xl font-black">Lead response safety</h2></div>
        {alertLeads.length === 0 ? <EmptyState text="No open 24-hour or 48-hour lead alerts." /> : <div className="grid gap-3 lg:grid-cols-2">{alertLeads.map((lead) => <Card key={lead.lead_id} className={Number(lead.red_flag) ? "border-red-500/50 bg-red-500/[0.07] text-slate-100" : "border-amber-400/40 bg-amber-400/[0.06] text-slate-100"}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{lead.first_name} {lead.last_name}</p><p className="text-sm capitalize text-slate-400">{lead.service_type.replace(/_/g, " ")} · created {createdDisplay(lead.created_at)}</p></div><Badge className={Number(lead.red_flag) ? "bg-red-600" : "bg-amber-500 text-slate-950"}>{Number(lead.red_flag) ? "48h RED" : "24h"}</Badge></div><p className="text-sm text-slate-300">Age: {Math.floor(Number(lead.age_hours))} hours · {lead.phone || "No phone"}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => contactMutation.mutate({ leadId: lead.lead_id, outcome: "attempted" })}><PhoneCall className="mr-1 h-4 w-4" />Attempted</Button><Button size="sm" onClick={() => contactMutation.mutate({ leadId: lead.lead_id, outcome: "reached" })}><CheckCircle2 className="mr-1 h-4 w-4" />Reached</Button><Button size="sm" variant="secondary" onClick={() => draftMutation.mutate(lead.lead_id)} disabled={draftMutation.isPending}><Mail className="mr-1 h-4 w-4" />Preview email</Button><Button size="sm" variant="ghost" asChild><a href={`/lead/${lead.lead_id}`}>Open lead</a></Button></div></CardContent></Card>)}</div>}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-300" /><h2 className="text-xl font-black">Tentative dates and change requests</h2>{scheduleLoading && <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />}</div>
        {(scheduleData?.requests || []).length === 0 ? <EmptyState text="No schedule requests need review." /> : <div className="grid gap-3 lg:grid-cols-2">{(scheduleData?.requests || []).map((request) => {
          const change = request.status === "change_requested";
          const date = change ? request.pending_change_date : request.preferred_date;
          const time = change ? request.pending_change_start_time : request.preferred_start_time;
          return <Card key={request.id} className={`text-slate-100 ${request.urgent ? "border-red-500/50 bg-red-500/[0.06]" : "border-blue-500/30 bg-slate-900/80"}`}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black">{request.first_name} {request.last_name}</p><p className="text-sm capitalize text-slate-400">{request.service_type.replace(/_/g, " ")}</p></div><div className="flex gap-1"><Badge variant="outline" className="capitalize">{request.capacity_status.replace("_", " ")}</Badge>{request.urgent && <Badge className="bg-red-600">Under 48h</Badge>}</div></div><div className="rounded-xl border border-dashed border-blue-300/40 bg-blue-400/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-200">{change ? "Requested change" : request.status === "confirmed" ? "Confirmed" : "Tentative — does not block capacity"}</p><p className="mt-1 text-lg font-black">{shortDate(date)} at {shortTime(time)} Central</p><p className="text-sm text-slate-400">{request.selected_crew_size} movers · plan {request.planning_minutes / 60} hours</p></div>{request.status !== "confirmed" && <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => scheduleMutation.mutate({ id: request.id, decision: change ? "approve_change" : "confirm" })}><CheckCircle2 className="mr-1 h-4 w-4" />{change ? "Approve change" : "Confirm date"}</Button><Button size="sm" variant="outline" onClick={() => scheduleMutation.mutate({ id: request.id, decision: change ? "reject_change" : "decline" })}>{change ? "Keep confirmed time" : "Decline"}</Button></div>}</CardContent></Card>;
        })}</div>}
      </section>

      {draft && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Email approval preview"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-violet-500/40 bg-slate-950 text-slate-100"><CardHeader><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-violet-300" /><CardTitle>Approval required</CardTitle></div><CardDescription>Nothing has been sent. Approve only if this exact recipient, subject, and body are correct.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-lg bg-slate-900 p-3 text-sm"><p><strong>To:</strong> {draft.recipient_email}</p><p className="mt-1"><strong>Subject:</strong> {draft.subject}</p></div><pre className="whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-4 font-sans text-sm text-slate-200">{draft.body_text}</pre><p className="text-xs text-slate-400"><strong>Why this draft is safe:</strong> {draft.rationale}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={() => approveMutation.mutate(draft.id)} disabled={approveMutation.isPending} className="bg-violet-600 hover:bg-violet-500">{approveMutation.isPending ? "Sending…" : "Approve and send exact draft"}</Button></div></CardContent></Card></div>}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "blue" }) {
  const classes = tone === "red" ? "border-red-500/30 bg-red-500/[0.06] text-red-200" : tone === "amber" ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-100" : "border-blue-500/30 bg-blue-500/[0.06] text-blue-200";
  return <div className={`rounded-2xl border p-4 ${classes}`}><p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">{text}</div>;
}
