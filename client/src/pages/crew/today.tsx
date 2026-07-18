import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, clearTokens, queryClient as qc } from "@/lib/queryClient";
import { notificationService } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sun, Cloud, CloudSnow, CloudRain, Zap, Wind, BookOpen,
  Wifi, WifiOff, Coins, MapPin, Calendar, ChevronRight, Loader2, Trophy,
  XCircle, Plus, LogOut, Briefcase, Users, CheckCircle2,
  ChevronDown, ChevronLeft, Ban, Settings2, Navigation, Play, Flag,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Lead, User } from "@shared/schema";
import type { JobFlow } from "@shared/job-flow";
import { UserStatusBar } from "@/components/UserStatusBar";
import { PaymentStatusPill } from "@/components/PaymentStatusPill";
import { LevelBadge } from "@/components/LevelBadge";
import { WorkerBadge } from "@/components/WorkerBadge";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { getWorkerLevel, type LoyaltyTierKey } from "@/lib/loyalty";
import { useAdminViewMode } from "@/hooks/useAdminViewMode";
import ProcessFlowCard, { type ProcessFlowStep } from "@/components/ProcessFlowCard";
import MarketplaceShapeBadge from "@/components/MarketplaceShapeBadge";

const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

type JobBoardLead = {
  id: string;
  serviceType: string;
  fromAddress: string | null;
  toAddress: string | null;
  moveDate: string | null;
  crewSize: number | null;
  status: string;
  price: string | null;
  details: string | null;
  estimatedTokens: number;
  alreadyApplied: boolean;
  crewSlotsFilled: number;
  flow: JobFlow;
};

type FlowLead = Lead & { flow?: JobFlow };

type TrashJobSub = {
  customerName: string;
  address: string;
  city: string;
  phone: string;
};

type TrashJob = {
  id: string;
  subscriptionId: string;
  serviceWeekOf: string;
  status: string;
  cans: number;
  bagCount: number;
  isRecyclingWeek: boolean;
  jobValue: string;
};

type TrashJobRow = {
  job: TrashJob;
  sub: TrashJobSub;
};

const SCRIPTURES = [
  { text: "Commit your work to the Lord, and your plans will be established.", ref: "Proverbs 16:3" },
  { text: "Whatever you do, work heartily, as for the Lord and not for men.", ref: "Colossians 3:23" },
  { text: "For I know the plans I have for you, declares the Lord.", ref: "Jeremiah 29:11" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "Be strong and courageous. Do not be afraid.", ref: "Joshua 1:9" },
  { text: "Work with enthusiasm, as though working for the Lord.", ref: "Ephesians 6:7" },
];

const MOVER_QUOTES = [
  { text: "Lift with your legs, not your ego.", ref: "Mover Wisdom" },
  { text: "Every heavy load moved is a family's fresh start.", ref: "Crew Philosophy" },
  { text: "Show up early. Work hard. Go home proud.", ref: "Crew Code" },
];

