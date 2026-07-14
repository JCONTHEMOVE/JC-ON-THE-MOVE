import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";
import {
  MARKETPLACE_LAUNCH_SOURCE_TARGETS,
  getMarketplaceLaunchSourceTargetsForFlow,
  getMarketplaceLaunchTasks,
  type MarketplaceActionRail,
  type MarketplaceLaunchTask,
  type MarketplaceSourceReadinessLevel,
} from "@shared/marketplaceShapes";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type MarketplaceSourceReadinessBoardProps = {
  className?: string;
  compact?: boolean;
  limit?: number;
};

type LaunchTaskView = MarketplaceLaunchTask & {
  bonusTokens?: number;
  completedByMe?: boolean;
  completionCount?: number;
  canComplete?: boolean;
  completionReason?: string;
};

type LaunchTasksResponse = {
  summary?: {
    totalTasks: number;
    openTasks: number;
    readyCount: number;
    watchCount: number;
    buildCount: number;
    availableBonusTokens: number;
  };
  tasks: LaunchTaskView[];
};

const readinessClasses: Record<MarketplaceSourceReadinessLevel, string> = {
  ready: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  watch: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  build: "border-orange-400/30 bg-orange-500/10 text-orange-200",
};

const readinessIcons: Record<MarketplaceSourceReadinessLevel, typeof ClipboardCheck> = {
  ready: CheckCircle2,
  watch: TriangleAlert,
  build: Wrench,
};

const railClasses: Record<MarketplaceActionRail, string> = {
  customer: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  bronze: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  silver: "border-slate-300/30 bg-slate-400/10 text-slate-200",
  gold: "border-yellow-400/30 bg-yellow-500/10 text-yellow-200",
  platinum: "border-purple-400/30 bg-purple-500/10 text-purple-200",
};

function fallbackRows(limit?: number): LaunchTaskView[] {
  const rows = getMarketplaceLaunchTasks();

  return typeof limit === "number" ? rows.slice(0, Math.max(0, limit)) : rows;
}

function readinessLabel(value: MarketplaceSourceReadinessLevel) {
  if (value === "ready") return "Ready";
  if (value === "watch") return "Watch";
  return "Build";
}

