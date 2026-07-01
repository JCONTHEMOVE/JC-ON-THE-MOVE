import {
  CheckCircle2,
  ClipboardList,
  Layers3,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  MARKETPLACE_FUNCTIONAL_IDEAS,
  MARKETPLACE_LAUNCH_SOURCE_TARGETS,
  MARKETPLACE_REFERENCE_BLUEPRINTS,
  MARKETPLACE_REQUEST_SHAPES,
  MARKETPLACE_SOURCE_FLOW_MATRIX,
  type MarketplaceFunctionalIdeaStatus,
  type MarketplaceLaunchSourceTarget,
  type MarketplaceLaunchSourceTargetGroup,
  type MarketplaceRequestShapeId,
} from "@shared/marketplaceShapes";

type MarketplaceCoverageAuditProps = {
  className?: string;
};

type CoverageStatus = MarketplaceFunctionalIdeaStatus | "covered" | "missing";

const anchors = MARKETPLACE_LAUNCH_SOURCE_TARGETS;

const groupLabels: Record<MarketplaceLaunchSourceTargetGroup, string> = {
  retail: "Retail / reuse",
  moving: "Moving logistics",
  trust: "Local demand",
  growth: "Rewards / marketing",
  payments: "Payment rails",
};

const statusClasses: Record<CoverageStatus, string> = {
  live: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  in_progress: "border-blue-400/30 bg-blue-500/10 text-blue-200",
  next: "border-orange-400/30 bg-orange-500/10 text-orange-200",
  covered: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  missing: "border-red-400/30 bg-red-500/10 text-red-200",
};

function searchableText(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function includesAlias(text: string, aliases: string[]) {
  return aliases.some((alias) => text.includes(alias.toLowerCase()));
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values));
}

function shapeLabel(id: MarketplaceRequestShapeId) {
  return MARKETPLACE_REQUEST_SHAPES.find((shape) => shape.id === id)?.shape || id.replace(/_/g, " ");
}

function anchorCoverage(anchor: MarketplaceLaunchSourceTarget) {
  const sourceFlows = MARKETPLACE_SOURCE_FLOW_MATRIX.filter((flow) =>
    includesAlias(
      searchableText(
        flow.source,
        flow.category,
        flow.borrowedSignal,
        flow.start,
        flow.progress,
        flow.finish,
        flow.surfaces,
      ),
      anchor.aliases,
    )
  );
  const ideas = MARKETPLACE_FUNCTIONAL_IDEAS.filter((idea) =>
    includesAlias(searchableText(idea.reference, idea.pattern, idea.jcMove, idea.surface), anchor.aliases)
  );
  const blueprints = MARKETPLACE_REFERENCE_BLUEPRINTS.filter((blueprint) =>
    includesAlias(searchableText(blueprint.reference, blueprint.borrow, blueprint.jcSurface, blueprint.nextBuild), anchor.aliases)
  );
  const shapeIds = uniq([
    ...sourceFlows.flatMap((flow) => flow.shapeIds),
    ...ideas.flatMap((idea) => idea.shapeIds),
  ]);
  const surfaces = uniq([
    ...sourceFlows.flatMap((flow) => flow.surfaces.split(",").map((surface) => surface.trim()).filter(Boolean)),
    ...ideas.map((idea) => idea.surface),
    ...blueprints.map((blueprint) => blueprint.jcSurface),
  ]).slice(0, 4);
  const statuses = uniq([...sourceFlows.map((flow) => flow.status), ...ideas.map((idea) => idea.status)]);
  const covered = sourceFlows.length > 0 || ideas.length > 0 || blueprints.length > 0;
  let primaryStatus: CoverageStatus = "missing";
  if (statuses.includes("live")) {
    primaryStatus = "live";
  } else if (statuses.includes("in_progress")) {
    primaryStatus = "in_progress";
  } else if (statuses.includes("next")) {
    primaryStatus = "next";
  } else if (covered) {
    primaryStatus = "covered";
  }

  return { sourceFlows, ideas, blueprints, shapeIds, surfaces, covered, primaryStatus };
}

export default function MarketplaceCoverageAudit({ className = "" }: MarketplaceCoverageAuditProps) {
  const rows = anchors.map((anchor) => ({ anchor, coverage: anchorCoverage(anchor) }));
  const coveredCount = rows.filter((row) => row.coverage.covered).length;
  const liveCount = rows.filter((row) => row.coverage.primaryStatus === "live").length;
  const nextRows = rows.filter((row) => row.coverage.primaryStatus === "next" || !row.coverage.covered);

  return (
    <section className={`rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">Marketplace Coverage Audit</p>
          </div>
          <h2 className="mt-1 text-sm font-black text-white">Named inspiration coverage</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300">
            This checks whether the sources we keep talking about are tied to a request shape, a JC surface, and a
            customer / worker / company reality.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Score icon={CheckCircle2} label="Covered" value={`${coveredCount}/${anchors.length}`} />
          <Score icon={ShieldCheck} label="Live" value={String(liveCount)} />
          <Score icon={Layers3} label="Shapes" value={String(MARKETPLACE_REQUEST_SHAPES.length)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {rows.map(({ anchor, coverage }) => (
          <div key={anchor.label} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-white">{anchor.label}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {groupLabels[anchor.group]}
                </p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusClasses[coverage.primaryStatus]}`}>
                {coverage.primaryStatus.replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniFact label="Flows" value={String(coverage.sourceFlows.length)} />
              <MiniFact label="Ideas" value={String(coverage.ideas.length)} />
              <MiniFact label="Blueprints" value={String(coverage.blueprints.length)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {coverage.shapeIds.length > 0 ? (
                coverage.shapeIds.map((shapeId) => (
                  <span key={shapeId} className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-200">
                    {shapeLabel(shapeId)}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-200">
                  Needs shape
                </span>
              )}
            </div>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Surfaces</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {coverage.surfaces.length > 0 ? coverage.surfaces.join(" / ") : "Needs a JC surface"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-orange-400/20 bg-orange-500/10 p-3">
        <div className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-200">Next conversion targets</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              {nextRows.length > 0
                ? nextRows.map((row) => row.anchor.label).join(", ")
                : "All named anchors have active coverage. Keep tuning the operational depth."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Score({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-emerald-400/20 bg-slate-950/60 px-3 py-2">
      <div className="flex items-center justify-center gap-1 text-emerald-300">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm font-black">{value}</span>
      </div>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/60 p-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-black text-white">{value}</p>
    </div>
  );
}
