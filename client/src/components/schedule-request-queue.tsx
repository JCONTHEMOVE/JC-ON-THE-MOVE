import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Mail, PhoneCall, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ScheduleRequest = {
  id: string;
  lead_id: string;
  status: "pending_confirmation" | "change_requested";
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  service_type: string;
  service_address: string;
  work_scope: string;
  preferred_date: string;
  preferred_start_time: string;
  pending_change_date?: string | null;
  pending_change_start_time?: string | null;
  capacity_status: "open" | "limited" | "ask_jc";
  selected_crew_size: number;
  planning_minutes: number;
  urgent: boolean;
  latest_contact_outcome?: "attempted" | "reached" | null;
  latest_contact_at?: string | null;
};

function shortDate(value?: string | null) {
  return String(value || "").slice(0, 10);
}
function shortTime(value?: string | null) {
  return String(value || "").slice(0, 5);
}

export function ScheduleRequestQueue({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const canConfirm = ["admin", "business_owner"].includes(String(user?.role || ""));
  const requests = useQuery<{ requests: ScheduleRequest[] }>({
    queryKey: ["/api/staff/schedule-requests"],
    refetchInterval: 30_000,
    retry: false,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/staff/schedule-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedule-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/planner"] }),
    ]);
  };

  const decision = useMutation({
    mutationFn: async ({ request, approve }: { request: ScheduleRequest; approve: boolean }) => {
      const isChange = request.status === "change_requested";
      const action = approve ? (isChange ? "approve_change" : "confirm") : (isChange ? "reject_change" : "decline");
      return (await apiRequest("PATCH", `/api/admin/schedule-requests/${request.id}`, { decision: action })).json();
    },
    onSuccess: async () => { await refresh(); toast({ title: "Schedule request updated" }); },
    onError: (error: Error) => toast({ title: "Schedule action failed", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const contact = useMutation({
    mutationFn: async ({ request, outcome }: { request: ScheduleRequest; outcome: "attempted" | "reached" }) => (
      await apiRequest("POST", `/api/staff/leads/${request.lead_id}/contact-events`, { outcome, notes: "Recorded from the date-first schedule queue" })
    ).json(),
    onSuccess: async (_data, variables) => { await refresh(); toast({ title: variables.outcome === "reached" ? "Customer reached" : "Follow-up attempt recorded" }); },
    onError: (error: Error) => toast({ title: "Could not record follow-up", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  const rows = requests.data?.requests || [];
  if (!requests.isLoading && rows.length === 0) return null;

  return (
    <Card className={`border-blue-500/35 bg-blue-500/[0.06] text-slate-100 ${className}`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-300" />Date-first requests awaiting action</CardTitle><CardDescription>Customer preferences are tentative until an admin confirms them. Crew can follow up and record contact here.</CardDescription></div>{requests.isFetching && <RefreshCw className="h-4 w-4 animate-spin text-slate-500" />}</div>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-2">
        {rows.map((request) => {
          const change = request.status === "change_requested";
          const date = change ? request.pending_change_date : request.preferred_date;
          const time = change ? request.pending_change_start_time : request.preferred_start_time;
          return (
            <div key={request.id} className={`rounded-xl border p-4 ${request.urgent ? "border-red-500/50 bg-red-500/[0.08]" : "border-blue-400/25 bg-slate-950/55"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-black">{request.first_name} {request.last_name}</p><p className="text-xs capitalize text-slate-400">{request.service_type.replaceAll("_", " ")} · {request.service_address}</p></div><div className="flex flex-wrap justify-end gap-1"><Badge variant="outline" className="capitalize">{request.capacity_status.replaceAll("_", " ")}</Badge>{request.urgent && <Badge className="bg-red-600"><AlertTriangle className="mr-1 h-3 w-3" />Under 48h</Badge>}</div></div>
              <div className="my-3 rounded-lg border border-dashed border-blue-300/35 bg-blue-400/[0.06] p-3"><p className="text-[10px] font-black uppercase tracking-widest text-blue-200">{change ? "Requested change" : "Tentative preference"}</p><p className="mt-1 text-lg font-black">{shortDate(date)} at {shortTime(time)} Central</p><p className="text-xs text-slate-400">{request.selected_crew_size} movers · plan {request.planning_minutes / 60} hours · {request.work_scope}</p></div>
              {request.latest_contact_at && <p className="mb-2 text-xs text-slate-400">Last follow-up: {request.latest_contact_outcome} · {new Date(request.latest_contact_at).toLocaleString()}</p>}
              <div className="flex flex-wrap gap-2">
                {request.phone && <Button size="sm" variant="outline" asChild><a href={`tel:${request.phone}`}><PhoneCall className="mr-1 h-4 w-4" />Call</a></Button>}
                {request.email && <Button size="sm" variant="outline" asChild><a href={`mailto:${request.email}`}><Mail className="mr-1 h-4 w-4" />Email</a></Button>}
                <Button size="sm" variant="secondary" disabled={contact.isPending} onClick={() => contact.mutate({ request, outcome: "attempted" })}>Mark attempted</Button>
                <Button size="sm" variant="secondary" disabled={contact.isPending} onClick={() => contact.mutate({ request, outcome: "reached" })}>Mark reached</Button>
                {canConfirm && <Button size="sm" disabled={decision.isPending} onClick={() => decision.mutate({ request, approve: true })}><CheckCircle2 className="mr-1 h-4 w-4" />{change ? "Approve change" : "Confirm date"}</Button>}
                {canConfirm && <Button size="sm" variant="ghost" disabled={decision.isPending} onClick={() => decision.mutate({ request, approve: false })}>{change ? "Keep current time" : "Decline date"}</Button>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
