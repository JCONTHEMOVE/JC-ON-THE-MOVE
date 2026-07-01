import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import {
  MARKETPLACE_ACTION_TASKS,
  MARKETPLACE_LAUNCH_SOURCE_TARGETS,
  MARKETPLACE_SOURCE_FLOW_MATRIX,
  getMarketplaceReferenceBlueprintsForSource,
  getMarketplaceSourceFlowForSource,
  type MarketplaceActionPhase,
  type MarketplaceFunctionalIdeaStatus,
  type MarketplaceLaunchSourceTarget,
  type MarketplaceLaunchSourceTargetGroup,
  type MarketplaceSideId,
  type MarketplaceSourceFlow,
} from "@shared/marketplaceShapes";

type MarketplaceSourceLookupProps = {
  className?: string;
};

const phaseMeta: Record<MarketplaceActionPhase, {
  label: string;
  icon: typeof ClipboardList;
  color: string;
}> = {
  start: {
    label: "1 Start",
    icon: ClipboardList,
    color: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
  },
  progress: {
    label: "2 Progress",
    icon: ArrowRight,
    color: "border-blue-400/20 bg-blue-500/10 text-blue-200",
  },
  finish: {
    label: "3 Finish",
    icon: CheckCircle2,
    color: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  },
};

const sideMeta: Record<MarketplaceSideId, {
  label: string;
  icon: typeof Users;
  color: string;
}> = {
  customer: {
    label: "Customer",
    icon: Users,
    color: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
  },
  worker: {
    label: "Worker",
    icon: ClipboardList,
    color: "border-orange-400/25 bg-orange-500/10 text-orange-100",
  },
  company: {
    label: "Company",
    icon: ShieldCheck,
    color: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
  },
};

const statusClasses: Record<MarketplaceFunctionalIdeaStatus, string> = {
  live: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  in_progress: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  next: "border-orange-400/30 bg-orange-500/10 text-orange-200",
};

const targetGroupLabels: Record<MarketplaceLaunchSourceTargetGroup, string> = {
  retail: "Retail / reuse",
  moving: "Moving logistics",
  trust: "Local demand",
  growth: "Rewards / marketing",
  payments: "Payment rails",
};

function statusLabel(status: MarketplaceFunctionalIdeaStatus) {
  return status.replace(/_/g, " ");
}

function sourceMove(flow: MarketplaceSourceFlow, side: MarketplaceSideId) {
  if (side === "customer") return flow.customerMove;
  if (side === "worker") return flow.workerMove;
  return flow.companyControl;
}

function phaseValue(flow: MarketplaceSourceFlow, phase: MarketplaceActionPhase) {
  if (phase === "start") return flow.start;
  if (phase === "progress") return flow.progress;
  return flow.finish;
}

function sourceFlowForTarget(target: MarketplaceLaunchSourceTarget) {
  return target.aliases
    .map((alias) => getMarketplaceSourceFlowForSource(alias))
    .find((resolvedFlow): resolvedFlow is MarketplaceSourceFlow => Boolean(resolvedFlow));
}

