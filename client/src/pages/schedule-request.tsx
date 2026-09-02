import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { exactHourlyStarts } from "@shared/jcOperations";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type ScheduleRequest = {
  id: string;
  status: "pending_confirmation" | "confirmed" | "change_requested" | "declined" | "cancelled";
  preferred_date: string;
  preferred_start_time: string;
  pending_change_date?: string | null;
  pending_change_start_time?: string | null;
  capacity_status: "open" | "limited" | "ask_jc";
  selected_crew_size: number;
  planning_minutes: number;
  service_address: string;
  work_scope: string;
  first_name: string;
  service_type: string;
  urgent: boolean;
};

function cleanDate(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function cleanTime(value: string | null | undefined) {
  return String(value || "").slice(0, 5);
}

export default function ScheduleRequestPage() {
  const [, params] = useRoute("/schedule-request/:token");
  const token = params?.token || "";
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useQuery<{ scheduleRequest: ScheduleRequest }>({
    queryKey: ["/api/public/schedule-request", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/schedule-request/${encodeURIComponent(token)}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Could not load this request.");
      return response.json();
    },
    enabled: Boolean(token),
  });
  const request = data?.scheduleRequest;
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const targetDate = date || cleanDate(request?.preferred_date);
      const targetTime = time || cleanTime(request?.preferred_start_time);
      const response = await apiRequest("PATCH", `/api/public/schedule-request/${encodeURIComponent(token)}`, { date: targetDate, time: targetTime });
      return response.json() as Promise<{ requiresStaffApproval: boolean }>;
    },
    onSuccess: (result) => {
      toast({
        title: result.requiresStaffApproval ? "Change sent to JC for approval" : "Preferred time updated",
        description: result.requiresStaffApproval ? "Your confirmed time stays in place until staff approves this request." : "This preference remains tentative until staff confirms it.",
      });
      setDate("");
      setTime("");
      refetch();
    },
    onError: (error: Error) => toast({ title: "Could not update the request", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" }),
  });

  if (isLoading) return <div className="min-h-screen bg-slate-950 p-8 text-center text-slate-300">Loading your schedule request…</div>;
  if (isError || !request) return <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100"><Card className="mx-auto max-w-lg border-red-500/30 bg-red-500/5"><CardContent className="p-7 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-red-300" /><h1 className="mt-3 text-xl font-black">This link is unavailable</h1><p className="mt-2 text-slate-300">It may be expired. Call JC ON THE MOVE at (906) 285-9312 for help.</p></CardContent></Card></div>;

  const isConfirmed = request.status === "confirmed" || request.status === "change_requested";
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">JC ON THE MOVE</p><h1 className="mt-2 text-3xl font-black">Manage your requested date</h1></div>
        <Card className="border-slate-700 bg-slate-900/95 text-slate-100">
          <CardHeader>
            <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-blue-300" /><CardTitle>{isConfirmed ? "Confirmed schedule" : "Tentative preference"}</CardTitle></div>
            <CardDescription>{isConfirmed ? "Changes now require staff approval so the existing crew plan is protected." : "This preference does not reserve crew until JC confirms it."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-950/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Date</p><p className="mt-1 text-lg font-black">{cleanDate(request.preferred_date)}</p></div>
              <div className="rounded-xl bg-slate-950/70 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Start</p><p className="mt-1 text-lg font-black">{cleanTime(request.preferred_start_time)} Central</p></div>
            </div>
            <div className="grid gap-2 text-sm text-slate-300"><p><strong className="text-slate-100">Service:</strong> {request.service_type.replace(/_/g, " ")}</p><p><strong className="text-slate-100">Address:</strong> {request.service_address}</p><p><strong className="text-slate-100">Crew planning:</strong> {request.selected_crew_size} movers for up to {request.planning_minutes / 60} hours</p><p><strong className="text-slate-100">Scope:</strong> {request.work_scope}</p></div>
            {request.status === "change_requested" && <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"><Clock3 className="mr-2 inline h-4 w-4" />Pending change: {cleanDate(request.pending_change_date)} at {cleanTime(request.pending_change_start_time)} Central. The confirmed time above remains active.</div>}
            {request.urgent && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">This request is within 48 hours and is flagged urgent for staff.</div>}
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100"><CheckCircle2 className="mr-2 inline h-4 w-4" />Current capacity signal: <strong className="capitalize">{request.capacity_status.replace("_", " ")}</strong></div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900/95 text-slate-100">
          <CardHeader><CardTitle>{isConfirmed ? "Request a different time" : "Change your preference"}</CardTitle><CardDescription>Exact hourly starts are available from 8:00 AM through 5:00 PM Central.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-semibold">Date<Input type="date" min={new Date().toISOString().slice(0, 10)} value={date || cleanDate(request.preferred_date)} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="grid gap-1 text-sm font-semibold">Time<select className="field-select" value={time || cleanTime(request.preferred_start_time)} onChange={(event) => setTime(event.target.value)}>{exactHourlyStarts().map((start) => <option value={start} key={start}>{start} Central</option>)}</select></label>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : isConfirmed ? "Request change" : "Save preference"}</Button>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-slate-400">Need help now? <a className="font-bold text-blue-300" href="tel:9062859312">Call (906) 285-9312</a></p>
      </div>
    </div>
  );
}
