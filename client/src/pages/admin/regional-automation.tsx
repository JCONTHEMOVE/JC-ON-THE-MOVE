import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, MapPinned, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type ServiceArea = {
  code: string;
  name: string;
  locality: string;
  state_code: string;
  verification_status: "pending" | "verified" | "suspended";
  auto_book_enabled: boolean;
  ads_enabled: boolean;
  service_types: string[];
  truck_modes: string[];
  notes: string | null;
  verified_at: string | null;
};

type CloseoutException = {
  id: string;
  lead_id: string;
  status: string;
  first_name: string;
  last_name: string;
  service_type: string;
  actual_hours: string;
  calculated_final_total: string;
  deposit_applied: string;
  balance_due: string;
  exception_flags: string[];
  crew_notes: string | null;
  updated_at: string;
};

function money(value: unknown) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function RegionalAutomationPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const areas = useQuery<{ areas: ServiceArea[] }>({ queryKey: ["/api/admin/service-areas"] });
  const exceptions = useQuery<{ closeouts: CloseoutException[] }>({ queryKey: ["/api/admin/closeout-exceptions"] });

  const updateArea = useMutation({
    mutationFn: async ({ code, patch }: { code: string; patch: Partial<{ verificationStatus: ServiceArea["verification_status"]; autoBookEnabled: boolean; adsEnabled: boolean }> }) => {
      const response = await apiRequest("PATCH", `/api/admin/service-areas/${encodeURIComponent(code)}`, patch);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/service-areas"] });
      toast({ title: "Operating area updated" });
    },
    onError: (error: Error) => toast({ title: "Area update failed", description: error.message, variant: "destructive" }),
  });

  const approveCloseout = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/admin/closeout-exceptions/${id}/approve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/closeout-exceptions"] });
      toast({ title: "Closeout released to the customer" });
    },
    onError: (error: Error) => toast({ title: "Could not approve closeout", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-4 text-white md:p-6">
      <div><div className="flex items-center gap-2 text-blue-300"><MapPinned className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-widest">Regional controls</span></div><h1 className="mt-1 text-2xl font-black">Booking automation & exceptions</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Automatic booking and advertising are independently gated. A service area must be verified before automatic deposits can be enabled.</p></div>

      <Card className="border-slate-800 bg-slate-950/70 text-white">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Operating areas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {areas.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {areas.data?.areas.map((area) => {
            const verified = area.verification_status === "verified";
            const busy = updateArea.isPending && updateArea.variables?.code === area.code;
            return <div key={area.code} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-bold">{area.name}</p><Badge variant="outline" className={verified ? "border-emerald-500/40 text-emerald-300" : area.verification_status === "suspended" ? "border-red-500/40 text-red-300" : "border-amber-500/40 text-amber-300"}>{area.verification_status}</Badge></div><p className="mt-1 text-xs text-slate-400">{area.locality}, {area.state_code} · {area.service_types.join(", ")} · {area.truck_modes.join(", ")}</p>{area.notes && <p className="mt-2 text-xs text-slate-500">{area.notes}</p>}</div><div className="flex gap-2">{!verified && <Button size="sm" disabled={busy} onClick={() => updateArea.mutate({ code: area.code, patch: { verificationStatus: "verified" } })}>Verify</Button>}{verified && <Button size="sm" variant="outline" disabled={busy} onClick={() => updateArea.mutate({ code: area.code, patch: { verificationStatus: "suspended", autoBookEnabled: false } })}>Suspend</Button>}</div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-sm"><span><strong className="block">Automatic deposits</strong><span className="text-xs text-slate-500">Only for eligible bookings</span></span><Switch checked={area.auto_book_enabled} disabled={!verified || busy} onCheckedChange={(checked) => updateArea.mutate({ code: area.code, patch: { autoBookEnabled: checked } })} /></label><label className="flex items-center justify-between rounded-lg border border-slate-800 p-3 text-sm"><span><strong className="block">Advertising</strong><span className="text-xs text-slate-500">Public demand generation</span></span><Switch checked={area.ads_enabled} disabled={busy} onCheckedChange={(checked) => updateArea.mutate({ code: area.code, patch: { adsEnabled: checked } })} /></label></div></div>;
          })}
          {areas.isError && <p className="text-sm text-red-300">Could not load operating areas.</p>}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-950/70 text-white">
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-300" /> Closeout exception queue</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {exceptions.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          {exceptions.data?.closeouts.length === 0 && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-emerald-200"><CheckCircle2 className="mb-2 h-5 w-5" />No closeouts need owner review.</div>}
          {exceptions.data?.closeouts.map((closeout) => <div key={closeout.id} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{closeout.first_name} {closeout.last_name}</p><p className="text-xs text-slate-400">{closeout.service_type} · {Number(closeout.actual_hours || 0).toFixed(2)} actual hours · updated {new Date(closeout.updated_at).toLocaleString()}</p><div className="mt-2 flex flex-wrap gap-1">{(closeout.exception_flags || []).map((flag) => <Badge key={flag} variant="outline" className="border-amber-500/30 text-amber-200">{flag.replace(/_/g, " ")}</Badge>)}</div></div><div className="text-right"><p className="text-xs text-slate-500">Final / balance</p><p className="font-black">{money(closeout.calculated_final_total)} / {money(closeout.balance_due)}</p></div></div>{closeout.crew_notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">{closeout.crew_notes}</p>}<div className="mt-3 flex justify-end"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-500" disabled={approveCloseout.isPending || closeout.status === "refund_review"} onClick={() => approveCloseout.mutate(closeout.id)}>{closeout.status === "refund_review" ? "Refund review required" : "Approve for customer review"}</Button></div></div>)}
          {exceptions.isError && <p className="text-sm text-red-300">Could not load exception closeouts.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