export default function MarketplaceSourceLookup({ className = "" }: MarketplaceSourceLookupProps) {
  const [sourceId, setSourceId] = useState("uhaul_movinghelp");
  const [selectedTarget, setSelectedTarget] = useState<string | null>("MovingHelp / MovingHelper");
  const [side, setSide] = useState<MarketplaceSideId>("company");
  const flow = MARKETPLACE_SOURCE_FLOW_MATRIX.find((item) => item.id === sourceId) || MARKETPLACE_SOURCE_FLOW_MATRIX[0];
  const blueprints = useMemo(
    () => getMarketplaceReferenceBlueprintsForSource(flow.source, 4),
    [flow.source],
  );
  const matchingTasks = useMemo(
    () => MARKETPLACE_ACTION_TASKS
      .filter((task) => task.flowIds.includes(flow.id))
      .slice(0, 5),
    [flow.id],
  );

  return (
    <section className={`rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">Source Lookup</p>
          </div>
          <h2 className="mt-1 text-sm font-black text-white">Pick a model, see the JC move</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
            Each outside reference becomes one simple path: start the card, progress the quote, finish the job.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClasses[flow.status]}`}>
          {statusLabel(flow.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Launch targets</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">
              Pick the plain-English model first, then inspect the operating flow below.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {MARKETPLACE_LAUNCH_SOURCE_TARGETS.map((target) => {
                const targetFlow = sourceFlowForTarget(target);
                const active = target.label === selectedTarget;
                return (
                  <button
                    key={target.label}
                    type="button"
                    onClick={() => {
                      if (targetFlow) setSourceId(targetFlow.id);
                      setSelectedTarget(target.label);
                    }}
                    className={`rounded-md border p-3 text-left transition ${
                      active
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                        : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase tracking-wide">{target.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 opacity-80">
                      {targetGroupLabels[target.group]} {targetFlow ? `-> ${targetFlow.source}` : "-> needs flow"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Operating flow</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {MARKETPLACE_SOURCE_FLOW_MATRIX.map((item) => {
                const active = item.id === flow.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSourceId(item.id);
                      setSelectedTarget(null);
                    }}
                    className={`rounded-md border p-3 text-left transition ${
                      active
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase tracking-wide">{item.source}</span>
                    <span className="mt-1 block text-[11px] leading-4 opacity-80">{item.category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Side</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["customer", "worker", "company"] as MarketplaceSideId[]).map((item) => {
                const meta = sideMeta[item];
                const Icon = meta.icon;
                const active = item === side;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSide(item)}
                    className={`rounded-md border p-2 text-center transition ${
                      active
                        ? meta.color
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <Icon className="mx-auto h-4 w-4" />
                    <span className="mt-1 block text-[10px] font-black uppercase tracking-wide">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-white">{flow.source}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">{flow.category}</p>
              </div>
              <Megaphone className="h-5 w-5 text-cyan-300" />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              <span className="font-bold text-white">Borrow:</span> {flow.borrowedSignal}
            </p>
          </div>

          {blueprints.length > 0 && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                    Operating Blueprints
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    Borrow the useful pattern, avoid the trap, and track the next build.
                  </p>
                </div>
                <span className="rounded-full border border-amber-400/30 bg-slate-950/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                  {blueprints.length} matched
                </span>
              </div>
              <div className="mt-3 grid gap-2">
                {blueprints.map((blueprint) => (
                  <div key={blueprint.reference} className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-black text-white">{blueprint.reference}</p>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">
                        {blueprint.metric}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <BlueprintFact label="Borrow" value={blueprint.borrow} tone="emerald" />
                      <BlueprintFact label="Avoid" value={blueprint.avoid} tone="red" />
                    </div>
                    <BlueprintFact label="Next build" value={blueprint.nextBuild} tone="blue" className="mt-2" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-3">
            {(["start", "progress", "finish"] as MarketplaceActionPhase[]).map((phase) => {
              const meta = phaseMeta[phase];
              const Icon = meta.icon;
              return (
                <div key={phase} className={`rounded-lg border p-3 ${meta.color}`}>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-200">{phaseValue(flow, phase)}</p>
                </div>
              );
            })}
          </div>

          <div className={`rounded-lg border p-4 ${sideMeta[side].color}`}>
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = sideMeta[side].icon;
                return <Icon className="h-4 w-4" />;
              })()}
              <p className="text-[10px] font-black uppercase tracking-[0.16em]">{sideMeta[side].label} reality</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-100">{sourceMove(flow, side)}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <MiniFact icon={ShieldCheck} label="Automation" value={flow.automationHook} />
            <MiniFact icon={BadgeDollarSign} label="Reward" value={flow.rewardTrigger} />
            <MiniFact icon={WalletCards} label="Surfaces" value={flow.surfaces} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Matching tasks</p>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {matchingTasks.length} linked
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {matchingTasks.map((task) => (
                <div key={task.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-white">{task.title}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {task.phase} / {task.rail}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                      {task.bonusJcMoves} JCMOVES
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{task.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BlueprintFact({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  tone: "blue" | "emerald" | "red";
  className?: string;
}) {
  const classes = {
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-200",
    emerald: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    red: "border-red-400/20 bg-red-500/10 text-red-200",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${classes} ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">{value}</p>
    </div>
  );
}

function MiniFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-cyan-300" />
        {label}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-300">{value}</p>
    </div>
  );
}