export default function MarketplaceSourceReadinessBoard({
  className = "",
  compact = false,
  limit,
}: MarketplaceSourceReadinessBoardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [proofByTask, setProofByTask] = useState<Record<string, string>>({});
  const [targetFilter, setTargetFilter] = useState("all");
  const { data } = useQuery<LaunchTasksResponse>({
    queryKey: ["/api/marketplace/launch-tasks"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const completeMutation = useMutation({
    mutationFn: async ({ taskId, proofNotes }: { taskId: string; proofNotes: string }) => {
      const res = await apiRequest("POST", `/api/marketplace/launch-tasks/${taskId}/complete`, { proofNotes });
      return res.json();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/launch-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/history"] });
      setProofByTask((current) => ({ ...current, [variables.taskId]: "" }));
      toast({
        title: result.awarded ? "Launch bonus issued" : "Already claimed",
        description: result.awarded
          ? `${Number(result.bonusTokens || 0).toLocaleString()} JCMOVES added.`
          : result.reason || "This launch task was already recorded.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Launch task not claimed", description: error.message, variant: "destructive" });
    },
  });
  const rows = useMemo(() => {
    const source = data?.tasks && data.tasks.length > 0 ? data.tasks : fallbackRows(limit);
    const filtered = targetFilter === "all"
      ? source
      : source.filter((task) =>
        getMarketplaceLaunchSourceTargetsForFlow(task.sourceFlowId).some((target) => target.label === targetFilter)
      );
    return typeof limit === "number" ? filtered.slice(0, Math.max(0, limit)) : filtered;
  }, [data?.tasks, limit, targetFilter]);
  if (rows.length === 0) return null;

  const ready = data?.summary?.readyCount ?? rows.filter((row) => row.readiness === "ready").length;
  const watch = data?.summary?.watchCount ?? rows.filter((row) => row.readiness === "watch").length;
  const build = data?.summary?.buildCount ?? rows.filter((row) => row.readiness === "build").length;

  return (
    <section className={`rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-violet-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">Launch Task Queue</p>
          </div>
          <h2 className="mt-1 text-sm font-black text-white">What each borrowed idea needs before publish</h2>
          {!compact && (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
              This keeps the outside-source inspiration practical: owner rail, next action, publish proof, automation
              gate, and the JCMOVES close for every source flow.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Score label="Ready" value={String(ready)} />
          <Score label="Watch" value={String(watch)} />
          <Score label="Build" value={String(build)} />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500" htmlFor="marketplace-launch-target-filter">
            Target focus
          </label>
          <select
            id="marketplace-launch-target-filter"
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-violet-400"
          >
            <option value="all">All source targets</option>
            {MARKETPLACE_LAUNCH_SOURCE_TARGETS.map((target) => (
              <option key={target.label} value={target.label}>
                {target.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {rows.map((task) => (
          <ReadinessCard
            key={task.id}
            task={task}
            compact={compact}
            proofNote={proofByTask[task.id] || ""}
            onProofNoteChange={(value) => setProofByTask((current) => ({ ...current, [task.id]: value }))}
            onComplete={() => completeMutation.mutate({ taskId: task.id, proofNotes: proofByTask[task.id] || "" })}
            completing={completeMutation.isPending && completeMutation.variables?.taskId === task.id}
          />
        ))}
      </div>
    </section>
  );
}

function ReadinessCard({
  task,
  compact,
  proofNote,
  onProofNoteChange,
  onComplete,
  completing,
}: {
  task: LaunchTaskView;
  compact: boolean;
  proofNote: string;
  onProofNoteChange: (value: string) => void;
  onComplete: () => void;
  completing: boolean;
}) {
  const ReadyIcon = readinessIcons[task.readiness];
  const canComplete = Boolean(task.canComplete);
  const completed = Boolean(task.completedByMe);
  const bonusTokens = Number(task.bonusTokens ?? task.completionBonusJcMoves ?? 0);
  const sourceTargets = getMarketplaceLaunchSourceTargetsForFlow(task.sourceFlowId);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/65 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{task.title}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200">{task.category}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${railClasses[task.ownerRail]}`}>
            {task.ownerRail}
          </span>
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${readinessClasses[task.readiness]}`}>
            <ReadyIcon className="h-3 w-3" />
            {readinessLabel(task.readiness)}
          </span>
        </div>
      </div>

      {sourceTargets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceTargets.slice(0, 4).map((target) => (
            <span
              key={target.label}
              className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-100"
            >
              {target.label}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-md border border-violet-400/15 bg-violet-500/10 p-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-200">Launch Question</p>
        <p className="mt-1 text-[11px] leading-4 text-slate-300">{task.launchQuestion}</p>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-300">{task.action}</p>

      <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <MiniFact icon={ClipboardCheck} label="Acceptance" value={task.acceptanceCriteria} />
        <MiniFact icon={CheckCircle2} label="Surface" value={task.surfaces} />
        {!compact && <MiniFact icon={ShieldCheck} label="Automation Gate" value={task.automationGate} />}
        {!compact && <MiniFact icon={BadgeDollarSign} label="Reward Close" value={task.rewardClose} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
          <Users className="h-3 w-3 text-violet-300" />
          {task.linkedActionTaskIds.length} task{task.linkedActionTaskIds.length === 1 ? "" : "s"}
        </span>
        {task.totalMappedBonusJcMoves > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-orange-400/25 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
            <Coins className="h-3 w-3" />
            {task.totalMappedBonusJcMoves.toLocaleString()} JCMOVES mapped
          </span>
        )}
        {bonusTokens > 0 && (
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
            +{bonusTokens.toLocaleString()} claim bonus
          </span>
        )}
        {task.flywheelStages.map((stageId) => (
          <span key={stageId} className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-200">
            {stageId}
          </span>
        ))}
      </div>

      {(canComplete || completed || task.completionReason) && (
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-900/65 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {completed ? "Claimed" : "Claim"}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            {task.completionReason || "Add proof notes to claim the launch task."}
          </p>
          {canComplete && (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <textarea
                value={proofNote}
                onChange={(event) => onProofNoteChange(event.target.value)}
                placeholder="Proof note: what changed, where it can be verified..."
                className="min-h-16 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-violet-400"
              />
              <button
                type="button"
                onClick={onComplete}
                disabled={completing}
                className="rounded-md border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-black uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completing ? "Claiming" : "Claim"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-violet-400/20 bg-slate-950/60 px-3 py-2">
      <p className="text-sm font-black text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-200">{label}</p>
    </div>
  );
}

function MiniFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/65 p-2.5">
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3 w-3 text-violet-300" />
        {label}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-slate-300">{value}</p>
    </div>
  );
}
