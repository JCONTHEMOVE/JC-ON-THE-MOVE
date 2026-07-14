import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/lib/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Users, Plus, MapPin, Phone, Mail, Calendar,
  Loader2, Search, ChevronRight, Trash2, MessageSquare,
  Sun, Cloud, CloudSnow, CloudRain, Zap, Trophy, BookOpen,
  RefreshCw, Coins, Star, Megaphone, Truck,
  Camera, ClipboardList, DollarSign, Wind, ChevronLeft, History,
  Power, UserCheck, Wifi, WifiOff,
  CalendarDays, Target, Clock, X, CheckCircle2, TrendingUp, Edit3,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { getStatusColors } from "@/lib/job-status";
import { BookingChatbot } from "@/components/booking-chatbot";
import type { Lead, User } from "@shared/schema";

// ─────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────

const STATUS_OPTIONS = ["all", "new", "contacted", "quote_requested", "quoted", "confirmed", "available", "accepted", "in_progress", "completed", "cancelled"];
// Sort order: red (needs action) → yellow (all set) → green (done)
const STATUS_SORT: Record<string, number> = {
  new: 0, contacted: 1, quote_requested: 2, quoted: 3,
  confirmed: 10, available: 11, accepted: 12, in_progress: 13,
  completed: 20, paid: 21, cancelled: 30,
};

