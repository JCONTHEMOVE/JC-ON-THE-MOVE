import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, Check, Database, ExternalLink, Gift, Loader2, PackageOpen, RefreshCw, Rocket, Search, ShoppingBag } from "lucide-react";
import type { CommerceItem, CommercePromotion } from "@shared/commerceCatalog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type AdminCatalogResponse = {
  items: CommerceItem[];
  promotions: CommercePromotion[];
  publications: Array<any>;
  mappings: Array<any>;
  terms: { version: string; text: string };
  square: { configured: boolean; environment: "sandbox" | "production" };
};

type PreviewResponse = {
  publication: { id: string; revision: number; status: string; snapshotHash: string; createdAt: string };
  diff: {
    configured: boolean;
    environment: "sandbox" | "production";
    counts: { create: number; update: number; archive: number; unchanged: number };
    changes: Array<{ action: "create" | "update" | "archive" | "unchanged"; localType: string; localCode: string | null; name: string; squareObjectId: string | null; warning?: string }>;
  };
};

function money(value: number | null) {
  return value == null ? "Variable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function statusBadge(status: CommerceItem["squareStatus"]) {
  if (status === "synced") return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Square synced</Badge>;
  if (status === "drifted") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Drift detected</Badge>;
  if (status === "error") return <Badge variant="destructive">Square error</Badge>;
  return <Badge variant="outline">Not published</Badge>;
}

