// Task #175 - Admin "Launch Checklist" page (closet).
// One-click probe of launch-critical surfaces: env, payments, pricing,
// booking, quick requests, worker rep links, profit-share defaults, and
// payout safety. Operator runs it before publishing the deploy and watches
// each row turn green.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  CreditCard,
  Globe2,
  Loader2,
  Rocket,
  Server,
  XCircle,
} from "lucide-react";

interface Scenario { id: string; label: string }
interface Result   { id: string; label: string; ok: boolean; detail: string; ranAt: string; ms: number }

const publishBlockers = [
  {
    title: "Render environment",
    icon: Server,
    probeIds: ["env_required", "public_deploy_freshness"],
    action: "In Render, set DATABASE_URL, SESSION_SECRET, SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT=production, and APP_URL=https://www.jconthemove.com.",
    note: "Missing env vars make /api/health return not_ready even when /health is alive.",
  },
  {
    title: "Square payment links",
    icon: CreditCard,
    probeIds: ["square_configured"],
    action: "Refresh the Square access token and keep SQUARE_ENVIRONMENT=production before relying on invoice links.",
    note: "Cash payouts can stay manual, but Square links need a live token to collect customer payment.",
  },
  {
    title: "Forced deploy trigger",
    icon: Rocket,
    probeIds: ["public_deploy_freshness"],
    action: "Add RENDER_DEPLOY_HOOK_URL, or RENDER_API_KEY plus RENDER_SERVICE_ID, to GitHub Actions so main can force Render to pull the newest commit.",
    note: "Without this, Render can stay behind GitHub even after the code is pushed.",
  },
  {
    title: "Cloudflare DNS",
    icon: Globe2,
    probeIds: ["custom_domain_routing", "public_app_url"],
    action: "Point www.jconthemove.com at the Render custom-domain target, then keep the bare domain redirecting to www while preserving path/query.",
    note: "The public launch domain should serve the same Render build that passes the checklist.",
  },
];