const SCRIPTURES = [
  { text: "Commit your work to the Lord, and your plans will be established.", ref: "Proverbs 16:3" },
  { text: "Whatever you do, work heartily, as for the Lord and not for men.", ref: "Colossians 3:23" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you.", ref: "Jeremiah 29:11" },
  { text: "The Lord your God is with you, the Mighty Warrior who saves.", ref: "Zephaniah 3:17" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged.", ref: "Joshua 1:9" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "Ask and it will be given to you; seek and you will find.", ref: "Matthew 7:7" },
  { text: "In all your ways submit to him, and he will make your paths straight.", ref: "Proverbs 3:6" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "Give thanks in all circumstances; for this is God's will for you.", ref: "1 Thessalonians 5:18" },
  { text: "The fruit of that righteousness will be peace; its effect will be quietness and confidence forever.", ref: "Isaiah 32:17" },
  { text: "Do not be anxious about anything, but in every situation, by prayer, present your requests to God.", ref: "Philippians 4:6" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "Let your light shine before others, that they may see your good deeds.", ref: "Matthew 5:16" },
  { text: "Be kind and compassionate to one another, forgiving each other.", ref: "Ephesians 4:32" },
  { text: "Blessed is the one who perseveres under trial.", ref: "James 1:12" },
  { text: "With God all things are possible.", ref: "Matthew 19:26" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you.", ref: "Numbers 6:24-25" },
  { text: "Serve one another humbly in love.", ref: "Galatians 5:13" },
  { text: "Love is patient, love is kind. It does not envy, it does not boast.", ref: "1 Corinthians 13:4" },
  { text: "God is our refuge and strength, an ever-present help in trouble.", ref: "Psalm 46:1" },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14" },
  { text: "A generous person will prosper; whoever refreshes others will be refreshed.", ref: "Proverbs 11:25" },
  { text: "Work with enthusiasm, as though you were working for the Lord rather than for people.", ref: "Ephesians 6:7" },
  { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest.", ref: "Galatians 6:9" },
  { text: "Honor the Lord with your wealth, with the firstfruits of all your crops.", ref: "Proverbs 3:9" },
  { text: "Whoever wants to become great among you must be your servant.", ref: "Matthew 20:26" },
  { text: "And my God will meet all your needs according to the riches of his glory in Christ Jesus.", ref: "Philippians 4:19" },
];

const MOVER_QUOTES = [
  { text: "Lift with your legs, not your ego.", ref: "Mover Wisdom" },
  { text: "Every heavy load moved is a family's fresh start.", ref: "Crew Philosophy" },
  { text: "The strongest crews aren't just muscles — they're heart.", ref: "JC ON THE MOVE" },
  { text: "Show up early. Work hard. Go home proud.", ref: "Crew Code" },
  { text: "One box at a time. That's how mountains move.", ref: "Mover Wisdom" },
];

const ALL_QUOTES = [...SCRIPTURES, ...MOVER_QUOTES];

const ANNOUNCEMENTS = [
  { id: 1, icon: "📢", text: "Always take before/after photos on every job for quality control.", date: "Team Policy" },
  { id: 2, icon: "🚛", text: "Return all equipment to the truck at end of shift. Stair climber goes back in truck #2.", date: "Reminder" },
  { id: 3, icon: "⭐", text: "5-star customer reviews earn bonus JCMOVES tokens. Ask every customer!", date: "Tip" },
  { id: 4, icon: "❄️", text: "Snow removal season: check the weather widget daily for Ironwood & Iron River alerts.", date: "Seasonal" },
];

function getWeatherInfo(code: number): { label: string; Icon: any; color: string; isSnow: boolean } {
  if (code === 0) return { label: "Clear Sky", Icon: Sun, color: "text-yellow-400", isSnow: false };
  if (code <= 2) return { label: "Partly Cloudy", Icon: Cloud, color: "text-slate-300", isSnow: false };
  if (code <= 45) return { label: "Foggy", Icon: Cloud, color: "text-slate-400", isSnow: false };
  if (code <= 67) return { label: "Rainy", Icon: CloudRain, color: "text-blue-400", isSnow: false };
  if (code <= 77) return { label: "Snowing", Icon: CloudSnow, color: "text-cyan-300", isSnow: true };
  if (code <= 82) return { label: "Rain Showers", Icon: CloudRain, color: "text-blue-400", isSnow: false };
  if (code <= 86) return { label: "Snow Showers", Icon: CloudSnow, color: "text-cyan-300", isSnow: true };
  return { label: "Thunderstorm", Icon: Zap, color: "text-purple-400", isSnow: false };
}

function getDayOfYear(): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

function LeadStatusBadge({ status }: { status: string }) {
  const colors = getStatusColors(status);
  return (
    <Badge variant="outline" className={`text-xs ${colors.text} ${colors.cardBorder}`}>
      {status.replace(/_/g, " ").toUpperCase()}
    </Badge>
  );
}

// ─────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────

export default function TeamHub() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = ["admin", "business_owner"].includes(currentUser?.role || "");

  // Tab & filter state
  const [activeTab, setActiveTab] = useState("leads");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [quoteIdx, setQuoteIdx] = useState(getDayOfYear() % ALL_QUOTES.length);
  const [scriptureClaimed, setScriptureClaimed] = useState(false);
  const [scriptureReward, setScriptureReward] = useState<{ amount: number; streak: number } | null>(null);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  // Worker availability (on/off duty toggle)
  const [dutyStatus, setDutyStatus] = useState<boolean>(Boolean((currentUser as any)?.isAvailable));

  // Schedule tab state
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [goalWeekly, setGoalWeekly] = useState(0);
  const [goalMonthly, setGoalMonthly] = useState(0);
  const [goalJobSize, setGoalJobSize] = useState("any");
  const [adminGoalTarget, setAdminGoalTarget] = useState<string | null>(null);
  const [adminGoalWeekly, setAdminGoalWeekly] = useState(0);
  const [adminGoalMonthly, setAdminGoalMonthly] = useState(0);

  const scriptureClaimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mining/scripture-claim", {});
      return res.json();
    },
    onSuccess: (data) => {
      setScriptureClaimed(true);
      setScriptureReward({ amount: data.amount, streak: data.streak });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/history"] });
      toast({ title: `🎉 +${data.amount} JCMOVES claimed!`, description: data.streakBonus ? `🔥 Day ${data.streak} streak — bonus included!` : `Day ${data.streak} streak. Keep it going!` });
      notificationService.notifyNewReward("scripture claim", data.amount);
    },
    onError: (e: any) => {
      const msg = e?.message || "";
      if (msg.includes("Already claimed")) {
        setScriptureClaimed(true);
        toast({ title: "Already claimed today", description: "Come back tomorrow for your next scripture reward!" });
      } else {
        toast({ title: "Couldn't claim", description: msg || "Try again in a moment.", variant: "destructive" });
      }
    },
  });

  // Worker availability toggle mutation
  const toggleDutyMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await apiRequest("PATCH", "/api/auth/user/availability", { isAvailable: next });
      return res.json();
    },
    onSuccess: (data) => {
      setDutyStatus(data.isAvailable);
      queryClient.invalidateQueries({ queryKey: ["/api/employees/available"] });
      toast({
        title: data.isAvailable ? "🟢 You're ON DUTY" : "🔴 You're OFF DUTY",
        description: data.isAvailable ? "Customers can see you're available" : "You won't appear in available crews",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Schedule Tab Mutations ───────────────────────
  const { data: myAvailability, refetch: refetchAvailability } = useQuery<{
    blocks: { id: number; date: string; reason: string | null }[];
    schedule: { dayOfWeek: number; startHour: number | null; endHour: number | null; isAvailable: boolean | null }[];
    goals: { weeklyJobGoal: number | null; monthlyJobGoal: number | null; preferredJobSize: string | null } | null;
    stats: { thisWeek: number; thisMonth: number; allTime: number };
  }>({
    queryKey: ["/api/workers/my-availability"],
  });

  const { data: allWorkersAvail = [] } = useQuery<{
    user: User;
    goals: { weeklyJobGoal: number | null; monthlyJobGoal: number | null } | null;
    thisWeek: number;
    thisMonth: number;
    blockedDates: string[];
  }[]>({
    queryKey: ["/api/workers/all-availability"],
    enabled: isAdmin,
  });

  const addDayBlockMutation = useMutation({
    mutationFn: async ({ date, reason }: { date: string; reason: string }) => {
      const res = await apiRequest("POST", "/api/workers/day-blocks", { date, reason });
      return res.json();
    },
    onSuccess: () => {
      refetchAvailability();
      setBlockDate(""); setBlockReason("");
      toast({ title: "Day blocked", description: "Your day off has been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeDayBlockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/workers/day-blocks/${id}`, {});
      return res.json();
    },
    onSuccess: () => { refetchAvailability(); toast({ title: "Day unblocked" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (payload: { dayOfWeek: number; startHour: number; endHour: number; isAvailable: boolean }) => {
      const res = await apiRequest("PUT", "/api/workers/schedule", payload);
      return res.json();
    },
    onSuccess: () => refetchAvailability(),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveGoalsMutation = useMutation({
    mutationFn: async (payload: { weeklyJobGoal: number; monthlyJobGoal: number; preferredJobSize: string }) => {
      const res = await apiRequest("PUT", "/api/workers/goals/my", payload);
      return res.json();
    },
    onSuccess: () => {
      refetchAvailability();
      toast({ title: "Goals saved!", description: "Your job goals have been updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setAdminGoalsMutation = useMutation({
    mutationFn: async ({ userId, weeklyJobGoal, monthlyJobGoal }: { userId: string; weeklyJobGoal: number; monthlyJobGoal: number }) => {
      const res = await apiRequest("PUT", `/api/workers/${userId}/goals`, { weeklyJobGoal, monthlyJobGoal });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers/all-availability"] });
      setAdminGoalTarget(null);
      toast({ title: "Goals set!", description: "Worker goals have been updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const firstName = currentUser?.firstName || currentUser?.username || "Crew";

  // ── Queries ──────────────────────────────────────
  // Admins see all leads; employees only see jobs assigned to them
  const leadsEndpoint = isAdmin ? "/api/leads" : "/api/leads/my-jobs";
  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: [leadsEndpoint],
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  const { data: availableWorkers = [] } = useQuery<{ id: string; firstName: string | null; lastName: string | null; username: string | null; profileImageUrl: string | null; role: string; isAvailable: boolean }[]>({
    queryKey: ["/api/employees/available"],
    staleTime: 30000,
  });

  const { data: quotedLeads = [] } = useQuery<Lead[]>({
    queryKey: ["/api/leads/status/quoted"],
  });

  const { data: adminStats } = useQuery<{ totalLeads: number; activeJobs: number; totalUsers: number }>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });

  const { data: wallet } = useQuery<{ balance: string; username: string }>({
    queryKey: ["/api/rewards/wallet"],
  });

  const { data: weather } = useQuery({
    queryKey: ["weather-ironwood"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=46.4547&longitude=-90.1712&current=temperature_2m,weather_code,wind_speed_10m,precipitation&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch"
      );
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  // ── Computed ─────────────────────────────────────
  const activeLeads = leads.filter(l => !["completed", "cancelled", "paid"].includes(l.status));
  const completedLeads = leads.filter(l => l.status === "completed");
  const leaderboard = useMemo(() => {
    const counts: Record<string, number> = {};
    completedLeads.forEach(l => {
      const key = l.createdByUserId || "";
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    return employees
      .filter(e => counts[e.id])
      .map(e => ({ ...e, count: counts[e.id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [completedLeads, employees]);

  const filteredLeads = useMemo(() => {
    return leads
      .filter(l => {
        const matchesStatus = statusFilter === "all" || l.status === statusFilter;
        const q = search.toLowerCase();
        const matchesSearch = !q ||
          `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
          (l.email?.toLowerCase().includes(q)) ||
          (l.phone?.includes(q)) ||
          (l.serviceType?.toLowerCase().includes(q));
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const aOrder = STATUS_SORT[a.status] ?? 99;
        const bOrder = STATUS_SORT[b.status] ?? 99;
        return aOrder - bOrder;
      });
  }, [leads, statusFilter, search]);

  // ── Calendar computed ─────────────────────────────
  const SERVICE_ICONS: Record<string, string> = {
    residential: "🏠", junk: "🗑️", snow: "❄️", cleaning: "✨",
    handyman: "🔧", demolition: "⚒️", flooring: "🪵", painting: "🎨",
  };
  const getServiceIcon = (serviceType: string) => SERVICE_ICONS[serviceType] ?? "🚛";

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const calJobsByDate = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return leads
      .filter(l => {
        const dateStr = l.confirmedDate || l.moveDate;
        if (!dateStr) return false;
        const parts = dateStr.split("T")[0].split("-");
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((acc, l) => {
        const dateStr = (l.confirmedDate || l.moveDate)!;
        const parts = dateStr.split("T")[0].split("-");
        const key = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).toDateString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(l);
        return acc;
      }, {} as Record<string, Lead[]>);
  }, [leads, calendarMonth]);

  const calSelectedJobs = calendarSelectedDate
    ? calJobsByDate[calendarSelectedDate.toDateString()] || []
    : [];

  const historyLeads = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return leads
      .filter(l => {
        if (l.status !== "completed") return false;
        const dateStr = l.confirmedDate || l.moveDate;
        if (!dateStr) return false;
        const parts = dateStr.split("T")[0].split("-");
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d <= today;
      })
      .sort((a, b) => {
        const aDate = (a.confirmedDate || a.moveDate || "");
        const bDate = (b.confirmedDate || b.moveDate || "");
        return bDate.localeCompare(aDate);
      });
  }, [leads]);

  // ── Mutations ─────────────────────────────────────
  const invalidateLeads = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    queryClient.invalidateQueries({ queryKey: ["/api/leads/my-jobs"] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/leads/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      invalidateLeads();
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const awardCustomerTokensMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/leads/${id}/award-customer-tokens`);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateLeads();
      if (data.totalAwarded > 0) {
        toast({ title: `🎁 +${data.totalAwarded.toLocaleString()} JCMOVES awarded!`, description: `Sent to ${data.customerEmail}` });
      } else {
        toast({ title: "Already paid", description: data.note });
      }
    },
    onError: (e: any) => toast({ title: "Award failed", description: e.message, variant: "destructive" }),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/leads/${id}`),
    onSuccess: () => {
      invalidateLeads();
      toast({ title: "Job archived", description: "Removed from active jobs. You can restore it from Archived Jobs." });
      setLeadToDelete(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Weather data ──────────────────────────────────
  const wx = weather?.current;
  const wxInfo = wx ? getWeatherInfo(wx.weather_code) : null;
  const WxIcon = wxInfo?.Icon ?? Cloud;

  // ── Token balance ─────────────────────────────────
  const tokenBalance = wallet?.balance ? parseFloat(wallet.balance).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—";

  // ── Medals ────────────────────────────────────────
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-5">

        {/* ══ HERO BANNER ══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/60 via-slate-800/80 to-slate-900 border border-blue-500/20 p-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_70%)]" />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-blue-300 text-sm font-medium mb-0.5">{greeting} 👋</p>
                <h1 className="text-3xl font-black text-white">{firstName}</h1>
                <p className="text-slate-400 text-sm mt-1">🚛 Ready to move mountains today?</p>
              </div>
              <Badge className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-xs">
                {currentUser?.role?.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Active Jobs", value: activeLeads.length, color: "text-blue-400", icon: "🔥" },
                { label: "Total Leads", value: adminStats?.totalLeads ?? leads.length, color: "text-white", icon: "📋" },
                { label: "Completed", value: completedLeads.length, color: "text-green-400", icon: "✅" },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.04] rounded-xl p-3 text-center border border-white/5">
                  <div className="text-lg">{s.icon}</div>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-[11px]">{s.label}</p>
                </div>
              ))}
            </div>

            {/* On-duty toggle — all crew members */}
            <button
              onClick={() => toggleDutyMutation.mutate(!dutyStatus)}
              disabled={toggleDutyMutation.isPending}
              className={`mt-4 w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                dutyStatus
                  ? "bg-green-500/15 border-green-500/40 text-green-300"
                  : "bg-slate-800/60 border-slate-600/40 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {dutyStatus ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span className="text-sm font-bold">{dutyStatus ? "ON DUTY — visible to customers" : "OFF DUTY — hidden from customers"}</span>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${dutyStatus ? "bg-green-500" : "bg-slate-600"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${dutyStatus ? "left-5" : "left-0.5"}`} />
              </div>
            </button>
          </div>
        </div>

        {/* ══ DAILY SCRIPTURE ══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/20 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <span className="text-indigo-300 text-xs font-bold uppercase tracking-wider">Daily Inspiration</span>
            </div>
            <blockquote className="text-white text-base font-medium leading-relaxed mb-2 italic">
              "{ALL_QUOTES[quoteIdx].text}"
            </blockquote>
            <p className="text-indigo-400 text-sm font-semibold">— {ALL_QUOTES[quoteIdx].ref}</p>
            {scriptureReward && (
              <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-indigo-300 text-sm font-bold">+{scriptureReward.amount} JCMOVES</span>
                <span className="text-indigo-400 text-xs">· Day {scriptureReward.streak} streak 🔥</span>
              </div>
            )}
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuoteIdx(i => (i + 1) % ALL_QUOTES.length)}
                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> New Verse
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.share?.({
                    text: `"${ALL_QUOTES[quoteIdx].text}" — ${ALL_QUOTES[quoteIdx].ref}`,
                    title: "JC ON THE MOVE – Daily Inspiration",
                  }).catch(() => {});
                  toast({ title: "🙏 Shared with crew!" });
                }}
                className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 h-8 text-xs"
              >
                🙏 Share
              </Button>
              <Button
                size="sm"
                disabled={scriptureClaimed || scriptureClaimMutation.isPending}
                onClick={() => scriptureClaimMutation.mutate()}
                className={`h-8 text-xs font-bold border-0 ${
                  scriptureClaimed
                    ? "bg-green-600/20 text-green-400 cursor-default"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                }`}
              >
                {scriptureClaimMutation.isPending
                  ? "Claiming..."
                  : scriptureClaimed
                  ? "✅ Claimed!"
                  : "🪙 Claim Reward"}
              </Button>
            </div>
          </div>
        </div>

        {/* ══ MONTHLY CALENDAR ══ */}
        <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="font-bold text-white">{MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-white"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-blue-400 hover:text-blue-300 px-2"
                onClick={() => setCalendarMonth(new Date())}
              >
                Today
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-slate-400 hover:text-white"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-3 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-500 uppercase py-1 tracking-wider">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5 px-3 pb-4">
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const today = new Date();
              const isToday = (d: number) =>
                today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;

              const cells = [];
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`e-${i}`} className="h-14 sm:h-16" />);
              }
              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const jobsOnDay = calJobsByDate[date.toDateString()] || [];
                const showIcons = jobsOnDay.slice(0, 3);
                const overflow = jobsOnDay.length - 3;
                cells.push(
                  <div
                    key={day}
                    className={`h-14 sm:h-16 rounded-lg p-1 cursor-pointer transition-all border ${
                      isToday(day)
                        ? "border-orange-500 bg-orange-500/10 shadow-md shadow-orange-500/20"
                        : "border-slate-700/30 bg-slate-800/50 hover:bg-slate-700/50 hover:border-slate-600"
                    }`}
                    onClick={() => {
                      setCalendarSelectedDate(date);
                      setCalendarDialogOpen(true);
                    }}
                  >
                    <div className={`text-xs font-bold leading-none mb-1 ${isToday(day) ? "text-orange-400" : "text-slate-300"}`}>{day}</div>
                    <div className="flex flex-wrap gap-0.5">
                      {showIcons.map(job => (
                        <Link
                          key={job.id}
                          href={`/lead/${job.id}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <span
                            className="text-sm leading-none hover:opacity-70 transition-opacity"
                            title={`${job.firstName} ${job.lastName} — ${job.serviceType}`}
                          >
                            {getServiceIcon(job.serviceType)}
                          </span>
                        </Link>
                      ))}
                      {overflow > 0 && (
                        <span className="text-[9px] text-blue-300 font-bold leading-none self-end">+{overflow}</span>
                      )}
                    </div>
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>

        {/* ══ HISTORY SECTION ══ */}
        <div className="rounded-2xl bg-slate-800/40 border border-slate-700/40 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            onClick={() => setHistoryExpanded(h => !h)}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-400" />
              <span className="font-bold text-white">Completed Jobs History</span>
              <Badge className="bg-green-600/20 text-green-300 border-green-500/30 text-xs">{historyLeads.length}</Badge>
            </div>
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${historyExpanded ? "rotate-90" : ""}`} />
          </button>
          {historyExpanded && (
            <div className="px-4 pb-4 space-y-2">
              {historyLeads.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No completed jobs yet</p>
              ) : (
                historyLeads.map(lead => {
                  const dateStr = lead.confirmedDate || lead.moveDate;
                  const displayDate = dateStr
                    ? (() => {
                        const parts = dateStr.split("T")[0].split("-");
                        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
                          .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      })()
                    : "—";
                  return (
                    <div key={lead.id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                      <div className="text-xl w-7 text-center flex-shrink-0">{getServiceIcon(lead.serviceType)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{lead.firstName} {lead.lastName}</p>
                        <p className="text-slate-500 text-xs">{displayDate}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Award completion JCMOVES to customer"
                        className="h-7 w-7 text-amber-500/60 hover:text-amber-400 flex-shrink-0"
                        disabled={awardCustomerTokensMutation.isPending}
                        onClick={() => awardCustomerTokensMutation.mutate(lead.id)}
                      >
                        <Coins className="h-4 w-4" />
                      </Button>
                      <Link href={`/lead/${lead.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ══ CREW SPOTLIGHT (available workers) ══ */}
        <div className="rounded-2xl bg-gradient-to-br from-teal-950/50 via-slate-900 to-slate-950 border border-teal-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-teal-400" />
              <span className="font-bold text-white">Crew Spotlight</span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${availableWorkers.length > 0 ? "bg-green-500/15 text-green-400" : "bg-slate-700/50 text-slate-500"}`}>
              {availableWorkers.length} ready
            </span>
          </div>
          {availableWorkers.length === 0 ? (
            <div className="text-center py-4">
              <Power className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No crew members on duty</p>
              <p className="text-slate-600 text-xs mt-1">Workers flip the switch above to go on duty</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {availableWorkers.map(w => (
                <div key={w.id} className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-teal-600/30 flex items-center justify-center text-teal-300 text-xs font-black">
                    {(w.firstName || w.username || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">{w.firstName || w.username}</p>
                    <p className="text-teal-400 text-[10px]">🟢 On Duty</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══ QUICK ACTIONS ══ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="font-bold text-white">Quick Actions</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Add Lead", icon: ClipboardList, color: "from-blue-600 to-blue-700", href: null, action: () => setActiveTab("add") },
              { label: "Job Map", icon: MapPin, color: "from-green-600 to-green-700", href: "/jobs", action: null },
              { label: "Upload Photo", icon: Camera, color: "from-purple-600 to-purple-700", href: "/jobs", action: null },
              { label: "Rewards", icon: Coins, color: "from-amber-500 to-orange-600", href: "/marketplace", action: null },
              { label: "Leads List", icon: FileText, color: "from-slate-600 to-slate-700", href: null, action: () => setActiveTab("leads") },
              { label: "Team", icon: Users, color: "from-teal-600 to-teal-700", href: null, action: () => setActiveTab("team") },
              { label: "Quotes", icon: MessageSquare, color: "from-rose-600 to-rose-700", href: null, action: () => setActiveTab("quotes") },
              { label: "Mining", icon: Star, color: "from-yellow-600 to-amber-600", href: "/mining", action: null },
            ].map(btn => {
              const content = (
                <div
                  key={btn.label}
                  onClick={btn.action || undefined}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-gradient-to-br ${btn.color} text-white font-bold text-sm shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer select-none`}
                >
                  <btn.icon className="h-6 w-6" />
                  <span className="text-xs text-center leading-tight">{btn.label}</span>
                </div>
              );
              return btn.href ? <Link key={btn.label} href={btn.href}>{content}</Link> : <div key={btn.label}>{content}</div>;
            })}
          </div>
        </div>

        {/* ══ CREW LEADERBOARD ══ */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="font-bold text-white">Crew Leaderboard</span>
            <span className="text-slate-500 text-xs">(completed jobs)</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Complete jobs to appear on the leaderboard!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((emp, i) => (
                <div key={emp.id} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-white/[0.02] border-white/5"}`}>
                  <span className="text-xl w-8 text-center">{medals[i]}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{emp.firstName || emp.username}</p>
                    <p className="text-slate-400 text-xs capitalize">{emp.role?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-300 font-black text-lg">{emp.count}</p>
                    <p className="text-slate-500 text-[10px]">jobs</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {employees.length > 0 && leaderboard.length === 0 && (
            <p className="text-xs text-slate-600 text-center mt-2">Mark jobs as "completed" to track crew scores</p>
          )}
        </div>

        {/* ══ CREW WALLET ══ */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-950/50 via-slate-900 to-slate-950 border border-purple-500/20 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-purple-400" />
              <span className="font-bold text-white">Crew Wallet</span>
            </div>
            <Link href="/mining">
              <Button size="sm" variant="ghost" className="text-purple-400 hover:text-white h-7 text-xs">
                Mine <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <span className="text-4xl font-black text-white">{tokenBalance}</span>
            <span className="text-purple-400 font-bold mb-1">JCMOVES</span>
          </div>
          <div className="flex gap-2">
            <Link href="/marketplace" className="flex-1">
              <Button size="sm" className="w-full bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-xs h-8">
                🎁 Redeem Rewards
              </Button>
            </Link>
            <Link href="/rewards" className="flex-1">
              <Button size="sm" className="w-full bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-200 text-xs h-8">
                📊 History
              </Button>
            </Link>
          </div>
        </div>

        {/* ══ WEATHER ══ */}
        <div className={`rounded-2xl p-5 border ${wxInfo?.isSnow ? "bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border-cyan-500/30" : "bg-slate-800/40 border-slate-700/40"}`}>
          <div className="flex items-center gap-2 mb-3">
            <WxIcon className={`h-4 w-4 ${wxInfo?.color ?? "text-slate-400"}`} />
            <span className="font-bold text-white">Ironwood, MI — Weather</span>
            {wxInfo?.isSnow && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs animate-pulse">❄️ SNOW ALERT</Badge>
            )}
          </div>
          {wx ? (
            <div className="flex items-center gap-4">
              <div>
                <p className={`text-5xl font-black ${wxInfo?.color ?? "text-white"}`}>{Math.round(wx.temperature_2m)}°F</p>
                <p className="text-slate-400 text-sm mt-1">{wxInfo?.label}</p>
              </div>
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Wind className="h-3.5 w-3.5" />
                  <span>Wind: {Math.round(wx.wind_speed_10m)} mph</span>
                </div>
                {wx.precipitation > 0 && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <CloudRain className="h-3.5 w-3.5" />
                    <span>Precip: {wx.precipitation}" today</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Weather unavailable — check local forecast</p>
          )}
          {wxInfo?.isSnow && (
            <div className="mt-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-cyan-300 text-sm font-bold">🚨 Snow Crew Alert Active</p>
              <p className="text-cyan-400/70 text-xs mt-0.5">Snow removal jobs may be incoming. Be ready to mobilize!</p>
            </div>
          )}
        </div>

        {/* ══ ANNOUNCEMENTS ══ */}
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-rose-400" />
            <span className="font-bold text-white">Company Announcements</span>
          </div>
          <div className="space-y-2">
            {ANNOUNCEMENTS.map(a => (
              <div key={a.id} className="flex gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                <span className="text-xl flex-shrink-0">{a.icon}</span>
                <div>
                  <p className="text-white text-sm">{a.text}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ OPERATIONS TABS ══ */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-700/40 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-white">Operations</span>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-slate-800/50 border border-slate-700/50 mb-4">
              <TabsTrigger value="leads" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 text-xs sm:text-sm">
                <FileText className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Leads</span>
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-green-600/20 data-[state=active]:text-green-300 text-xs sm:text-sm">
                <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add Lead</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-cyan-600/20 data-[state=active]:text-cyan-300 text-xs sm:text-sm">
                <CalendarDays className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Schedule</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 text-xs sm:text-sm">
                <Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Team</span>
              </TabsTrigger>
              <TabsTrigger value="quotes" className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-300 text-xs sm:text-sm">
                <MessageSquare className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Quotes</span>
                {quotedLeads.length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{quotedLeads.length}</span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── LEADS TAB ── */}
            <TabsContent value="leads" className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setVisibleCount(10); }}
                    className="pl-9 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setVisibleCount(10); }}>
                  <SelectTrigger className="w-36 bg-slate-800/50 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="text-white capitalize">
                        {s === "all" ? "All Status" : s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {leadsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-blue-400" /></div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No leads found</p>
                  <Button className="mt-3 bg-blue-600 hover:bg-blue-500 text-sm" onClick={() => setActiveTab("add")}>
                    Add First Lead
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {filteredLeads.slice(0, visibleCount).map(lead => {
                      const sc = getStatusColors(lead.status);
                      return (
                      <Card key={lead.id} className={`border-l-4 ${sc.border} border-t border-r border-b border-slate-700/40 bg-white/[0.03] hover:bg-white/[0.05] transition-colors`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-semibold text-white text-sm">{lead.firstName} {lead.lastName}</p>
                                <LeadStatusBadge status={lead.status} />
                                {lead.serviceType && (
                                  <Badge variant="secondary" className="bg-slate-700/50 text-slate-300 text-xs">{lead.serviceType}</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                                {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                                {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                                {lead.moveDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(lead.moveDate).toLocaleDateString()}</span>}
                              </div>
                              {lead.fromAddress && (
                                <p className="flex items-start gap-1 mt-1 text-xs text-slate-500">
                                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span className="truncate">{lead.fromAddress}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Select
                                value={lead.status}
                                onValueChange={val => updateStatusMutation.mutate({ id: lead.id, status: val })}
                              >
                                <SelectTrigger className="w-28 h-7 text-xs bg-slate-700/50 border-slate-600 text-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                  {STATUS_OPTIONS.filter(s => s !== "all").map(s => (
                                    <SelectItem key={s} value={s} className="text-white text-xs capitalize">
                                      {s.replace(/_/g, " ")}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Link href={`/lead/${lead.id}`}>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-white">
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              {isAdmin && (
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-7 w-7 text-slate-600 hover:text-red-400"
                                  onClick={() => setLeadToDelete(lead)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>

                  {visibleCount < filteredLeads.length && (
                    <Button
                      variant="outline"
                      className="w-full border-slate-700 text-slate-400 hover:text-white"
                      onClick={() => setVisibleCount(c => c + 10)}
                    >
                      Show {Math.min(10, filteredLeads.length - visibleCount)} more ({filteredLeads.length - visibleCount} remaining)
                    </Button>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      <Link href="/leads">
                        <Button variant="outline" size="sm" className="border-white/10 text-slate-400 hover:text-white">
                          Full Leads View <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                      <Link href="/admin/jobs">
                        <Button variant="outline" size="sm" className="border-white/10 text-slate-400 hover:text-white">
                          Manage Jobs <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* ── ADD LEAD TAB ── */}
            <TabsContent value="add">
              <div className="h-[600px]">
                <BookingChatbot
                  variant="employee"
                  embedded={true}
                  onSuccess={() => {
                    invalidateLeads();
                    setActiveTab("leads");
                    toast({ title: "✅ Lead added!", description: "Lead has been saved." });
                  }}
                />
              </div>
            </TabsContent>

            {/* ── SCHEDULE TAB ── */}
            <TabsContent value="schedule" className="space-y-4">

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "This Week", val: myAvailability?.stats.thisWeek ?? 0, icon: TrendingUp, color: "text-cyan-400" },
                  { label: "This Month", val: myAvailability?.stats.thisMonth ?? 0, icon: Calendar, color: "text-blue-400" },
                  { label: "All Time", val: myAvailability?.stats.allTime ?? 0, icon: Trophy, color: "text-yellow-400" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-3 text-center">
                    <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                    <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Goal Progress */}
              {myAvailability?.goals && (myAvailability.goals.weeklyJobGoal ?? 0) > 0 && (
                <div className="bg-slate-800/40 border border-cyan-500/20 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-cyan-300 font-semibold flex items-center gap-1"><Target className="h-3 w-3" /> Goal Progress</p>
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Weekly: {myAvailability.stats.thisWeek} / {myAvailability.goals.weeklyJobGoal} jobs</span>
                      <span>{Math.round((myAvailability.stats.thisWeek / (myAvailability.goals.weeklyJobGoal || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (myAvailability.stats.thisWeek / (myAvailability.goals.weeklyJobGoal || 1)) * 100)}%` }} />
                    </div>
                  </div>
                  {(myAvailability.goals.monthlyJobGoal ?? 0) > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Monthly: {myAvailability.stats.thisMonth} / {myAvailability.goals.monthlyJobGoal} jobs</span>
                        <span>{Math.round((myAvailability.stats.thisMonth / (myAvailability.goals.monthlyJobGoal || 1)) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (myAvailability.stats.thisMonth / (myAvailability.goals.monthlyJobGoal || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Set My Goals */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2"><Target className="h-4 w-4 text-cyan-400" /> My Job Goals</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider">Weekly Goal</label>
                    <Input
                      type="number" min="0" max="50"
                      value={goalWeekly || myAvailability?.goals?.weeklyJobGoal || 0}
                      onChange={e => setGoalWeekly(parseInt(e.target.value) || 0)}
                      className="mt-1 h-8 text-sm bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Jobs / week"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider">Monthly Goal</label>
                    <Input
                      type="number" min="0" max="200"
                      value={goalMonthly || myAvailability?.goals?.monthlyJobGoal || 0}
                      onChange={e => setGoalMonthly(parseInt(e.target.value) || 0)}
                      className="mt-1 h-8 text-sm bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Jobs / month"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">Preferred Job Size</label>
                  <Select value={goalJobSize || myAvailability?.goals?.preferredJobSize || "any"} onValueChange={setGoalJobSize}>
                    <SelectTrigger className="mt-1 h-8 text-sm bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {["any", "small", "medium", "large"].map(s => (
                        <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={() => saveGoalsMutation.mutate({ weeklyJobGoal: goalWeekly || myAvailability?.goals?.weeklyJobGoal || 0, monthlyJobGoal: goalMonthly || myAvailability?.goals?.monthlyJobGoal || 0, preferredJobSize: goalJobSize || myAvailability?.goals?.preferredJobSize || "any" })} disabled={saveGoalsMutation.isPending} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-8 text-sm">
                  {saveGoalsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />} Save Goals
                </Button>
              </div>

              {/* Block a Day Off */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2"><CalendarDays className="h-4 w-4 text-red-400" /> Block a Day Off</p>
                <div className="flex gap-2">
                  <DatePicker
                    value={blockDate || undefined}
                    onChange={(v) => setBlockDate(v || "")}
                    placeholder="Pick a date"
                  />
                  <Input
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="h-8 text-sm bg-slate-700/50 border-slate-600 text-white flex-1"
                  />
                  <Button size="sm" onClick={() => blockDate && addDayBlockMutation.mutate({ date: blockDate, reason: blockReason })} disabled={!blockDate || addDayBlockMutation.isPending} className="h-8 bg-red-700 hover:bg-red-600 text-white shrink-0">
                    {addDayBlockMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Block"}
                  </Button>
                </div>
                {(myAvailability?.blocks ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    {myAvailability!.blocks.map(b => (
                      <div key={b.id} className="flex items-center justify-between bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-1.5">
                        <div>
                          <span className="text-sm text-white font-medium">{b.date}</span>
                          {b.reason && <span className="text-xs text-slate-400 ml-2">— {b.reason}</span>}
                        </div>
                        <button onClick={() => removeDayBlockMutation.mutate(b.id)} className="text-red-400 hover:text-red-300">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weekly Availability Hours */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" /> Weekly Availability</p>
                <p className="text-xs text-slate-500">Set your available hours for each day. This helps us build the best crews.</p>
                <div className="space-y-2">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, dow) => {
                    const existing = (myAvailability?.schedule ?? []).find(s => s.dayOfWeek === dow);
                    const avail = existing?.isAvailable ?? true;
                    return (
                      <div key={dow} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${avail ? "border-slate-700/40 bg-slate-800/30" : "border-slate-800/30 bg-slate-900/50 opacity-50"}`}>
                        <button
                          onClick={() => updateScheduleMutation.mutate({ dayOfWeek: dow, startHour: existing?.startHour ?? 8, endHour: existing?.endHour ?? 17, isAvailable: !avail })}
                          className={`w-8 h-5 rounded-full transition-colors shrink-0 ${avail ? "bg-cyan-600" : "bg-slate-600"}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-white rounded-full mx-auto transition-transform ${avail ? "translate-x-1.5" : "-translate-x-1.5"}`} />
                        </button>
                        <span className="text-xs font-medium text-slate-300 w-7">{day}</span>
                        {avail && (
                          <>
                            <select
                              value={existing?.startHour ?? 8}
                              onChange={e => updateScheduleMutation.mutate({ dayOfWeek: dow, startHour: parseInt(e.target.value), endHour: existing?.endHour ?? 17, isAvailable: true })}
                              className="text-xs bg-slate-700 border-0 text-white rounded px-1 py-0.5 flex-1"
                            >
                              {Array.from({ length: 24 }, (_, h) => (
                                <option key={h} value={h}>{h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`}</option>
                              ))}
                            </select>
                            <span className="text-slate-500 text-xs">to</span>
                            <select
                              value={existing?.endHour ?? 17}
                              onChange={e => updateScheduleMutation.mutate({ dayOfWeek: dow, startHour: existing?.startHour ?? 8, endHour: parseInt(e.target.value), isAvailable: true })}
                              className="text-xs bg-slate-700 border-0 text-white rounded px-1 py-0.5 flex-1"
                            >
                              {Array.from({ length: 24 }, (_, h) => (
                                <option key={h} value={h}>{h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`}</option>
                              ))}
                            </select>
                          </>
                        )}
                        {!avail && <span className="text-xs text-slate-500 ml-1">Off</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin: all workers availability overview */}
              {isAdmin && allWorkersAvail.length > 0 && (
                <div className="bg-slate-800/40 border border-purple-500/20 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-white flex items-center gap-2"><Users className="h-4 w-4 text-purple-400" /> Crew Availability Overview</p>
                  <div className="space-y-2">
                    {allWorkersAvail.map(w => {
                      const todayStr = new Date().toISOString().split("T")[0];
                      const isBlocked = w.blockedDates.includes(todayStr);
                      const weekGoal = w.goals?.weeklyJobGoal || 0;
                      const monthGoal = w.goals?.monthlyJobGoal || 0;
                      return (
                        <div key={w.user.id} className={`rounded-lg border p-3 ${isBlocked ? "border-red-800/30 bg-red-950/20" : "border-slate-700/30 bg-slate-800/20"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${(w.user as any).isAvailable && !isBlocked ? "bg-green-400" : "bg-red-400"}`} />
                              <span className="text-sm font-medium text-white">{w.user.firstName} {w.user.lastName || ""}</span>
                              {isBlocked && <Badge className="bg-red-900/50 text-red-300 border-red-700/30 text-[10px]">Day Off</Badge>}
                            </div>
                            <button
                              onClick={() => { setAdminGoalTarget(w.user.id); setAdminGoalWeekly(weekGoal); setAdminGoalMonthly(monthGoal); }}
                              className="text-slate-400 hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <span>Week: <strong className="text-cyan-300">{w.thisWeek}</strong>{weekGoal > 0 ? ` / ${weekGoal}` : ""} jobs</span>
                            <span>Month: <strong className="text-blue-300">{w.thisMonth}</strong>{monthGoal > 0 ? ` / ${monthGoal}` : ""} jobs</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="team" className="space-y-3">
              {employees.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No team members found</p>
                </div>
              ) : (
                employees.map(emp => (
                  <Card key={emp.id} className="border-white/5 bg-white/[0.03]">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(emp.firstName?.[0] || emp.username?.[0] || "?").toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{emp.firstName} {emp.lastName || ""}</p>
                          <p className="text-slate-400 text-xs">{emp.email}</p>
                        </div>
                        {isAdmin ? (
                          <Select
                            value={emp.role}
                            onValueChange={val => updateRoleMutation.mutate({ id: emp.id, role: val })}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs bg-slate-700/50 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {["employee", "admin", "business_owner"].map(r => (
                                <SelectItem key={r} value={r} className="text-white text-xs capitalize">
                                  {r.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className="bg-slate-700/50 text-slate-300 border-slate-600 text-xs capitalize">
                            {emp.role?.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              {isAdmin && (
                <Link href="/admin/users">
                  <Button variant="outline" size="sm" className="border-white/10 text-slate-400 hover:text-white">
                    Manage All Users <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </TabsContent>

            {/* ── QUOTES TAB ── */}
            <TabsContent value="quotes" className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-white">Pending Quotes ({quotedLeads.length})</h3>
              </div>
              {quotedLeads.length === 0 ? (
                <div className="text-center py-10 text-slate-500 border border-white/5 rounded-xl">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No pending quotes</p>
                </div>
              ) : (
                quotedLeads.map(lead => (
                  <Card key={lead.id} className="border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-white">{lead.firstName} {lead.lastName}</p>
                          <p className="text-slate-400 text-xs">{lead.serviceType} · {lead.phone}</p>
                        </div>
                        <Link href={`/lead/${lead.id}`}>
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-xs h-8">
                            Review <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              <div className="flex gap-2 flex-wrap">
                <Link href="/leads">
                  <Button variant="outline" size="sm" className="border-white/10 text-slate-400 hover:text-white">
                    All Quotes <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Link href="/leads?filter=chatbot">
                  <Button variant="outline" size="sm" className="border-white/10 text-slate-400 hover:text-white">
                    Chatbot Quotes <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
              {isAdmin && (
                <div className="border-t border-white/5 pt-4">
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-3 font-semibold">Admin Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "🛡️ Admin Control Center", href: "/control" },
                      { label: "💰 Treasury", href: "/in-god-we-trust" },
                      { label: "👥 Users", href: "/admin/users" },
                      { label: "🎁 Marketplace Mgmt", href: "/admin/marketplace" },
                      { label: "🏷️ Promo Codes", href: "/admin/promo-codes" },
                      { label: "⚙️ System Check", href: "/admin/system-check" },
                    ].map(item => (
                      <Link key={item.href} href={item.href}>
                        <Button variant="outline" size="sm" className="w-full border-white/10 text-slate-400 hover:text-white text-xs justify-start">
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ══ FOOTER BRAND ══ */}
        <div className="text-center py-4">
          <p className="text-slate-700 text-xs font-semibold tracking-wide">🚛 JC ON THE MOVE LLC</p>
          <p className="text-slate-800 text-xs">Northwoods Moving & More · Michigan & Wisconsin</p>
        </div>

      </div>

      {/* ── CALENDAR DAY DIALOG ── */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {calendarSelectedDate?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {calSelectedJobs.length === 0
                ? "No jobs scheduled — tap below to add one."
                : `${calSelectedJobs.length} job${calSelectedJobs.length > 1 ? "s" : ""} scheduled`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {calSelectedJobs.length === 0 ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-slate-500 text-sm">Nothing scheduled for this day.</p>
                <Link href={`/leads${calendarSelectedDate ? `?tab=add&date=${calendarSelectedDate.toISOString().split("T")[0]}` : "?tab=add"}`}>
                  <Button
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 w-full"
                    onClick={() => setCalendarDialogOpen(false)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add a Job
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {calSelectedJobs.map(job => (
                  <div key={job.id} className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/10">
                    <div className="text-2xl w-8 text-center flex-shrink-0">{getServiceIcon(job.serviceType)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{job.firstName} {job.lastName}</p>
                      <p className="text-slate-400 text-xs truncate">{job.fromAddress}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <LeadStatusBadge status={job.status} />
                      <Link href={`/lead/${job.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white" onClick={() => setCalendarDialogOpen(false)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/10">
                  <Link href={`/leads${calendarSelectedDate ? `?tab=add&date=${calendarSelectedDate.toISOString().split("T")[0]}` : "?tab=add"}`}>
                    <Button variant="outline" className="w-full border-white/10 text-slate-300 hover:text-white hover:bg-white/5" onClick={() => setCalendarDialogOpen(false)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Job
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ADMIN SET GOALS DIALOG ── */}
      <Dialog open={!!adminGoalTarget} onOpenChange={() => setAdminGoalTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><Target className="h-4 w-4 text-cyan-400" /> Set Worker Goals</DialogTitle>
            <DialogDescription className="text-slate-400">Set weekly and monthly job goals for this crew member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Weekly Job Goal</label>
              <Input type="number" min="0" value={adminGoalWeekly} onChange={e => setAdminGoalWeekly(parseInt(e.target.value) || 0)} className="mt-1 bg-slate-800 border-slate-600 text-white" placeholder="Jobs per week" />
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider">Monthly Job Goal</label>
              <Input type="number" min="0" value={adminGoalMonthly} onChange={e => setAdminGoalMonthly(parseInt(e.target.value) || 0)} className="mt-1 bg-slate-800 border-slate-600 text-white" placeholder="Jobs per month" />
            </div>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" disabled={setAdminGoalsMutation.isPending} onClick={() => adminGoalTarget && setAdminGoalsMutation.mutate({ userId: adminGoalTarget, weeklyJobGoal: adminGoalWeekly, monthlyJobGoal: adminGoalMonthly })}>
              {setAdminGoalsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Save Goals
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <AlertDialog open={!!leadToDelete} onOpenChange={() => setLeadToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove job from active jobs?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This archives {leadToDelete?.firstName} {leadToDelete?.lastName}'s job. It disappears from active lists and calendars but can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500"
              onClick={() => leadToDelete && deleteLeadMutation.mutate(leadToDelete.id)}
            >
              Archive job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
