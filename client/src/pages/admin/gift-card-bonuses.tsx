import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, RefreshCw, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type BonusRow = {
  id: string;
  square_order_id: string;
  buyer_email: string | null;
  face_value_cents: number;
  token_amount: string | number;
  refunded_cents: number;
  reversed_tokens: string | number;
  status: string;
  target_email: string | null;
  purchased_at: string | null;
  eligible_at: string | null;
  credited_at: string | null;
  gold_eligible: boolean;
};

type BonusResponse = {
  readiness: { enabled: boolean; requested: boolean; startAt: string | null; blockers: string[] };
  bonuses: BonusRow[];
};

function statusClass(status: string) {
  if (status === "released") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (["reversed", "disputed", "needs_review"].includes(status)) return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}
function dateText(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminGiftCardBonusesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<BonusResponse>({ queryKey: ["/api/admin/gift-card-bonuses"] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/gift-card-bonuses"] });
  const reconcile = useMutation({
    mutationFn: (orderId: string) => apiRequest("POST", `/api/admin/gift-card-bonuses/${encodeURIComponent(orderId)}/reconcile`, {}),
    onSuccess: refresh,
  });
  const resend = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/gift-card-bonuses/${encodeURIComponent(id)}/resend`, {}),
    onSuccess: refresh,
  });
  const sweep = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/gift-card-bonuses/sweep", {}),
    onSuccess: refresh,
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-emerald-300" />
            <h1 className="text-2xl font-black text-white">Gift-card bonuses</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Audit Square activations, purchaser emails, assignments, holds, releases, refunds, and disputes. No gift-card numbers are stored here.</p>
        </div>
        <button
          type="button"
          onClick={() => sweep.mutate()}
          disabled={sweep.isPending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" /> Run sweep
        </button>
      </div>

      {data && (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${data.readiness.enabled ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-amber-400/25 bg-amber-400/10 text-amber-100"}`}>
          <p className="font-black">Automation {data.readiness.enabled ? "enabled" : "not enabled"}</p>
          <p className="mt-1">Start: {data.readiness.startAt ? dateText(data.readiness.startAt) : "not configured"}</p>
          {data.readiness.blockers.length > 0 && <p className="mt-1 text-xs">{data.readiness.blockers.join(" · ")}</p>}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading bonus ledger…</div>
        ) : !data?.bonuses.length ? (
          <div className="p-8 text-center text-slate-400">No Square eGift bonus records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-slate-800/70 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Purchase</th>
                  <th className="px-4 py-3">Buyer / target</th>
                  <th className="px-4 py-3">Bonus</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Hold / release</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {data.bonuses.map((row) => {
                  const remaining = Math.max(0, Number(row.token_amount) - Number(row.reversed_tokens));
                  return (
                    <tr key={row.id} className="border-t border-slate-800 align-top">
                      <td className="px-4 py-3">
                        <p className="font-black">${(row.face_value_cents / 100).toLocaleString("en-US")}{row.gold_eligible ? " Gold" : ""}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{row.square_order_id}</p>
                        <p className="mt-1 text-xs text-slate-500">{dateText(row.purchased_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.buyer_email || "Buyer email missing"}</p>
                        <p className="mt-1 text-xs text-slate-500">Target: {row.target_email || "not chosen"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono font-black text-emerald-300">{remaining.toLocaleString("en-US")}</p>
                        {row.refunded_cents > 0 && <p className="mt-1 text-xs text-rose-300">Refunded ${(row.refunded_cents / 100).toFixed(2)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${statusClass(row.status)}`}>{row.status.replace(/_/g, " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <p>Eligible: {dateText(row.eligible_at)}</p>
                        <p className="mt-1">Credited: {dateText(row.credited_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => resend.mutate(row.id)}
                            disabled={!row.buyer_email || resend.isPending}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs font-bold hover:bg-white/5 disabled:opacity-40"
                          >
                            <Send className="h-3.5 w-3.5" /> Link
                          </button>
                          <button
                            type="button"
                            onClick={() => reconcile.mutate(row.square_order_id)}
                            disabled={reconcile.isPending}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/15 px-3 text-xs font-bold hover:bg-white/5 disabled:opacity-40"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Reconcile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
