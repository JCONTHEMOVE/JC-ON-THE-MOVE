import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StaffJobForm } from "@/components/StaffJobForm";
import {
  ChevronLeft, ChevronRight, Calendar, Mail, CheckCircle2,
  Users, Clock, MapPin, ArrowLeft, Truck, Trash2, Wrench,
  Snowflake, Wind, Scissors, Package, AlertCircle, Plus, MessageCircle
} from "lucide-react";

interface ScheduledJob {
  id: number;
  orderNumber: string | null;
  customerName: string;
  serviceType: string;
  date: string;
  arrivalWindow: string | null;
  location: string | null;
  confirmedHours: number | null;
  status: string;
  crewIds: string[];
  crewNames: string[];
  crewSize: number;
  dispatchSentAt: string | null;
  dispatchNotes: string | null;
  quoteNotes: string | null;
}

interface PendingBookingHold {
  id: string;
  lead_id: string;
  service_date: string;
  start_at: string;
  crew_size: number;
  status: "pending_review" | "awaiting_deposit" | "confirmed" | "released";
  review_required: boolean;
  quote_snapshot: { quote?: { minEstimate?: number; maxEstimate?: number; travelFallback?: boolean } } | null;
  customer_name: string;
  service_type: string;
  customer_phone: string;
  total_price: string | null;
}