function getDayOfYear() {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

function getWeatherInfo(code: number) {
  if (code === 0) return { label: "Clear Sky", Icon: Sun, color: "text-yellow-400", isSnow: false };
  if (code <= 2) return { label: "Partly Cloudy", Icon: Cloud, color: "text-slate-300", isSnow: false };
  if (code <= 67) return { label: "Rainy", Icon: CloudRain, color: "text-blue-400", isSnow: false };
  if (code <= 77) return { label: "Snowing", Icon: CloudSnow, color: "text-cyan-300", isSnow: true };
  if (code <= 86) return { label: "Snow Showers", Icon: CloudSnow, color: "text-cyan-300", isSnow: true };
  return { label: "Thunderstorm", Icon: Zap, color: "text-purple-400", isSnow: false };
}

function getWeatherIconForCode(code: number) {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const SERVICE_ICONS: Record<string, string> = {
  moving: "🚛", labor: "💪", residential: "🏠", junk: "🗑️", snow: "❄️",
  cleaning: "✨", handyman: "🔧", demolition: "⚒️", flooring: "🪵", painting: "🎨",
  window_cleaning: "🪟", trash_valet: "🗑️",
};

function isSummerSeason(): boolean {
  const month = new Date().getMonth() + 1;
  return month >= 5 && month <= 9;
}

function getAvailableTimeSlots(): Date[] {
  const now = new Date();
  const maxHour = isSummerSeason() ? 20 : 18;
  const slots: Date[] = [];
  let hour = now.getHours() + 1;
  while (hour <= maxHour) {
    const slot = new Date(now);
    slot.setHours(hour, 0, 0, 0);
    slots.push(slot);
    hour += 1;
  }
  return slots;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatCountdown(until: Date): string {
  const diff = until.getTime() - Date.now();
  if (diff <= 0) return "Expiring…";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function dedupeLeadsById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getBeaconKey(userId: string | number) {
  return `jcmoves_beacon_${userId}`;
}

function readBeaconFromStorage(userId: string | number): { isAvailable: boolean; availableUntil: Date | null } {
  try {
    const raw = localStorage.getItem(getBeaconKey(userId));
    if (!raw) return { isAvailable: false, availableUntil: null };
    const parsed = JSON.parse(raw);
    const until = parsed.availableUntil ? new Date(parsed.availableUntil) : null;
    if (!until || until.getTime() <= Date.now()) {
      localStorage.removeItem(getBeaconKey(userId));
      return { isAvailable: false, availableUntil: null };
    }
    return { isAvailable: Boolean(parsed.isAvailable), availableUntil: until };
  } catch {
    return { isAvailable: false, availableUntil: null };
  }
}

function writeBeaconToStorage(userId: string | number, isAvailable: boolean, availableUntil: Date | null) {
  try {
    if (!isAvailable || !availableUntil) {
      localStorage.removeItem(getBeaconKey(userId));
    } else {
      localStorage.setItem(getBeaconKey(userId), JSON.stringify({
        isAvailable: true,
        availableUntil: availableUntil.toISOString(),
      }));
    }
  } catch { /* ignore */ }
}

function getDashboardDismissKey(userId: string | number, kind: string) {
  return `jcmoves_dashboard_dismissed_${kind}_${userId}`;
}

function readDismissedIds(userId: string | number | undefined, kind: string): string[] {
  if (!userId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getDashboardDismissKey(userId, kind));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(userId: string | number | undefined, kind: string, ids: string[]) {
  if (!userId || typeof window === "undefined") return;
  localStorage.setItem(getDashboardDismissKey(userId, kind), JSON.stringify(Array.from(new Set(ids))));
}

type PositioningResponse =
  | { muted: true }
  | {
      best: { zoneName: string; score: number } | null;
      current: { zoneName: string; score: number } | null;
      shouldRelocate: boolean;
      headline: string;
      detail: string;
      targetZone: { code: string; name: string; lat: number; lng: number; dispatchBonusPct: number } | null;
    };

function CrewPositioningCard({ hasAcceptedJobs }: { hasAcceptedJobs: boolean }) {
  const { data } = useQuery<PositioningResponse>({
    queryKey: ["/api/crew/positioning"],
    refetchInterval: 45000,
    enabled: !hasAcceptedJobs,
  });
  // Only surface when crew is idle, suggestion present, not muted, and
  // the best zone is genuinely hot (score > 0.6).
  if (hasAcceptedJobs) return null;
  if (!data || "muted" in data) return null;
  if (!data.best) return null;
  if (data.best.score <= 0.6) return null;
  const isHot = data.shouldRelocate;
  const color = isHot
    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  const tz = data.targetZone;
  const mapsHref = tz
    ? `https://www.google.com/maps/dir/?api=1&destination=${tz.lat},${tz.lng}`
    : null;
  const bonusTag = tz && tz.dispatchBonusPct > 0
    ? `+${tz.dispatchBonusPct}% dispatch bonus`
    : "bonus offers may arrive";
  const content = (
    <div className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:opacity-90 transition-opacity ${color}`}>
      <span className="text-xl">{isHot ? "📍" : "✅"}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold">{data.headline}</p>
        <p className="text-slate-300 text-[11px] truncate">
          {data.detail} · {bonusTag}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 opacity-70" />
    </div>
  );
  if (mapsHref) {
    return (
      <a href={mapsHref} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}

export default function CrewTodayPage() {
  const { user } = useAuth();
  const { isCrewPreview } = useAdminViewMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isAdmin = ["admin", "business_owner"].includes(user?.role || "") && !isCrewPreview;

  const dayOfYear = getDayOfYear();
  const scriptureOfDay = SCRIPTURES[dayOfYear % SCRIPTURES.length];
  const moverQuoteOfDay = MOVER_QUOTES[dayOfYear % MOVER_QUOTES.length];

  const [scriptureClaimed, setScriptureClaimed] = useState(false);
  const [claimStreak, setClaimStreak] = useState<number>(0);

  const userRecord = user as User & { isAvailable?: boolean; availableUntil?: string | null };

  const [dutyStatus, setDutyStatus] = useState<boolean>(() => {
    if (typeof window !== "undefined" && user?.id) {
      const stored = readBeaconFromStorage(user.id);
      if (stored.isAvailable) return true;
    }
    return Boolean(userRecord?.isAvailable);
  });
  const [availableUntil, setAvailableUntil] = useState<Date | null>(() => {
    if (typeof window !== "undefined" && user?.id) {
      const stored = readBeaconFromStorage(user.id);
      if (stored.isAvailable && stored.availableUntil) return stored.availableUntil;
    }
    return userRecord?.availableUntil ? new Date(userRecord.availableUntil) : null;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [assignmentsExpanded, setAssignmentsExpanded] = useState(false);
  const [dismissedBoardJobIds, setDismissedBoardJobIds] = useState<string[]>(() => readDismissedIds(user?.id, "board_jobs"));

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);

  const timeSlots = useMemo(() => getAvailableTimeSlots(), [showTimePicker]);

  useEffect(() => {
    setDismissedBoardJobIds(readDismissedIds(user?.id, "board_jobs"));
  }, [user?.id]);

  const { data: calendarData, isLoading: calendarLoading } = useQuery<{
    jobs: { id: string; serviceType: string; fromAddress: string | null; confirmedDate: string | null; moveDate: string | null; effectiveDate: string | null; confirmedFromAddress: string | null; status: string; confirmedHours: number | null }[];
    blocks: { id: number; date: string; reason: string | null }[];
    hourOverrides: { id: number; date: string; startHour: number; endHour: number; note: string | null }[];
  }>({
    queryKey: ["/api/workers/calendar", calYear, calMonth],
    queryFn: async () => {
      const res = await fetch(`/api/workers/calendar?year=${calYear}&month=${calMonth}`, { credentials: "include" });
      return res.json();
    },
  });

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  function getCalDayStr(day: number) {
    return `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getEffDateStr(j: { effectiveDate: string | null; confirmedDate: string | null; moveDate: string | null }) {
    return (j.effectiveDate || j.confirmedDate || j.moveDate || "").slice(0, 10);
  }

  function quickAddJobHref(dateStr: string) {
    return `/leads?tab=add&date=${dateStr}`;
  }

  function goToPrevCalMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function goToNextCalMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  // Sync duty state when user data arrives — but only override if localStorage beacon is expired
  useEffect(() => {
    if (!user) return;
    const u = user as User & { isAvailable?: boolean; availableUntil?: string | null };
    const stored = readBeaconFromStorage(user.id);
    if (stored.isAvailable) {
      setDutyStatus(true);
      setAvailableUntil(stored.availableUntil);
    } else {
      setDutyStatus(Boolean(u.isAvailable));
      setAvailableUntil(u.availableUntil ? new Date(u.availableUntil) : null);
    }
  }, [user?.id]);

  // Update countdown every 30 seconds
  useEffect(() => {
    if (!dutyStatus || !availableUntil) { setCountdown(""); return; }
    const update = () => setCountdown(formatCountdown(availableUntil));
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [dutyStatus, availableUntil]);

  // Task #173 — GPS beacon moved to CrewLayout (via useCrewGpsBeacon) so
  // location continues streaming across /crew/jobs, /crew/schedule, and
  // /crew/earnings while on duty instead of only while Today is mounted.

  // Heartbeat every 60 seconds while online
  useEffect(() => {
    if (dutyStatus) {
      heartbeatRef.current = setInterval(async () => {
        try {
          const res = await apiRequest("POST", "/api/crew/heartbeat", {});
          const data = await res.json();
          if (data.expired) {
            setDutyStatus(false);
            setAvailableUntil(null);
            if (user?.id) writeBeaconToStorage(user.id, false, null);
            queryClient.invalidateQueries({ queryKey: ["/api/employees/available"] });
            toast({ title: "⏰ Shift Ended", description: "Your availability window has expired." });
          }
        } catch {
          // silent
        }
      }, 60_000);
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    }
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [dutyStatus]);

  // Client-side expiry check
  useEffect(() => {
    if (!availableUntil || !dutyStatus) return;
    const msUntilExpiry = availableUntil.getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      setDutyStatus(false);
      setAvailableUntil(null);
      if (user?.id) writeBeaconToStorage(user.id, false, null);
      return;
    }
    const t = setTimeout(() => {
      setDutyStatus(false);
      setAvailableUntil(null);
      if (user?.id) writeBeaconToStorage(user.id, false, null);
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available"] });
      toast({ title: "⏰ Shift Ended", description: "Your availability window has expired." });
    }, msUntilExpiry);
    return () => clearTimeout(t);
  }, [availableUntil, dutyStatus]);

  const { data: leads = [] } = useQuery<FlowLead[]>({
    queryKey: [isAdmin ? "/api/jobs/flow?scope=admin" : "/api/jobs/flow?scope=mine"],
    refetchInterval: 15000,
    staleTime: 0,
  });

  const { data: boardJobs = [] } = useQuery<JobBoardLead[]>({
    queryKey: ["/api/jobs/flow?scope=board"],
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 15000,
  });

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [claimedJobId, setClaimedJobId] = useState<string | null>(null);
  const [workerCelebration, setWorkerCelebration] = useState<{ tokens: number } | null>(null);
  const prevCompletedIdsRef = useRef<Set<string>>(new Set());
  const applyMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/jobs/${leadId}/claim`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to sign up" }));
        throw new Error(err.error || "Failed to sign up");
      }
      return res.json();
    },
    onSuccess: (_data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=mine"] });
      setApplyingId(null);
      setClaimedJobId(leadId);
      toast({ title: "Job claimed", description: "Admin will confirm the crew and dispatch it when ready." });
      navigate(`/crew/jobs?lead=${encodeURIComponent(leadId)}`);
    },
    onError: (e: Error) => {
      setApplyingId(null);
      toast({ title: "Couldn't sign up", description: e.message, variant: "destructive" });
    },
  });

  // Task #173 — state machine mutations for inline My Assignments actions.
  const [statusPending, setStatusPending] = useState<string | null>(null);
  const statusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: "en_route"|"on_site"|"completed" }) => {
      const res = await apiRequest("POST", `/api/crew/jobs/${leadId}/status`, { status });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Couldn't update status" }));
        throw new Error(err.error || "Couldn't update status");
      }
      return res.json();
    },
    onMutate: ({ leadId }) => setStatusPending(leadId),
    onSuccess: (_d, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=admin"] });
      // Refresh earnings on completion so base + bonus appear immediately.
      if (status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/wallet"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/rewards/balance"] });
      }
      setStatusPending(null);
      const labels: Record<string, string> = { en_route: "🚚 En route", on_site: "📍 On site", completed: "✅ Job complete!" };
      toast({ title: labels[status] });
    },
    onError: (e: Error) => {
      setStatusPending(null);
      toast({ title: "Status update failed", description: e.message, variant: "destructive" });
    },
  });
  const [acceptPending, setAcceptPending] = useState<string | null>(null);
  const acceptOfferMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/crew/jobs/${leadId}/accept`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Offer no longer yours" }));
        throw new Error(err.error || "Offer no longer yours");
      }
      return res.json();
    },
    onMutate: (leadId) => setAcceptPending(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=admin"] });
      setAcceptPending(null);
      toast({ title: "✅ Offer accepted", description: "Tap Start when en route." });
    },
    onError: (e: Error) => {
      setAcceptPending(null);
      toast({ title: "Couldn't accept", description: e.message, variant: "destructive" });
    },
  });

  const [declinePending, setDeclinePending] = useState<string | null>(null);
  const declineOfferMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", `/api/crew/jobs/${leadId}/decline`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Couldn't decline" }));
        throw new Error(err.error || "Couldn't decline");
      }
      return res.json();
    },
    onMutate: (leadId) => setDeclinePending(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/flow?scope=admin"] });
      setDeclinePending(null);
      toast({ title: "Offer declined", description: "We'll route it to the next crew." });
    },
    onError: (e: Error) => {
      setDeclinePending(null);
      toast({ title: "Couldn't decline", description: e.message, variant: "destructive" });
    },
  });

  const { data: employees = [] } = useQuery<User[]>({ queryKey: ["/api/employees"] });
  const { data: wallet } = useQuery<{ balance: string }>({ queryKey: ["/api/rewards/balance"] });
  const { data: stakingPerk } = useQuery<{ stakedTotal: number; perkPercent: number; perkLabel: string }>({
    queryKey: ["/api/staking/my-perk"],
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: trashJobsData = [] } = useQuery<TrashJobRow[]>({
    queryKey: ["/api/trash/jobs"],
    refetchInterval: 30000,
    staleTime: 0,
  });
  const trashJobsThisWeek = trashJobsData.filter(row => row.job.status !== "cancelled");

  const [trashPhotoUrls, setTrashPhotoUrls] = useState<Record<string, string>>({});

  const trashActionMutation = useMutation<unknown, Error, { jobId: string; action: string; photoUrl?: string }>({
    mutationFn: async ({ jobId, action, photoUrl }) => {
      const body = photoUrl ? { photoUrl } : {};
      const res = await apiRequest("PATCH", `/api/trash/jobs/${jobId}/${action}`, body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Action failed" }));
        throw new Error((err as { error?: string }).error || "Action failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trash/jobs"] });
      toast({ title: "✅ Updated", description: "Trash job status updated." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    },
  });

  const { data: weather } = useQuery({
    queryKey: ["weather-ironwood"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=46.4547&longitude=-90.1712&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=7&timezone=America%2FChicago"
      );
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  const { data: streakData } = useQuery<{ claimedToday: boolean; streak: number; nextStreak: number }>({
    queryKey: ["/api/mining/scripture-streak"],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (streakData) {
      setScriptureClaimed(streakData.claimedToday);
      setClaimStreak(streakData.streak);
    }
  }, [streakData]);

  // Detect worker-side job completion (job I was assigned to just moved to "completed")
  useEffect(() => {
    if (!user?.id || !leads.length) return;
    const myCompletedJobs = leads.filter(l => {
      if (l.status !== "completed") return false;
      const members: string[] = Array.isArray(l.crewMembers) ? (l.crewMembers as string[]) : [];
      return members.includes(String(user.id)) || l.assignedToUserId === String(user.id);
    });
    const newlyCompleted = myCompletedJobs.filter(j => !prevCompletedIdsRef.current.has(j.id));
    if (newlyCompleted.length > 0 && prevCompletedIdsRef.current.size > 0) {
      const job = newlyCompleted[0];
      const estimatedTokens = Number((job as typeof job & { estimatedTokens?: number | string }).estimatedTokens ?? 0);
      const est = estimatedTokens > 0 ? estimatedTokens : 100;
      setWorkerCelebration({ tokens: est });
      setTimeout(() => setWorkerCelebration(null), 4000);
    }
    prevCompletedIdsRef.current = new Set(myCompletedJobs.map(j => j.id));
  }, [leads, user?.id]);

  const scriptureClaimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/scripture-claim", {});
      return res.json();
    },
    onSuccess: (data) => {
      setScriptureClaimed(true);
      setClaimStreak(data.streak);
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mining/scripture-streak"] });
      const isWeekComplete = data.streak % 7 === 0;
      toast({
        title: isWeekComplete
          ? `🏆 Week Complete! +${data.amount} JCMOVES!`
          : `🎉 +${data.amount} JCMOVES claimed!`,
        description: `Day ${data.streak} streak! 🔥`,
      });
      notificationService.notifyNewReward("scripture claim", data.amount);
    },
    onError: (e: Error) => {
      if (e?.message?.includes("Already claimed")) {
        setScriptureClaimed(true);
        toast({ title: "Already claimed today", description: "Come back tomorrow!" });
      } else {
        toast({ title: "Couldn't claim", description: e?.message, variant: "destructive" });
      }
    },
  });

  const goOnlineMutation = useMutation({
    mutationFn: async (until: Date) => {
      const res = await apiRequest("POST", "/api/crew/go-online", { availableUntil: until.toISOString() });
      return res.json();
    },
    onSuccess: (_, until) => {
      setDutyStatus(true);
      setAvailableUntil(until);
      setShowTimePicker(false);
      if (user?.id) writeBeaconToStorage(user.id, true, until);
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available"] });
      // Task #173 — kick auth cache so useCrewGpsBeacon (app-shell)
      // sees isAvailable=true immediately instead of up to 60s later.
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: `🟢 Online until ${formatTime(until)}`, description: "You'll appear for job dispatch." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const goOfflineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crew/go-offline", {});
      return res.json();
    },
    onSuccess: () => {
      setDutyStatus(false);
      setAvailableUntil(null);
      setShowTimePicker(false);
      if (user?.id) writeBeaconToStorage(user.id, false, null);
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available"] });
      // Task #173 — kick auth cache so GPS beacon stops quickly.
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "🔴 You're OFF DUTY", description: "You won't appear in available crews." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const extendMutation = useMutation({
    mutationFn: async (until: Date) => {
      const res = await apiRequest("POST", "/api/crew/go-online", { availableUntil: until.toISOString() });
      return res.json();
    },
    onSuccess: (_, until) => {
      setAvailableUntil(until);
      setShowTimePicker(false);
      if (user?.id) writeBeaconToStorage(user.id, true, until);
      toast({ title: `⏰ Extended until ${formatTime(until)}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const today = new Date();
  const todayStr = today.toDateString();

  const upcomingBoardJobs = useMemo(() => {
    return boardJobs
      .filter(j => !j.alreadyApplied && (j.crewSize || 2) > j.crewSlotsFilled)
      .sort((a, b) => {
        const da = a.moveDate ? new Date(a.moveDate.split("T")[0]).getTime() : Infinity;
        const db = b.moveDate ? new Date(b.moveDate.split("T")[0]).getTime() : Infinity;
        return da - db;
      });
  }, [boardJobs]);

  const visibleUpcomingBoardJobs = useMemo(() => {
    const dismissed = new Set(dismissedBoardJobIds);
    return upcomingBoardJobs.filter((job) => !dismissed.has(job.id));
  }, [upcomingBoardJobs, dismissedBoardJobIds]);

  function dismissBoardJobNotice(jobId: string) {
    setDismissedBoardJobIds((current) => {
      const next = Array.from(new Set([...current, jobId]));
      writeDismissedIds(user?.id, "board_jobs", next);
      return next;
    });
  }

  const todayJobs = useMemo(() => {
    const jobsForToday = leads.filter(l => {
      const dateStr = l.confirmedDate || l.moveDate;
      if (!dateStr) return false;
      const parts = dateStr.split("T")[0].split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toDateString() === todayStr && !["cancelled", "completed", "paid"].includes(l.status);
    });
    return dedupeLeadsById(jobsForToday);
  }, [leads, todayStr]);

  const myAssignments = useMemo(() => {
    const assignedLeads = leads.filter(l => {
      if (["cancelled", "completed", "paid"].includes(l.status)) return false;
      const members: string[] = Array.isArray(l.crewMembers) ? (l.crewMembers as string[]) : [];
      return members.includes(String(user?.id)) || l.assignedToUserId === String(user?.id);
    });
    return dedupeLeadsById(assignedLeads);
  }, [leads, user?.id]);

  const completedLeads = leads.filter(l => l.status === "completed");
  const { leaderboard, myRank, myCount, allTimeJobCounts } = useMemo(() => {
    // Attribute each completed job to all crew members who worked it (crewMembers array)
    // and the assigned lead (assignedToUserId). This is the correct worker metric.
    const attributeJobToWorkers = (l: typeof completedLeads[number], counts: Record<string, number>) => {
      const members: string[] = Array.isArray(l.crewMembers) ? (l.crewMembers as string[]) : [];
      if (l.assignedToUserId && !members.includes(l.assignedToUserId)) {
        members.push(l.assignedToUserId);
      }
      members.forEach(id => {
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
    };

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeekCompleted = completedLeads.filter(l => {
      const d = l.confirmedDate || l.moveDate || l.createdAt;
      return d ? new Date(d as string) >= startOfWeek : false;
    });
    const weekCounts: Record<string, number> = {};
    (thisWeekCompleted.length > 0 ? thisWeekCompleted : completedLeads).forEach(l => {
      attributeJobToWorkers(l, weekCounts);
    });
    const allTimeCounts: Record<string, number> = {};
    completedLeads.forEach(l => {
      attributeJobToWorkers(l, allTimeCounts);
    });
    const sorted = employees
      .filter(e => weekCounts[e.id])
      .map(e => ({ ...e, count: weekCounts[e.id] as number, allTimeCount: allTimeCounts[e.id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
    const myIdx = sorted.findIndex(e => e.id === String(user?.id));
    return {
      leaderboard: sorted.slice(0, 3),
      myRank: myIdx >= 0 ? myIdx + 1 : null,
      myCount: myIdx >= 0 ? sorted[myIdx].count : 0,
      allTimeJobCounts: allTimeCounts,
    };
  }, [completedLeads, employees, user?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const firstName = user?.firstName || user?.username || "Crew";
  const tokenBalance = wallet?.balance ? parseFloat(wallet.balance).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";
  const wx = weather?.current;
  const wxInfo = wx ? getWeatherInfo(wx.weather_code) : null;
  const WxIcon = wxInfo?.Icon ?? Cloud;
  const medals = ["🥇", "🥈", "🥉"];
  const isPending = goOnlineMutation.isPending || goOfflineMutation.isPending || extendMutation.isPending;

  const displayStreak = claimStreak || (streakData?.streak ?? 0);
  const nextClaimDay = (displayStreak % 7) + 1;
  const isWeekComplete = scriptureClaimed && displayStreak % 7 === 0 && displayStreak > 0;
  const isWeekCompleteNext = !scriptureClaimed && nextClaimDay === 7;

  async function handleLogout() {
    try { await apiRequest("POST", "/api/auth/logout", {}); } catch { /* ignore */ }
    clearTokens();
    qc.clear();
    window.location.href = "/";
  }

  type ForecastDay = { day: string; hi: number; lo: number; code: number; precip: number };
  const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const forecastDays: ForecastDay[] = weather?.daily?.time?.map((dateStr: string, i: number) => {
    const d = new Date(dateStr + "T12:00:00");
    return {
      day: DAYS_SHORT[d.getDay()],
      hi: Math.round(weather.daily.temperature_2m_max[i]),
      lo: Math.round(weather.daily.temperature_2m_min[i]),
      code: weather.daily.weather_code[i] as number,
      precip: weather.daily.precipitation_sum[i] as number,
    };
  }) ?? [];

  // Task #173 — sticky mobile bottom action bar. Surfaces the single
  // primary state-advance button for the crew's active assignment so
  // the driver doesn't have to scroll back up a long page mid-move.
  // Picks the first assignment the user is on that is not yet completed
  // and is past the offering stage. Hidden on md+ where the inline row
  // is already visible on screen.
  type ActiveStep = "accepted" | "en_route" | "on_site";
  const primaryActiveJob: { job: Lead; ds: ActiveStep } | null = (() => {
    const uid = user?.id ? String(user.id) : null;
    if (!uid) return null;
    for (const job of myAssignments) {
      const rawDs = String(job.dispatchState ?? "").toLowerCase();
      const members: string[] = Array.isArray(job.crewMembers) ? job.crewMembers : [];
      if (!members.includes(uid)) continue;
      // Only surface sticky bar when state is an explicit actionable value.
      // Avoid defaulting unknown / pending / offering / completed to actionable.
      const ds: ActiveStep | null =
        rawDs === "accepted" ? "accepted"
        : rawDs === "en_route" ? "en_route"
        : rawDs === "on_site" ? "on_site"
        : null;
      if (!ds) continue;
      return { job, ds };
    }
    return null;
  })();
  const primaryNext: { label: string; next: "en_route"|"on_site"|"completed" } | null = primaryActiveJob
    ? (primaryActiveJob.ds === "on_site" ? { label: "Mark Complete", next: "completed" }
      : primaryActiveJob.ds === "en_route" ? { label: "I've Arrived", next: "on_site" }
      : { label: "Start — En Route", next: "en_route" })
    : null;
  const completedToday = completedLeads.some((lead) => {
    const dateStr = lead.completedAt || lead.confirmedDate || lead.moveDate || lead.createdAt;
    if (!dateStr) return false;
    return new Date(dateStr as string).toDateString() === todayStr;
  });
  const hasActiveWork = myAssignments.length > 0 || todayJobs.length > 0;
  const hasOpenWork = visibleUpcomingBoardJobs.length > 0;
  const crewProcessSteps: ProcessFlowStep[] = [
    {
      phase: "start",
      label: "Create demand",
      detail: "Share a tracked ad, add a customer lead, or watch the board for new cards.",
      state: hasOpenWork || hasActiveWork ? "done" : "active",
      href: "/crew/marketing",
      actionLabel: "Make an ad",
    },
    {
      phase: "progress",
      label: "Work the card",
      detail: "Quote, accept, assign, start en route, and keep the job status moving.",
      state: hasActiveWork ? "done" : hasOpenWork ? "active" : "waiting",
      href: "/crew/jobs",
      actionLabel: "Open jobs",
    },
    {
      phase: "finish",
      label: "Close the loop",
      detail: "Mark complete so payment, cash payout, JCMOVES, and reviews can happen once.",
      state: completedToday ? "done" : hasActiveWork ? "active" : "waiting",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-4 space-y-3">

      {/* Hero — compact */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/60 via-slate-800/80 to-slate-900 border border-blue-500/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-blue-300 text-xs font-medium">{greeting} 👋</p>
            <h1 className="text-xl font-black text-white">{firstName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-slate-500">Balance</p>
              <p className="text-base font-black text-purple-400">{tokenBalance}</p>
              <p className="text-[10px] text-slate-500">JCMOVES</p>
              {stakingPerk && stakingPerk.perkPercent > 0 && (
                <div className="inline-flex items-center gap-1 bg-orange-500/15 border border-orange-500/30 rounded-full px-2 py-0.5 mt-1">
                  <span className="text-[10px] font-bold text-orange-300">🔒 {stakingPerk.perkPercent}% off</span>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-slate-500 hover:text-red-400 transition-colors text-xs p-1.5 rounded-lg hover:bg-red-500/10"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Availability Toggle — compact */}
        {dutyStatus ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-300 text-xs font-bold">
                  ON DUTY{availableUntil ? ` — until ${formatTime(availableUntil)}` : ""}
                </span>
                {countdown && <span className="text-green-400/60 text-[10px]">· {countdown}</span>}
              </div>
              <div className="w-9 h-4 rounded-full bg-green-500 relative flex-shrink-0">
                <div className="absolute top-0.5 left-4.5 w-3 h-3 rounded-full bg-white shadow" style={{left: '18px'}} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowTimePicker(v => !v)}
                className="flex-1 border-green-500/30 text-green-300 hover:bg-green-500/10 h-6 text-[11px]"
              >
                <Plus className="h-2.5 w-2.5 mr-1" /> Extend
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => goOfflineMutation.mutate()}
                className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border-0 h-6 text-[11px]"
              >
                {goOfflineMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-2.5 w-2.5 mr-1" /> Go Offline</>}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowTimePicker(v => !v)}
            disabled={isPending}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-600/40 bg-slate-800/60 text-slate-400 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5" />
              <span className="text-xs font-bold">OFF DUTY — tap to set availability</span>
            </div>
            <div className="w-9 h-4 rounded-full bg-slate-600 relative flex-shrink-0">
              <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow" />
            </div>
          </button>
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <div className="mt-2 bg-slate-900/80 border border-slate-700/50 rounded-xl p-2.5">
            <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">
              {dutyStatus ? "Extend until…" : "Available until…"}
            </p>
            {timeSlots.length === 0 ? (
              <p className="text-slate-500 text-xs">No time slots available today (past closing time).</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {timeSlots.map(slot => (
                  <button
                    key={slot.toISOString()}
                    disabled={isPending}
                    onClick={() => dutyStatus ? extendMutation.mutate(slot) : goOnlineMutation.mutate(slot)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {formatTime(slot)}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowTimePicker(false)}
              className="mt-2 text-slate-500 text-xs hover:text-slate-400"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Tier & balance status — shows worker level for crew members */}
      <UserStatusBar variant="dark" jobCount={allTimeJobCounts[String(user?.id)] ?? 0} />

      <ProcessFlowCard
        title="Today's work loop"
        steps={crewProcessSteps}
        compact
      />

      {/* Worker-side job completion celebration overlay */}
      {workerCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <ConfettiBurst active variant="overlay" />
          <div className="bg-slate-900/95 border border-green-500/50 rounded-2xl p-6 text-center shadow-2xl mx-4 pointer-events-auto">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-white font-bold text-lg">Job Complete!</p>
            <p className="text-green-400 font-semibold text-sm mt-1">
              +{workerCelebration.tokens.toLocaleString()} JCMOVES earned
            </p>
            <button
              onClick={() => setWorkerCelebration(null)}
              className="mt-3 text-xs text-slate-400 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Task #174 — Crew positioning card (only when on-duty, no accepted jobs, hot zone) */}
      {dutyStatus && <CrewPositioningCard hasAcceptedJobs={myAssignments.length > 0} />}

      {/* Dynamic Earn More shortcut — context-aware fastest path */}
      {(() => {
        const notClaimed = !streakData?.claimedToday;
        const offline = !dutyStatus;
        const myWeekTokens = allTimeJobCounts[String(user?.id)] ?? 0;
        if (notClaimed) {
          return (
            <Link href="/mining">
              <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 cursor-pointer hover:bg-amber-500/15 transition-colors">
                <span className="text-xl">🪙</span>
                <div className="flex-1">
                  <p className="text-amber-300 text-xs font-bold">Claim your daily reward</p>
                  <p className="text-slate-400 text-[11px]">Streak day {(streakData?.streak ?? 0) + 1} — don't break it!</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </div>
            </Link>
          );
        }
        if (offline) {
          return (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              <span className="text-xl">📡</span>
              <div className="flex-1">
                <p className="text-blue-300 text-xs font-bold">Go online to earn JCMOVES</p>
                <p className="text-slate-400 text-[11px]">100 tokens/hr while active on jobs</p>
              </div>
            </div>
          );
        }
        return (
          <Link href="/earn/leaderboard">
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-3 cursor-pointer hover:bg-green-500/15 transition-colors">
              <span className="text-xl">🏆</span>
              <div className="flex-1">
                <p className="text-green-300 text-xs font-bold">You're online &amp; earning</p>
                <p className="text-slate-400 text-[11px]">{myWeekTokens} jobs completed · check leaderboard</p>
              </div>
              <ChevronRight className="h-4 w-4 text-green-400" />
            </div>
          </Link>
        );
      })()}

      {/* Mini Calendar */}
      <div className="rounded-2xl bg-slate-800/40 border border-blue-500/20 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            <span className="text-white font-bold text-sm">My Job Calendar</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goToPrevCalMonth} className="p-1 rounded text-slate-400 hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-300 font-semibold">{MONTH_NAMES_SHORT[calMonth - 1]} {calYear}</span>
            <button onClick={goToNextCalMonth} className="p-1 rounded text-slate-400 hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
            <Link href="/crew/schedule">
              <Settings2 className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300 ml-1" />
            </Link>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES_SHORT.map(d => (
            <div key={d} className="text-center text-[9px] text-slate-500 font-semibold py-0.5">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {calendarLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarGrid.map((day, idx) => {
              if (!day) return <div key={idx} className="aspect-square" />;
              const dateStr = getCalDayStr(day);
              const jobs = (calendarData?.jobs ?? []).filter(j => getEffDateStr(j) === dateStr);
              const isBlocked = (calendarData?.blocks ?? []).some(b => b.date === dateStr);
              const isToday = dateStr === today.toISOString().slice(0, 10);
              const isSelected = selectedCalDay === dateStr;
              const isPast = dateStr < today.toISOString().slice(0, 10);
              return (
                <button
                  key={day}
                  onClick={() => setSelectedCalDay(isSelected ? null : dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-semibold transition-colors relative
                    ${isSelected ? "bg-blue-600 text-white" : isToday ? "ring-1 ring-cyan-500 bg-cyan-950/40 text-cyan-400" : isBlocked ? "bg-red-950/40 text-red-400" : jobs.length > 0 ? "bg-blue-950/50 text-blue-300" : "text-slate-400 hover:bg-white/5"}
                    ${isPast && !isToday ? "opacity-50" : ""}
                  `}
                >
                  {day}
                  {jobs.length > 0 && !isBlocked && (
                    <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                  )}
                  {isBlocked && <Ban className="h-2.5 w-2.5 absolute bottom-0.5 text-red-500" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-slate-500 mt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Job</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-700 inline-block" /> Blocked</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Today</span>
        </div>

        {/* Selected day jobs */}
        {selectedCalDay && (() => {
          const dayJobs = (calendarData?.jobs ?? []).filter(j => getEffDateStr(j) === selectedCalDay);
          const d = new Date(selectedCalDay + "T12:00:00");
          const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          return (
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-slate-400 font-semibold">{label}</p>
                <Link href={quickAddJobHref(selectedCalDay)}>
                  <Button size="sm" className="h-7 rounded-lg bg-blue-600 px-2 text-[11px] hover:bg-blue-500">
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </Link>
              </div>
              {dayJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-blue-500/30 bg-blue-950/20 p-3">
                  <p className="text-xs text-slate-500 italic mb-2">No jobs scheduled</p>
                  <Link href={quickAddJobHref(selectedCalDay)}>
                    <Button size="sm" className="w-full rounded-lg bg-blue-600 text-xs hover:bg-blue-500">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Moving Job For This Day
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayJobs.map(job => (
                    <Link key={job.id} href={`/lead/${job.id}`}>
                      <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-700/30 rounded-lg p-2.5 hover:bg-blue-900/40 cursor-pointer">
                        <span className="text-lg leading-none">{SERVICE_ICONS[job.serviceType] ?? "📦"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold text-white truncate capitalize">{job.serviceType.replace(/-/g, " ")} Job</p>
                            <MarketplaceShapeBadge serviceCode={job.serviceType} className="text-[8px]" />
                          </div>
                          {(job.confirmedFromAddress || job.fromAddress) && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{job.confirmedFromAddress || job.fromAddress}</span>
                            </p>
                          )}
                          <Badge className={`text-[9px] mt-1 ${job.status === "in_progress" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-blue-500/20 text-blue-300 border-blue-700/30"}`}>
                            {job.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                  <Link href={quickAddJobHref(selectedCalDay)}>
                    <Button variant="outline" size="sm" className="w-full border-blue-500/30 bg-blue-950/20 text-xs text-blue-200 hover:bg-blue-900/30 hover:text-white">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add Another Job This Day
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Daily Scripture */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/20 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Daily Inspiration</span>
          </div>
          {displayStreak > 0 && (
            <span className="text-orange-400 text-xs font-bold">🔥 {displayStreak} day streak</span>
          )}
        </div>
        <blockquote className="text-white text-sm font-semibold leading-snug italic mb-1">
          "{scriptureOfDay.text}"
        </blockquote>
        <p className="text-indigo-400 text-xs font-semibold mb-2">— {scriptureOfDay.ref}</p>
        <p className="text-slate-500 text-xs italic">"{moverQuoteOfDay.text}" <span className="text-slate-600">· {moverQuoteOfDay.ref}</span></p>
        <div className="mt-3">
          <Button
            size="sm"
            disabled={scriptureClaimed || scriptureClaimMutation.isPending}
            onClick={() => scriptureClaimMutation.mutate()}
            className={`h-8 text-xs font-bold border-0 w-full ${
              isWeekComplete
                ? "bg-yellow-600/20 text-yellow-400 cursor-default"
                : scriptureClaimed
                  ? "bg-green-600/20 text-green-400 cursor-default"
                  : isWeekCompleteNext
                    ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {scriptureClaimMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> :
              scriptureClaimed
                ? (isWeekComplete ? "🏆 Week Complete — +500 Bonus claimed!" : "✅ Claimed!")
                : isWeekCompleteNext
                  ? `🏆 Day 7 of 7 — Claim 500 Bonus!`
                  : `🔥 Day ${nextClaimDay} of 7 — Claim`}
          </Button>
        </div>
      </div>

      {/* Today's Jobs */}
      {todayJobs.length > 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-orange-500/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-400 font-bold">📅 Today's Jobs</span>
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">{todayJobs.length}</Badge>
          </div>
          <div className="space-y-2">
            {todayJobs.map(job => {
              const assignedCrew = (Array.isArray(job.crewMembers) ? (job.crewMembers as string[]) : [])
                .map(id => employees.find(e => e.id === id))
                .filter((e): e is User => !!e)
                .slice(0, 3);
              return (
                <Link key={job.id} href={`/lead/${job.id}`}>
                  <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5 cursor-pointer hover:bg-white/[0.06] transition-colors">
                    <span className="text-2xl">{SERVICE_ICONS[job.serviceType] ?? "🚛"}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-white text-sm font-semibold truncate">{job.firstName} {job.lastName}</p>
                          <MarketplaceShapeBadge serviceCode={job.serviceType} className="text-[8px]" />
                        </div>
                      {job.fromAddress && (
                        <p className="text-slate-400 text-xs flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{job.fromAddress}
                        </p>
                      )}
                      {assignedCrew.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {assignedCrew.map(emp => (
                            <div key={emp.id} className="flex items-center gap-0.5 bg-white/5 rounded-full pl-0.5 pr-1.5 py-0.5 border border-white/10">
                              <div className="w-4 h-4 rounded-full bg-blue-600/60 flex items-center justify-center text-[8px] font-bold text-white">
                                {((emp.firstName?.[0] ?? "") + (emp.lastName?.[0] ?? "")).toUpperCase() || "?"}
                              </div>
                              <WorkerBadge
                                jobCount={allTimeJobCounts[emp.id] ?? 0}
                                size="xs"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {todayJobs.length === 0 && visibleUpcomingBoardJobs.length === 0 && myAssignments.length === 0 && trashJobsThisWeek.length === 0 && (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/30 p-6 text-center">
          <Calendar className="h-10 w-10 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 font-medium">No jobs scheduled yet</p>
          <p className="text-slate-500 text-sm mt-1">New jobs will appear here automatically</p>
        </div>
      )}

      {/* Trash Valet Jobs — this week */}
      {trashJobsThisWeek.length > 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-emerald-400 font-bold text-sm uppercase tracking-wider">🗑️ Trash Valet</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">{trashJobsThisWeek.length}</Badge>
          </div>
          <div className="space-y-3">
            {trashJobsThisWeek.map((row: TrashJobRow) => {
              const tj = row.job;
              const sub = row.sub;
              return (
              <div key={tj.id} className="bg-white/[0.03] rounded-xl p-3 border border-emerald-500/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{sub?.customerName || "Customer"}</p>
                    <p className="text-slate-400 text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{sub?.address}{sub?.city ? `, ${sub.city}` : ""}</span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge className="bg-slate-700/60 text-slate-300 border-0 text-[10px]">{tj.cans} can{tj.cans !== 1 ? "s" : ""}</Badge>
                      {tj.bagCount > 0 && <Badge className="bg-slate-700/60 text-slate-300 border-0 text-[10px]">{tj.bagCount} bags</Badge>}
                      {tj.isRecyclingWeek && <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">♻️ Recycling</Badge>}
                    </div>
                  </div>
                  <Badge className={`text-[10px] flex-shrink-0 ${
                    tj.status === "completed" ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : tj.status === "pulled_out" ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
                    : tj.status === "returned" ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                  }`}>{tj.status.replace(/_/g, " ")}</Badge>
                </div>
                {tj.status !== "completed" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {tj.status === "scheduled" && (
                        <Button
                          size="sm"
                          className="flex-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 text-xs h-7"
                          onClick={() => trashActionMutation.mutate({ jobId: tj.id, action: "pull-out" })}
                          disabled={trashActionMutation.isPending}
                        >Pull Out</Button>
                      )}
                      {tj.status === "pulled_out" && (
                        <Button
                          size="sm"
                          className="flex-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-xs h-7"
                          onClick={() => trashActionMutation.mutate({ jobId: tj.id, action: "return" })}
                          disabled={trashActionMutation.isPending}
                        >Returned</Button>
                      )}
                    </div>
                    {(tj.status === "pulled_out" || tj.status === "returned") && (
                      <div className="space-y-1.5">
                        <input
                          type="url"
                          placeholder="Photo URL (optional)"
                          value={trashPhotoUrls[tj.id] ?? ""}
                          onChange={(e) => setTrashPhotoUrls(prev => ({ ...prev, [tj.id]: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                        />
                        <Button
                          size="sm"
                          className="w-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs h-7"
                          onClick={() => trashActionMutation.mutate({
                            jobId: tj.id,
                            action: "complete",
                            photoUrl: trashPhotoUrls[tj.id] || undefined,
                          })}
                          disabled={trashActionMutation.isPending}
                        >✓ Mark Complete</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Jobs to Sign Up For */}
      {visibleUpcomingBoardJobs.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-950 border border-blue-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-400" />
              <span className="text-blue-300 text-sm font-bold uppercase tracking-wider">Available Jobs</span>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{visibleUpcomingBoardJobs.length} open</Badge>
            </div>
            <Link href="/crew/jobs">
              <span className="text-slate-500 text-xs hover:text-slate-300 transition-colors">See all →</span>
            </Link>
          </div>
          <div className="space-y-3">
            {visibleUpcomingBoardJobs.slice(0, 5).map(job => {
              const slotsOpen = (job.crewSize || 2) - job.crewSlotsFilled;
              const dateLabel = job.moveDate
                ? new Date(job.moveDate.split("T")[0] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                : "Date TBD";
              return (
                <div
                  key={job.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/crew/jobs?lead=${encodeURIComponent(job.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/crew/jobs?lead=${encodeURIComponent(job.id)}`);
                    }
                  }}
                  className="relative cursor-pointer bg-white/[0.04] rounded-xl p-3 pr-9 border border-white/5 space-y-2 overflow-hidden transition-colors hover:border-blue-400/40 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-blue-400/70"
                >
                  <button
                    type="button"
                    aria-label="Dismiss job notice"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      dismissBoardJobNotice(job.id);
                    }}
                    className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                  <ConfettiBurst active={claimedJobId === job.id} variant="inline" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{SERVICE_ICONS[job.serviceType] ?? "🚛"}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-white text-sm font-semibold capitalize">{job.serviceType.replace(/-/g, " ")} Job</p>
                          <MarketplaceShapeBadge serviceCode={job.serviceType} className="text-[8px]" />
                          <Badge className="border-blue-400/30 bg-blue-500/15 text-[9px] text-blue-200">{job.flow.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-slate-400 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{dateLabel}
                          </span>
                          <PaymentStatusPill leadId={job.id} />

                          {job.fromAddress && (
                            <span className="text-slate-400 text-xs flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[130px]">{job.fromAddress}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-orange-400 font-bold text-xs flex items-center gap-1 justify-end">
                        <Coins className="h-3 w-3" />~{job.estimatedTokens.toLocaleString()}
                      </p>
                      <p className="text-slate-500 text-[10px]">JCMOVES</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-yellow-400 text-xs flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {slotsOpen} slot{slotsOpen !== 1 ? "s" : ""} open · {job.crewSize || 2} needed
                    </span>
                    {claimedJobId === job.id ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 rounded-full px-3 py-1">
                          <span className="text-green-300 text-xs font-bold">✓ Signed up!</span>
                        </div>
                        {job.estimatedTokens > 0 && (
                          <span className="text-[10px] text-orange-400 font-semibold">
                            ~{job.estimatedTokens.toLocaleString()} JCMOVES on completion
                          </span>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        disabled={applyingId === job.id && applyMutation.isPending}
                        onClick={(event) => { event.stopPropagation(); setApplyingId(job.id); applyMutation.mutate(job.id); }}
                        className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3"
                      >
                        {applyingId === job.id && applyMutation.isPending
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : "Sign Up"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weather — compact chip */}
      <button
        className={`w-full text-left rounded-xl px-4 py-2.5 border flex items-center gap-3 transition-colors ${
          wxInfo?.isSnow
            ? "bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border-cyan-500/30 hover:border-cyan-500/50"
            : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60"
        }`}
        onClick={() => setWeatherSheetOpen(true)}
      >
        <WxIcon className={`h-4 w-4 flex-shrink-0 ${wxInfo?.color ?? "text-slate-400"}`} />
        <span className="text-white text-sm font-semibold flex-1">
          {wx ? `${Math.round(wx.temperature_2m)}°F · ${wxInfo?.label} · ${Math.round(wx.wind_speed_10m)} mph wind` : "Ironwood, MI — tap for weather"}
        </span>
        {wxInfo?.isSnow && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] animate-pulse">❄️ SNOW</Badge>}
        <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
      </button>

      {/* Weather Sheet */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="bg-slate-900 border-slate-700 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white flex items-center gap-2">
              <WxIcon className={`h-5 w-5 ${wxInfo?.color ?? "text-slate-400"}`} />
              Ironwood, MI — Weather
              {wxInfo?.isSnow && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs animate-pulse">❄️ SNOW ALERT</Badge>}
            </SheetTitle>
          </SheetHeader>
          {wx ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <p className={`text-4xl font-black ${wxInfo?.color ?? "text-white"}`}>{Math.round(wx.temperature_2m)}°F</p>
                  <p className="text-slate-400 text-sm mt-1">{wxInfo?.label}</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3 space-y-2">
                  {wx.apparent_temperature != null && (
                    <div className="text-slate-300 text-sm">
                      🌡️ Feels like {Math.round(wx.apparent_temperature)}°F
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-300 text-sm">
                    <Wind className="h-4 w-4 text-blue-400" />
                    {Math.round(wx.wind_speed_10m)} mph wind
                  </div>
                  {wx.precipitation != null && (
                    <div className="text-slate-300 text-sm">
                      💧 {wx.precipitation.toFixed(2)}" precip
                    </div>
                  )}
                </div>
              </div>
              {forecastDays.length > 0 && (
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">7-Day Forecast</p>
                  <div className="space-y-1.5">
                    {forecastDays.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-3 py-2">
                        <span className="text-slate-400 text-sm w-8 font-semibold">{d.day}</span>
                        <span className="text-lg w-6 text-center">{getWeatherIconForCode(d.code)}</span>
                        <div className="flex-1" />
                        <span className="text-white text-sm font-bold">{d.hi}°</span>
                        <span className="text-slate-500 text-sm">/{d.lo}°</span>
                        {d.precip > 0 && <span className="text-blue-400 text-xs">{d.precip.toFixed(1)}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Weather unavailable</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Mini Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="font-bold text-white text-sm">Crew Leaderboard</span>
            </div>
            <span className="text-[10px] text-amber-600">This week</span>
          </div>
          <div className="space-y-1.5">
            {leaderboard.map((emp, i) => {
              const isMe = emp.id === String(user?.id);
              const workerLevel = getWorkerLevel(emp.allTimeCount);
              return (
                <div
                  key={emp.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isMe ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.02] border-white/5"
                  }`}
                >
                  <span className="text-lg w-6">{medals[i]}</span>
                  <p className={`text-sm font-semibold flex-1 ${isMe ? "text-amber-300" : "text-white"}`}>
                    {emp.firstName || emp.username}
                    {isMe && <span className="text-[10px] text-amber-500 ml-1">(you)</span>}
                  </p>
                  <WorkerBadge level={workerLevel} size="xs" />
                  <LevelBadge tier={(emp.loyaltyTier ?? "bronze") as LoyaltyTierKey} size="xs" />
                  <span className="text-amber-300 font-black text-sm">{emp.count}</span>
                </div>
              );
            })}
          </div>
          {myRank !== null && myRank > 3 && (
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
              <span className="text-xs text-slate-400">Your rank:</span>
              <span className="text-xs font-bold text-amber-300">#{myRank}</span>
              <span className="text-xs text-slate-500">— {myCount} job{myCount !== 1 ? "s" : ""} this week</span>
            </div>
          )}
        </div>
      )}

      {/* My Assignments — bottom, collapsed by default */}
      {myAssignments.length > 0 && (
        <div className="rounded-2xl bg-slate-800/40 border border-orange-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-orange-400" />
            <span className="text-orange-300 font-bold text-sm uppercase tracking-wider">My Assignments</span>
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">{myAssignments.length}</Badge>
          </div>
          <div className="space-y-2">
            {(assignmentsExpanded ? myAssignments : myAssignments.slice(0, 2)).map(job => {
              const dateLabel = (job.confirmedDate || job.moveDate)
                ? new Date(((job.confirmedDate || job.moveDate) as string).split("T")[0] + "T12:00:00")
                    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                : "Date TBD";
              // Task #173 — state-machine aware action bar. Only the assigned
              // crew sees advance-state buttons; admin-offering shows Accept/Decline.
              const ds = String(job.dispatchState || "").toLowerCase();
              const members: string[] = Array.isArray(job.crewMembers) ? (job.crewMembers as string[]) : [];
              const amAssigned = !!user?.id && members.includes(String(user.id));
              const amOffered = ds === "offering" && job.dispatchOfferedTo === user?.id;
              type Step = "accepted" | "en_route" | "on_site" | "completed";
              const normalized: Step =
                ds === "completed" ? "completed"
                : ds === "on_site" ? "on_site"
                : ds === "en_route" ? "en_route"
                : "accepted";
              type LucideIcon = React.ComponentType<{ className?: string }>;
              const nextAction: { label: string; Icon: LucideIcon; next: "en_route"|"on_site"|"completed" } | null =
                !amAssigned || normalized === "completed" ? null
                : normalized === "accepted" ? { label: "Start — En Route", Icon: Play, next: "en_route" }
                : normalized === "en_route" ? { label: "I've Arrived", Icon: Flag, next: "on_site" }
                : { label: "Mark Complete", Icon: CheckCircle2, next: "completed" };
              // Prefer lat/lng (no geocode ambiguity); fall back to address string.
              const latN = job.lat != null ? Number(job.lat) : NaN;
              const lngN = job.lng != null ? Number(job.lng) : NaN;
              const hasCoords = Number.isFinite(latN) && Number.isFinite(lngN) && latN !== 0 && lngN !== 0;
              const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${
                hasCoords ? `${latN},${lngN}` : encodeURIComponent(job.fromAddress || "")
              }`;
              const statusBusy = statusPending === job.id;
              const acceptBusy = acceptPending === job.id;
              const declineBusy = declinePending === job.id;
              const bonus = (job as Lead & { bonus?: { amount: number; reasons?: string[] } }).bonus;
              return (
                <div key={job.id} className="bg-white/[0.03] rounded-xl p-3 border border-orange-500/10">
                  <Link href={`/lead/${job.id}`}>
                    <div className="flex items-center gap-3 cursor-pointer">
                      <span className="text-2xl">{SERVICE_ICONS[job.serviceType] ?? "🚛"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-white text-sm font-semibold truncate capitalize">
                            {job.serviceType?.replace(/-/g, " ")} Job
                          </p>
                          <MarketplaceShapeBadge serviceCode={job.serviceType} className="text-[8px]" />
                        </div>
                        <p className="text-slate-400 text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{dateLabel}
                          {job.fromAddress && (
                            <><MapPin className="h-3 w-3 ml-2" /><span className="truncate max-w-[100px]">{job.fromAddress}</span></>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <Badge className={`text-[10px] ${job.status === "in_progress" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-orange-500/20 text-orange-300 border-orange-500/30"}`}>
                          {job.status.replace(/_/g, " ")}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-500 mt-1 ml-auto" />
                      </div>
                    </div>
                  </Link>
                  {(amAssigned || amOffered) && (
                    <>
                      {amOffered && bonus && bonus.amount > 0 && (
                        <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Crew Bonus</span>
                            {Array.isArray(bonus.reasons) && bonus.reasons.length > 0 && (
                              <p className="text-[9px] text-emerald-200/80 leading-snug">{bonus.reasons.join(" • ")}</p>
                            )}
                          </div>
                          <span className="text-sm font-black text-emerald-300" data-testid={`today-bonus-${job.id}`}>+${bonus.amount}</span>
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-600 text-slate-200 bg-slate-800/60 hover:bg-slate-700/60 text-xs font-semibold px-3"
                          data-testid={`today-nav-${job.id}`}
                        >
                          <Navigation className="h-3.5 w-3.5" /> Navigate
                        </a>
                        {amOffered ? (
                          <>
                            <Button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); acceptOfferMutation.mutate(job.id); }}
                              disabled={acceptBusy}
                              className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                              data-testid={`today-accept-${job.id}`}
                            >
                              {acceptBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept</>}
                            </Button>
                            <Button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); declineOfferMutation.mutate(job.id); }}
                              disabled={declineBusy}
                              className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                              data-testid={`today-decline-${job.id}`}
                            >
                              {declineBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" /> Decline</>}
                            </Button>
                          </>
                        ) : nextAction ? (
                        <Button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); statusMutation.mutate({ leadId: job.id, status: nextAction.next }); }}
                          disabled={statusBusy}
                          className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                          data-testid={`today-status-${job.id}-${nextAction.next}`}
                        >
                          {statusBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                            <>
                              <nextAction.Icon className="h-3.5 w-3.5 mr-1" />
                              {nextAction.label}
                            </>
                          )}
                        </Button>
                      ) : null}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {myAssignments.length > 2 && (
            <button
              className="mt-2 w-full text-center text-slate-400 text-xs hover:text-slate-300 flex items-center justify-center gap-1 py-1"
              onClick={() => setAssignmentsExpanded(v => !v)}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${assignmentsExpanded ? "rotate-180" : ""}`} />
              {assignmentsExpanded ? "Show less" : `Show ${myAssignments.length - 2} more…`}
            </button>
          )}
        </div>
      )}

      <div className="h-2" />

      {/* Task #173 — sticky mobile bottom action bar for active job. */}
      {primaryActiveJob && primaryNext && (
        <div
          className="fixed bottom-16 inset-x-0 z-40 md:hidden px-3 pointer-events-none"
          data-testid="sticky-action-bar"
        >
          <div className="pointer-events-auto max-w-2xl mx-auto bg-slate-900/95 backdrop-blur border border-blue-500/30 rounded-xl shadow-lg shadow-black/40 p-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Active Job</p>
              <p className="text-xs font-semibold text-white truncate">
                {primaryActiveJob.job.firstName} {primaryActiveJob.job.lastName} — {primaryActiveJob.ds.replace("_", " ")}
              </p>
            </div>
            <Button
              onClick={() => statusMutation.mutate({ leadId: primaryActiveJob.job.id, status: primaryNext.next })}
              disabled={statusPending === primaryActiveJob.job.id}
              className="min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3"
              data-testid={`sticky-status-${primaryNext.next}`}
            >
              {statusPending === primaryActiveJob.job.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : primaryNext.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