export default function AdminLaunchChecklistPage() {
  const { data, isLoading } = useQuery<{ scenarios: Scenario[] }>({
    queryKey: ["/api/admin/launch-checklist"],
  });
  const [results, setResults] = useState<Record<string, Result>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const scenarios = data?.scenarios ?? [];
  const summary = useMemo(() => {
    const runResults = scenarios.map((s) => results[s.id]).filter(Boolean) as Result[];
    const green = runResults.filter((r) => r.ok).length;
    const red = runResults.filter((r) => !r.ok).length;
    const notRun = Math.max(0, scenarios.length - runResults.length);
    return {
      total: scenarios.length,
      run: runResults.length,
      green,
      red,
      notRun,
      allOk: scenarios.length > 0 && notRun === 0 && red === 0,
    };
  }, [results, scenarios]);

  const reportText = useMemo(() => {
    const lines = [
      "JC ON THE MOVE launch checklist",
      `Generated: ${new Date().toLocaleString()}`,
      `Status: ${summary.allOk ? "READY" : "NOT READY"}`,
      `Results: ${summary.green} green, ${summary.red} failed, ${summary.notRun} not run, ${summary.total} total`,
      "Coverage: deploy freshness, custom domain routing, health/readiness, payments, public routes, booking funnel, marketplace launch task bonuses, quick requests with photos/media links, tracked marketing attribution, worker rep pages, profit share, payout safety",
      "",
      ...scenarios.map((s) => {
        const r = results[s.id];
        if (!r) return `[NOT RUN] ${s.label}`;
        return `[${r.ok ? "PASS" : "FAIL"}] ${s.label} - ${r.detail} (${r.ms}ms)`;
      }),
    ];
    return lines.join("\n");
  }, [results, scenarios, summary]);

  async function run(id?: string) {
    if (id) setBusyId(id); else setBusyAll(true);
    try {
      const r = await apiRequest("POST", "/api/admin/launch-checklist/run", id ? { id } : {});
      const json = await r.json();
      const map = { ...results };
      for (const res of (json.results ?? []) as Result[]) map[res.id] = res;
      setResults(map);
      setCopyState("idle");
    } finally {
      setBusyId(null); setBusyAll(false);
    }
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  function publishBlockerState(probeIds: string[]) {
    const matched = probeIds.map((id) => results[id]).filter(Boolean) as Result[];
    if (matched.length === 0) return { label: "Not checked", className: "border-slate-700 bg-slate-950/70 text-slate-300" };
    if (matched.some((r) => !r.ok)) return { label: "Needs action", className: "border-amber-500/40 bg-amber-950/30 text-amber-100" };
    return { label: "Looks good", className: "border-emerald-500/35 bg-emerald-950/25 text-emerald-100" };
  }

  function publishBlockerFailures(probeIds: string[]) {
    return probeIds
      .map((id) => results[id])
      .filter((result): result is Result => !!result && !result.ok);
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Launch Checklist</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-3xl">
            Run every launch probe and confirm all rows are green before publishing a deploy or driving marketing traffic. This covers deploy freshness, health/readiness, payments, public conversion routes, the booking funnel, marketplace launch task bonuses, quick-request photos, media links, tracked marketing attribution, worker rep pages, profit-share defaults, and payout safety.
          </p>
        </div>
        <button
          onClick={copyReport}
          disabled={summary.run === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-medium disabled:opacity-50"
        >
          <ClipboardCopy className="w-4 h-4" />
          {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy report"}
        </button>
      </div>

      <div className={`mt-6 mb-5 rounded-xl border p-4 ${summary.allOk ? "border-emerald-500/30 bg-emerald-950/25" : "border-amber-500/30 bg-amber-950/20"}`}>
        <div className="flex items-start gap-3">
          {summary.allOk ? (
            <CheckCircle2 className="mt-0.5 w-5 h-5 text-emerald-300" />
          ) : (
            <AlertTriangle className="mt-0.5 w-5 h-5 text-amber-300" />
          )}
          <div>
            <div className={`font-semibold ${summary.allOk ? "text-emerald-100" : "text-amber-100"}`}>
              {summary.allOk ? "Ready for launch checks are passing" : "Not ready for launch yet"}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {summary.allOk
                ? "All required probes passed. Keep this report with the deploy notes before sending traffic."
                : "Run every probe and clear failed items before pushing paid traffic, worker links, or customer announcements."}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-blue-500/20 bg-blue-950/15 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Publish blockers</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Clear these four items when the checklist says not ready. This keeps Square, Render, GitHub deploys, and DNS lined up before paid traffic goes live.
            </p>
          </div>
          <code className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
            npm run render:doctor
          </code>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {publishBlockers.map((item) => {
            const state = publishBlockerState(item.probeIds);
            const failures = publishBlockerFailures(item.probeIds);
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-blue-300" />
                    <h2 className="text-sm font-bold text-white">{item.title}</h2>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${state.className}`}>
                    {state.label}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">{item.action}</p>
                {failures.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-500/25 bg-amber-950/20 p-3">
                    {failures.map((failure) => (
                      <div key={failure.id}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">{failure.label}</p>
                        <p className="mt-1 text-xs leading-5 text-amber-100/90">{failure.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-500">{item.note}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        {[
          ["Total probes", summary.total, "text-slate-100"],
          ["Green", summary.green, "text-emerald-300"],
          ["Failed", summary.red, "text-rose-300"],
          ["Not run", summary.notRun, "text-amber-300"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">Coverage</div>
        <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <span>Payments and deposits</span>
          <span>Deploy freshness</span>
          <span>Custom domain routing</span>
          <span>Health and database readiness</span>
          <span>Public customer and worker routes</span>
          <span>Public booking catalog</span>
          <span>Marketplace launch task bonuses</span>
          <span>Quick-request storage</span>
          <span>Tracked campaign attribution</span>
          <span>Notifications</span>
          <span>Worker rep pages</span>
          <span>Profit share and payout gate</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => run()}
          disabled={busyAll || isLoading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {busyAll ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Running...</span> : "Run all"}
        </button>
        {scenarios.length > 0 && (
          <span className={`text-sm ${summary.allOk ? "text-emerald-400" : "text-slate-400"}`}>
            {summary.run} / {summary.total} run - {summary.green} green
          </span>
        )}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl divide-y divide-slate-800">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading scenarios...</div>
        ) : (
          scenarios.map((s) => {
            const r = results[s.id];
            return (
              <div key={s.id} className="p-4 flex items-start gap-3">
                <div className="mt-0.5">
                  {!r ? <div className="w-5 h-5 rounded-full border border-slate-600" />
                    : r.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <XCircle className="w-5 h-5 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium">{s.label}</div>
                  {r && (
                    <div className={`mt-1 text-xs ${r.ok ? "text-emerald-300/80" : "text-rose-300/90"}`}>
                      {r.detail} <span className="text-slate-500">- {r.ms}ms</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => run(s.id)}
                  disabled={busyId === s.id || busyAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs disabled:opacity-50"
                >
                  {busyId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Run"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