const SERVICE_ICONS: Record<string, any> = {
  moving: Truck,
  junk_removal: Trash2,
  handyman: Wrench,
  snow_removal: Snowflake,
  window_cleaning: Wind,
  lawn_care: Scissors,
  assembly: Package,
  labor: Users,
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  available: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  quote_requested: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

function getWeekDays(anchorDate: Date): Date[] {
  const start = new Date(anchorDate);
  const dow = start.getDay();
  start.setDate(start.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function serviceLabel(type: string): string {
  const map: Record<string, string> = {
    moving: "Moving", junk_removal: "Junk Removal", handyman: "Handyman",
    snow_removal: "Snow", window_cleaning: "Window Wash", lawn_care: "Lawn",
    assembly: "Assembly", labor: "Labor", cleaning: "Cleaning",
    trash_valet: "Trash Valet",
  };
  return map[type] || type;
}

function extractCity(address: string | null): string {
  if (!address) return "";
  const parts = address.split(",").map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return address.slice(0, 20);
}

export default function AdminSchedulePage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [anchor, setAnchor] = useState(() => new Date());
  const [dispatchingId, setDispatchingId] = useState<number | null>(null);
  const [reviewingHoldId, setReviewingHoldId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(() => dateKey(new Date()));

  const days = getWeekDays(anchor);
  const today = dateKey(new Date());

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    if (params.get("add") !== "1") return;
    const requestedDate = params.get("date");
    setAddDate(requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dateKey(new Date()));
    setAddOpen(true);
  }, [location]);

  function openAddJob(forDate: string) {
    setAddDate(forDate);
    setAddOpen(true);
  }

  function closeAddJob() {
    setAddOpen(false);
    const params = new URLSearchParams(location.split("?")[1] || "");
    if (params.get("add") === "1") setLocation("/admin/schedule");
  }

  const { data: jobs = [], isLoading } = useQuery<ScheduledJob[]>({
    queryKey: ["/api/admin/schedule"],
    refetchInterval: 60000,
  });

  const { data: pendingHolds = [] } = useQuery<PendingBookingHold[]>({
    queryKey: ["/api/admin/booking-holds"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/booking-holds");
      const data = await res.json();
      return data.holds || [];
    },
    refetchInterval: 30000,
  });

  const reviewHoldMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "release" }) => {
      setReviewingHoldId(id);
      const res = await apiRequest("PATCH", "/api/admin/booking-holds/" + id, {
        decision,
        sendDepositLink: decision === "approve",
      });
      return res.json() as Promise<{ message?: string; invoiceWarning?: string | null }>;
    },
    onSuccess: (data, variables) => {
      setReviewingHoldId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/booking-holds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedule"] });
      toast({
        title: variables.decision === "approve" ? "Hold approved" : "Hold released",
        description: data.invoiceWarning || data.message,
      });
    },
    onError: (error: Error) => {
      setReviewingHoldId(null);
      toast({ title: "Could not review hold", description: error.message, variant: "destructive" });
    },
  });

  const crewThankYouMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/crew-announcements", {
        title: "Thank you, JC ON THE MOVE Crew",
        message: "Thank you guys for all the hard work this week and helping JC ON THE MOVE LLC get closer to the goal for all of us as huge family 🙏",
      });
      return res.json() as Promise<{ eligibleCrewCount?: number; notifications?: { delivered?: number }; webhooks?: { delivered?: number } }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Crew thank-you sent",
        description: `${data.notifications?.delivered ?? 0} crew notification${(data.notifications?.delivered ?? 0) === 1 ? "" : "s"} and ${data.webhooks?.delivered ?? 0} crew-channel post${(data.webhooks?.delivered ?? 0) === 1 ? "" : "s"} delivered.`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not send crew thank-you", description: error.message, variant: "destructive" });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (jobId: number) => {
      setDispatchingId(jobId);
      const res = await apiRequest("POST", `/api/admin/leads/${jobId}/dispatch`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Dispatch failed");
      }
      return res.json();
    },
    onSuccess: (data, jobId) => {
      setDispatchingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedule"] });
      if (data.sentCount > 0) {
        toast({ title: `✅ Sent to ${data.sentCount} crew member${data.sentCount !== 1 ? "s" : ""}` });
      } else {
        toast({ title: "No emails sent", description: "Check crew has emails on file.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      setDispatchingId(null);
      toast({ title: "Dispatch failed", description: err.message, variant: "destructive" });
    },
  });

  function prevWeek() {
    setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setAnchor(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function thisWeek() { setAnchor(new Date()); }

  const jobsByDay: Record<string, ScheduledJob[]> = {};
  for (const job of jobs) {
    const key = job.date?.slice(0, 10);
    if (!key) continue;
    if (!jobsByDay[key]) jobsByDay[key] = [];
    jobsByDay[key].push(job);
  }

  const weekLabel = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const totalThisWeek = days.reduce((sum, d) => sum + (jobsByDay[dateKey(d)]?.length || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Job Schedule</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">{totalThisWeek} job{totalThisWeek !== 1 ? "s" : ""} this week</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => crewThankYouMutation.mutate()}
              disabled={crewThankYouMutation.isPending}
              data-testid="button-send-crew-thanks"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" /> {crewThankYouMutation.isPending ? "Sending…" : "Thank crew"}
            </Button>
            <Button
              size="sm"
              onClick={() => openAddJob(today)}
              className="bg-blue-600 text-white hover:bg-blue-500"
              data-testid="button-add-job-today"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add job today
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {pendingHolds.length > 0 && (
          <Card className="border-orange-400/40 bg-orange-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-orange-400" />
                Pending online holds — admin review only
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {pendingHolds.map((hold) => {
                const quote = hold.quote_snapshot?.quote;
                const estimate = quote?.minEstimate != null && quote?.maxEstimate != null
                  ? "$" + quote.minEstimate + "–$" + quote.maxEstimate
                  : "Estimate pending";
                const reviewing = reviewingHoldId === hold.id;
                return (
                  <div key={hold.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{hold.customer_name} <span className="text-muted-foreground">· {serviceLabel(hold.service_type)}</span></p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {new Date(hold.start_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {hold.crew_size} crew · {estimate}
                      </p>
                      <p className="mt-1 text-xs text-orange-600 dark:text-orange-300">
                        {quote?.travelFallback ? "Conditional travel hold" : "24-hour hold"}{hold.review_required ? " · difficulty review required" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" disabled={reviewing} onClick={() => reviewHoldMutation.mutate({ id: hold.id, decision: "release" })}>Release</Button>
                      <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-500" disabled={reviewing} onClick={() => reviewHoldMutation.mutate({ id: hold.id, decision: "approve" })}>
                        {reviewing ? "Saving…" : "Approve & request 30% deposit"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Week navigation */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={thisWeek}>Today</Button>
          <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium text-muted-foreground">{weekLabel}</span>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading schedule…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {days.map(day => {
              const key = dateKey(day);
              const isToday = key === today;
              const dayJobs = jobsByDay[key] || [];
              return (
                <div key={key} className={`rounded-xl border ${isToday ? "border-primary ring-2 ring-primary/20" : "border-border"} bg-card overflow-hidden`}>
                  {/* Day header */}
                  <div className={`px-3 py-2 text-center ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className={`text-lg font-bold ${isToday ? "" : "text-foreground"}`}>{day.getDate()}</div>
                    <div className="text-xs opacity-70">{day.toLocaleDateString("en-US", { month: "short" })}</div>
                    {dayJobs.length > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">{dayJobs.length}</Badge>
                    )}
                  </div>

                  {/* Job cards */}
                  <div className="p-2 space-y-2">
                    {dayJobs.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openAddJob(key)}
                        className={`flex w-full flex-col items-center gap-1 rounded-lg py-4 text-xs transition-colors ${
                          isToday
                            ? "text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        }`}
                        data-testid={`button-add-job-${key}`}
                      >
                        <Plus className="h-4 w-4" />
                        <span>{isToday ? "Add a job today" : "Add job"}</span>
                      </button>
                    ) : dayJobs.map(job => {
                      const Icon = SERVICE_ICONS[job.serviceType] || Truck;
                      const isDispatched = !!job.dispatchSentAt;
                      const crewFull = job.crewIds.length >= job.crewSize;
                      const isDispatchingThis = dispatchingId === job.id;
                      const city = extractCity(job.location);

                      return (
                        <div key={job.id} className="rounded-lg border border-border bg-background p-2.5 space-y-2 text-xs">
                          {/* Service + status */}
                          <div className="flex items-start gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">{serviceLabel(job.serviceType)}</div>
                              {job.orderNumber && <div className="text-muted-foreground">{job.orderNumber}</div>}
                            </div>
                            <Badge className={`text-[10px] px-1 py-0 shrink-0 ${STATUS_COLORS[job.status] || ""}`}>
                              {job.status}
                            </Badge>
                          </div>

                          {/* Customer + location */}
                          <div className="text-muted-foreground space-y-0.5">
                            <div className="font-medium text-foreground">{job.customerName}</div>
                            {city && <div className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{city}</div>}
                            {job.arrivalWindow && <div className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{job.arrivalWindow}</div>}
                            {job.confirmedHours && <div>{job.confirmedHours}h · ${(job.confirmedHours * 85).toLocaleString()}/crew</div>}
                          </div>

                          {/* Crew */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <Users className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                            {job.crewNames.length > 0
                              ? job.crewNames.map((n, i) => (
                                <span key={i} className="bg-muted rounded px-1 py-0.5">{n}</span>
                              ))
                              : <span className="text-orange-500">No crew</span>
                            }
                            {!crewFull && job.crewIds.length > 0 && (
                              <span className="text-orange-400">({job.crewIds.length}/{job.crewSize})</span>
                            )}
                          </div>

                          {/* Dispatch status + button */}
                          <div className="space-y-1">
                            {isDispatched && (
                              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Dispatched {new Date(job.dispatchSentAt!).toLocaleDateString()}</span>
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant={isDispatched ? "outline" : "default"}
                              className={`w-full h-6 text-[10px] gap-1 ${!isDispatched && job.crewIds.length > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                              disabled={isDispatchingThis || job.crewIds.length === 0}
                              onClick={() => dispatchMutation.mutate(job.id)}
                            >
                              {isDispatchingThis ? (
                                <span>Sending…</span>
                              ) : job.crewIds.length === 0 ? (
                                <><AlertCircle className="h-3 w-3" /> No crew</>
                              ) : isDispatched ? (
                                <><Mail className="h-3 w-3" /> Resend</>
                              ) : (
                                <><Mail className="h-3 w-3" /> Dispatch</>
                              )}
                            </Button>
                          </div>
                          <Link href={`/admin/jobs`}>
                            <span className="text-primary underline-offset-2 hover:underline cursor-pointer">View in Jobs →</span>
                          </Link>
                        </div>
                      );
                    })}
                    {dayJobs.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddJob(key)}
                        className="h-7 w-full gap-1 text-xs text-muted-foreground hover:text-foreground"
                        data-testid={`button-add-another-job-${key}`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add another
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming jobs beyond this week */}
        {(() => {
          const weekEnd = dateKey(days[6]);
          const upcoming = jobs.filter(j => j.date && j.date.slice(0, 10) > weekEnd);
          if (!upcoming.length) return null;
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Jobs (Beyond This Week)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {upcoming.map(job => (
                  <div key={job.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="text-sm font-medium w-24 shrink-0 text-muted-foreground">{job.date}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{serviceLabel(job.serviceType)}</span>
                      <span className="text-muted-foreground ml-2">{job.customerName}</span>
                      {job.arrivalWindow && <span className="text-muted-foreground ml-2">· {job.arrivalWindow}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.dispatchSentAt && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={dispatchMutation.isPending || job.crewIds.length === 0}
                        onClick={() => dispatchMutation.mutate(job.id)}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        {job.dispatchSentAt ? "Resend" : "Dispatch"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      <Sheet open={addOpen} onOpenChange={(open) => open ? setAddOpen(true) : closeAddJob()}>
        <SheetContent side="bottom" className="h-[94vh] overflow-y-auto rounded-t-2xl border-slate-700 bg-slate-950 text-white sm:left-auto sm:right-0 sm:top-0 sm:h-screen sm:w-[42rem] sm:max-w-[95vw] sm:rounded-none">
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5 text-blue-300" />
              Add job for {new Date(`${addDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </SheetTitle>
          </SheetHeader>
          <StaffJobForm prefilledDate={addDate} onSaved={closeAddJob} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