function CatalogItemEditor({ item }: { item: CommerceItem }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) => apiRequest("PATCH", `/api/admin/catalog/items/${item.code}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }),
    onError: (error: Error) => toast({ title: "Item update failed", description: error.message, variant: "destructive" }),
  });
  const variationMutation = useMutation({
    mutationFn: ({ code, updates }: { code: string; updates: Record<string, unknown> }) => apiRequest("PATCH", `/api/admin/catalog/variations/${code}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }),
    onError: (error: Error) => toast({ title: "Variation update failed", description: error.message, variant: "destructive" }),
  });

  return (
    <Card className="border-slate-700 bg-slate-900/70 text-white">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="mb-2 flex flex-wrap gap-2"><Badge variant="outline" className="capitalize text-slate-300">{item.itemType}</Badge><Badge variant="outline" className="capitalize text-slate-300">{item.purchaseMode}</Badge>{statusBadge(item.squareStatus)}</div><CardTitle className="text-lg">{item.name}</CardTitle><CardDescription className="mt-1 text-slate-400">{item.code} · {item.category}</CardDescription></div>
          <div className="text-right"><p className="text-lg font-bold text-orange-400">{money(item.price)}</p><p className="text-xs text-slate-500">per {item.unit}</p></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-300">{item.description}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-lg bg-slate-950/70 p-3 text-sm">Public <Switch checked={item.publicVisible} disabled={mutation.isPending} onCheckedChange={(value) => mutation.mutate({ publicVisible: value })} /></label>
          <label className="flex items-center justify-between rounded-lg bg-slate-950/70 p-3 text-sm">Advertising <Switch checked={item.advertisingEnabled} disabled={mutation.isPending} onCheckedChange={(value) => mutation.mutate({ advertisingEnabled: value })} /></label>
          <label className="flex items-center justify-between rounded-lg bg-slate-950/70 p-3 text-sm">Active <Switch checked={item.active} disabled={mutation.isPending} onCheckedChange={(value) => mutation.mutate({ active: value })} /></label>
        </div>
        {item.variations.length > 0 && <div className="overflow-x-auto rounded-lg border border-slate-700"><table className="w-full text-sm"><thead className="bg-slate-950 text-left text-xs uppercase text-slate-400"><tr><th className="p-3">Option</th><th className="p-3">Price</th><th className="p-3">Unit</th><th className="p-3 text-center">Public</th></tr></thead><tbody>{item.variations.map((variation) => <tr key={variation.code} className="border-t border-slate-800"><td className="p-3"><p className="font-medium">{variation.name}</p><p className="font-mono text-[11px] text-slate-500">{variation.code}</p></td><td className="p-3"><Input className="h-8 w-28 border-slate-700 bg-slate-950" type="number" min="0" step="0.01" defaultValue={variation.price ?? ""} placeholder="Draft" onBlur={(event) => { const next = event.target.value.trim() === "" ? null : Number(event.target.value); if (next !== variation.price) variationMutation.mutate({ code: variation.code, updates: { price: next, publicVisible: next == null ? false : variation.publicVisible } }); }} /></td><td className="p-3 text-slate-400">{variation.unit}</td><td className="p-3 text-center"><Switch checked={variation.publicVisible} disabled={variation.price == null || variationMutation.isPending} onCheckedChange={(value) => variationMutation.mutate({ code: variation.code, updates: { publicVisible: value } })} /></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  );
}

function PromotionsPanel({ promotions, items }: { promotions: CommercePromotion[]; items: CommerceItem[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ code: "", name: "", description: "", discountType: "percent" as "percent" | "fixed", value: "", maximumAmount: "", endsAt: "", active: false });
  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/promotions", {
      code: form.code.toUpperCase(), name: form.name, description: form.description || null,
      discountType: form.discountType, value: Number(form.value), maximumAmount: form.maximumAmount ? Number(form.maximumAmount) : null,
      eligibleItemCodes: [], eligibleCategories: [], startsAt: null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59`).toISOString() : null,
      combinable: true, priority: 100, active: form.active,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }); setForm({ code: "", name: "", description: "", discountType: "percent", value: "", maximumAmount: "", endsAt: "", active: false }); toast({ title: "Promotion saved", description: "Preview and publish the catalog to send it to Square and advertising." }); },
    onError: (error: Error) => toast({ title: "Promotion failed", description: error.message, variant: "destructive" }),
  });
  return <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="border-slate-700 bg-slate-900/70 text-white"><CardHeader><CardTitle>Create owner promotion</CardTitle><CardDescription className="text-slate-400">Dated percentage or fixed-dollar offers. Percentage savings remain inside the 15% cap.</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label>Code</Label><Input className="border-slate-700 bg-slate-950 uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="FALLMOVE" /></div><div><Label>Name</Label><Input className="border-slate-700 bg-slate-950" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>Description</Label><Textarea className="border-slate-700 bg-slate-950" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Type</Label><Select value={form.discountType} onValueChange={(value) => setForm({ ...form, discountType: value as any })}><SelectTrigger className="border-slate-700 bg-slate-950"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Percentage</SelectItem><SelectItem value="fixed">Fixed dollars</SelectItem></SelectContent></Select></div><div><Label>Value</Label><Input className="border-slate-700 bg-slate-950" type="number" min="0.01" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div></div>{form.discountType === "percent" && <div><Label>Maximum dollars off</Label><Input className="border-slate-700 bg-slate-950" type="number" min="0" step="0.01" value={form.maximumAmount} onChange={(e) => setForm({ ...form, maximumAmount: e.target.value })} placeholder="Optional" /></div>}<div><Label>End date</Label><Input className="border-slate-700 bg-slate-950" type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></div><label className="flex items-center justify-between rounded-lg bg-slate-950 p-3">Activate in next publication <Switch checked={form.active} onCheckedChange={(value) => setForm({ ...form, active: value })} /></label><Button className="w-full bg-orange-600 hover:bg-orange-700" disabled={mutation.isPending || !form.code || !form.name || !Number(form.value)} onClick={() => mutation.mutate()}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save promotion</Button></CardContent></Card><div className="space-y-3">{promotions.length === 0 ? <Card className="border-slate-700 bg-slate-900/70"><CardContent className="p-8 text-center text-slate-400">No owner promotions yet.</CardContent></Card> : promotions.map((promotion) => <Card key={promotion.code} className="border-slate-700 bg-slate-900/70 text-white"><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="flex gap-2"><p className="font-bold">{promotion.name}</p><Badge variant="outline">{promotion.code}</Badge>{promotion.active && <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>}</div><p className="mt-1 text-sm text-slate-400">{promotion.discountType === "percent" ? `${promotion.value}%${promotion.maximumAmount ? ` up to $${promotion.maximumAmount}` : ""}` : `$${promotion.value} off`} · {promotion.eligibleItemCodes.length || items.length} eligible item(s)</p></div><Gift className="h-6 w-6 text-orange-400" /></CardContent></Card>)}</div></div>;
}

function SyncPanel({ data }: { data: AdminCatalogResponse }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const previewMutation = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/admin/catalog/publications/preview", {})).json() as Promise<PreviewResponse>, onSuccess: (value) => { setPreview(value); setConfirmed(false); queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }); }, onError: (error: Error) => toast({ title: "Preview failed", description: error.message, variant: "destructive" }) });
  const publishMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/admin/catalog/publications/${preview!.publication.id}/publish`, { confirm: true }), onSuccess: () => { toast({ title: "Catalog published", description: "Square, public offers, and marketing now use the same revision." }); setPreview(null); setConfirmed(false); queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }); }, onError: (error: Error) => toast({ title: "Publication failed safely", description: error.message, variant: "destructive" }) });
  const driftMutation = useMutation({ mutationFn: () => apiRequest("GET", "/api/admin/catalog/drift"), onSuccess: async (response) => { const result = await response.json(); queryClient.invalidateQueries({ queryKey: ["/api/admin/catalog"] }); toast({ title: result.drift.length ? "Square drift found" : "Square matches JC", description: `${result.checked} managed objects checked.` }); }, onError: (error: Error) => toast({ title: "Drift check failed", description: error.message, variant: "destructive" }) });
  const active = data.publications.find((publication) => publication.status === "active");
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><Card className="border-slate-700 bg-slate-900/70 text-white"><CardContent className="p-5"><p className="text-xs uppercase text-slate-500">Environment</p><p className="mt-1 text-xl font-bold capitalize">{data.square.environment}</p>{data.square.environment === "production" && <p className="mt-2 text-xs text-amber-400">Publishing changes the live Square catalog.</p>}</CardContent></Card><Card className="border-slate-700 bg-slate-900/70 text-white"><CardContent className="p-5"><p className="text-xs uppercase text-slate-500">Active revision</p><p className="mt-1 text-xl font-bold">{active ? `#${active.revision}` : "None"}</p></CardContent></Card><Card className="border-slate-700 bg-slate-900/70 text-white"><CardContent className="p-5"><p className="text-xs uppercase text-slate-500">Square mappings</p><p className="mt-1 text-xl font-bold">{data.mappings.length}</p></CardContent></Card></div><div className="flex flex-wrap gap-3"><Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending || !data.square.configured} className="bg-blue-600 hover:bg-blue-700">{previewMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Preview exact diff</Button><Button variant="outline" className="border-slate-600 bg-transparent text-white" onClick={() => driftMutation.mutate()} disabled={driftMutation.isPending || !data.square.configured}><RefreshCw className={`mr-2 h-4 w-4 ${driftMutation.isPending ? "animate-spin" : ""}`} />Check Square drift</Button><a href="https://squareup.com/dashboard/items/library" target="_blank" rel="noreferrer"><Button variant="ghost" className="text-blue-400">Square dashboard <ExternalLink className="ml-2 h-4 w-4" /></Button></a></div>{!data.square.configured && <div className="flex gap-3 rounded-lg border border-amber-600/40 bg-amber-950/30 p-4 text-amber-200"><AlertTriangle className="h-5 w-5 shrink-0" /><p>Square credentials are not configured. Catalog editing is available, but preview and publication are disabled.</p></div>}{preview && <Card className="border-blue-500/50 bg-slate-900 text-white"><CardHeader><CardTitle>Publication #{preview.publication.revision}</CardTitle><CardDescription className="text-slate-400">Review every live Square change before approval.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-4 gap-2 text-center">{Object.entries(preview.diff.counts).map(([action, count]) => <div key={action} className="rounded-lg bg-slate-950 p-3"><p className="text-2xl font-black">{count}</p><p className="text-xs uppercase text-slate-500">{action}</p></div>)}</div><div className="max-h-80 overflow-y-auto rounded-lg border border-slate-700">{preview.diff.changes.map((change, index) => <div key={`${change.localCode}-${index}`} className="flex items-start gap-3 border-b border-slate-800 p-3 last:border-0"><Badge className={change.action === "archive" ? "bg-red-100 text-red-800" : change.action === "create" ? "bg-emerald-100 text-emerald-800" : change.action === "update" ? "bg-blue-100 text-blue-800" : "bg-slate-700"}>{change.action}</Badge><div><p className="font-medium">{change.name}</p><p className="font-mono text-xs text-slate-500">{change.localCode || change.squareObjectId}</p>{change.warning && <p className="mt-1 text-xs text-amber-400">{change.warning}</p>}</div></div>)}</div><label className="flex items-start gap-3 rounded-lg border border-orange-500/40 bg-orange-950/20 p-4"><input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span className="text-sm">I reviewed this exact diff and authorize revision #{preview.publication.revision}, including {preview.diff.counts.archive} proposed archive(s), in the {preview.diff.environment} Square catalog.</span></label><Button className="w-full bg-orange-600 hover:bg-orange-700" disabled={!confirmed || publishMutation.isPending} onClick={() => publishMutation.mutate()}>{publishMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}Publish coordinated revision</Button></CardContent></Card>}<Card className="border-slate-700 bg-slate-900/70 text-white"><CardHeader><CardTitle>Publication history</CardTitle></CardHeader><CardContent className="space-y-2">{data.publications.map((publication) => <div key={publication.id} className="flex items-center justify-between rounded-lg bg-slate-950 p-3"><div><p className="font-medium">Revision #{publication.revision}</p><p className="text-xs text-slate-500">{new Date(publication.created_at).toLocaleString()}</p></div><Badge variant="outline" className="capitalize">{publication.status}</Badge></div>)}</CardContent></Card></div>;
}

function AdjustmentsPanel() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ requests: Array<any> }>({ queryKey: ["/api/admin/adjustment-requests"] });
  const mutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) => apiRequest("PATCH", `/api/admin/adjustment-requests/${id}`, { decision, notes: null }),
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/adjustment-requests"] });
      toast({ title: result.executionRequired ? "Approved for execution" : "Request rejected", description: result.executionRequired ? "Review the Square payment before issuing any refund or supplement." : "The decision was recorded." });
    },
    onError: (error: Error) => toast({ title: "Review failed", description: error.message, variant: "destructive" }),
  });
  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-orange-500" /></div>;
  return <div className="space-y-4"><div className="rounded-lg border border-amber-600/30 bg-amber-950/20 p-4 text-sm text-amber-200">Approval records the financial action but does not automatically charge or refund a customer. Verify the original Square payment before execution.</div>{(data?.requests || []).length === 0 ? <Card className="border-slate-700 bg-slate-900/70"><CardContent className="p-10 text-center text-slate-400">No cancellation, reschedule, or job-switch requests.</CardContent></Card> : data!.requests.map((request) => <Card key={request.id} className="border-slate-700 bg-slate-900/70 text-white"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><p className="font-bold">{request.customer_name || "Customer request"}</p><Badge variant="outline" className="capitalize">{String(request.adjustment_type).replace(/_/g, " ")}</Badge><Badge className={request.status === "pending_owner_review" ? "bg-amber-100 text-amber-800" : "bg-slate-700"}>{String(request.status).replace(/_/g, " ")}</Badge></div><p className="mt-1 text-sm text-slate-400">{request.customer_email} · {request.offer_code}</p><p className="mt-3 text-sm">{request.reason}</p></div><div className="text-right text-sm"><p>Job total: <strong>${Number(request.job_total).toFixed(2)}</strong></p><p>Paid: <strong>${Number(request.amount_paid).toFixed(2)}</strong></p><p className="text-slate-400">Policy fee: ${Number(request.policy_snapshot?.fee || 0).toFixed(2)}</p></div></div>{request.status === "pending_owner_review" && <div className="mt-4 flex justify-end gap-2"><Button variant="outline" className="border-slate-600 bg-transparent" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, decision: "reject" })}>Reject</Button><Button className="bg-orange-600 hover:bg-orange-700" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: request.id, decision: "approve" })}>Approve for execution</Button></div>}</CardContent></Card>)}</div>;
}

export default function AdminSquareCatalogPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery<AdminCatalogResponse>({ queryKey: ["/api/admin/catalog"] });
  const filtered = useMemo(() => (data?.items || []).filter((item) => `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const supplies = filtered.filter((item) => item.itemType === "supply");
  const services = filtered.filter((item) => item.itemType !== "supply");
  if (isLoading || !data) return <div className="flex min-h-[60vh] items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  return <div className="min-h-screen bg-slate-950 px-4 py-8 text-white"><div className="mx-auto max-w-7xl"><div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/control"><Button variant="ghost" className="text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button></Link><div><h1 className="text-3xl font-black">Catalog & Offers</h1><p className="text-sm text-slate-400">One JC-owned source for Square, invoices, public offers, supplies, and advertising.</p></div></div><div className="flex gap-2"><Badge className="bg-emerald-100 text-emerald-800"><Check className="mr-1 h-3 w-3" />2026 pricing authority</Badge><Badge variant="outline" className="capitalize">{data.square.environment}</Badge></div></div><Tabs defaultValue="items"><TabsList className="mb-6 grid h-auto w-full grid-cols-2 bg-slate-900 p-1 sm:grid-cols-5"><TabsTrigger value="items"><ShoppingBag className="mr-2 h-4 w-4" />Items</TabsTrigger><TabsTrigger value="supplies"><PackageOpen className="mr-2 h-4 w-4" />Supplies</TabsTrigger><TabsTrigger value="promotions"><Gift className="mr-2 h-4 w-4" />Promotions</TabsTrigger><TabsTrigger value="adjustments"><AlertTriangle className="mr-2 h-4 w-4" />Changes</TabsTrigger><TabsTrigger value="sync"><Database className="mr-2 h-4 w-4" />Publish & Sync</TabsTrigger></TabsList><TabsContent value="items"><div className="relative mb-5"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input className="border-slate-700 bg-slate-900 pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services, packages, and fees" /></div><div className="space-y-4">{services.map((item) => <CatalogItemEditor key={item.code} item={item} />)}</div></TabsContent><TabsContent value="supplies"><div className="mb-5 rounded-lg border border-blue-600/30 bg-blue-950/30 p-4 text-sm text-blue-200">Individual supplies without an approved price stay hidden from customers. The $350 and $600 kits are ready to publish; inventory tracking is intentionally off in v1.</div><div className="space-y-4">{supplies.map((item) => <CatalogItemEditor key={item.code} item={item} />)}</div></TabsContent><TabsContent value="promotions"><PromotionsPanel promotions={data.promotions} items={data.items} /></TabsContent><TabsContent value="adjustments"><AdjustmentsPanel /></TabsContent><TabsContent value="sync"><SyncPanel data={data} /></TabsContent></Tabs></div></div>;
}
