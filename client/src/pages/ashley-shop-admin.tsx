import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, Gem, Loader2, Mail, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Batch = {
  id: string;
  subject?: string;
  status: string;
  attachment_count: number;
  draft_count: number;
  received_at: string;
  error_message?: string;
};

type DraftMedia = { id: string; object_url: string; filename: string };
type Draft = {
  id: string;
  batch_id: string;
  status: string;
  title: string;
  short_description?: string;
  description?: string;
  category?: string;
  materials?: string;
  suggested_price_min?: string;
  suggested_price_max?: string;
  final_price?: string;
  confidence?: string;
  warnings?: string[];
  media?: DraftMedia[];
};

type SetupValue = {
  key: string;
  label: string;
  required: boolean;
  state: "ready" | "missing" | "disabled" | "defaulted" | "mismatch";
  description: string;
  effectiveValue?: string;
};

type SetupStatus = {
  ready: boolean;
  emailIngestEnabled: boolean;
  mailbox: string;
  intakeAlias: string;
  authorizedSender: string;
  values: SetupValue[];
  connection: { checked: boolean; ok: boolean; connectedMailbox?: string; error?: string };
  currentActor: { email: string | null; canFinalizeAndPublish: boolean };
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function DraftEditor({ draft, selected, onSelected, canFinalize }: { draft: Draft; selected: boolean; onSelected: (value: boolean) => void; canFinalize: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: draft.title || "",
    shortDescription: draft.short_description || "",
    description: draft.description || "",
    category: draft.category || "other",
    materials: draft.materials || "",
    finalPrice: draft.final_price || "",
  });
  const save = useMutation({
    mutationFn: () => {
      const { finalPrice, ...copy } = form;
      return jsonRequest(`/api/ashley-shop/admin/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...copy, ...(canFinalize && finalPrice ? { finalPrice: Number(finalPrice) } : {}) }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ashley-shop-drafts"] });
      toast({ title: "Draft saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }),
  });
  const photos = draft.media || [];
  const needsPrice = !Number(form.finalPrice);

  return (
    <Card className={`border-2 ${selected ? "border-emerald-500" : needsPrice ? "border-amber-300" : "border-rose-100"}`}>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} onCheckedChange={(value) => onSelected(value === true)} disabled={!canFinalize || draft.status === "published" || needsPrice} className="mt-1" />
          <div className="grid grid-cols-3 gap-2 flex-1">
            {photos.slice(0, 6).map((photo) => (
              <img key={photo.id} src={photo.object_url} alt={photo.filename} className="aspect-square w-full rounded-lg object-cover bg-rose-50" />
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label>Listing title</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></div>
          <div><Label>Category</Label><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></div>
          <div><Label>Materials — verify before approval</Label><Input value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /></div>
          <div className="md:col-span-2"><Label>Short description</Label><Input value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} /></div>
          <div className="md:col-span-2"><Label>Full description</Label><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
          <div>
            <Label>AI price suggestion</Label>
            <div className="h-10 flex items-center text-sm text-stone-600">
              {draft.suggested_price_min && draft.suggested_price_max ? `$${draft.suggested_price_min}–$${draft.suggested_price_max}` : "No suggestion — price manually"}
            </div>
          </div>
          <div><Label>Final price from Ashley *</Label><Input type="number" min="0.01" step="0.01" value={form.finalPrice} onChange={(event) => setForm({ ...form, finalPrice: event.target.value })} placeholder="Required before approval" disabled={!canFinalize || draft.status === "published"} />{!canFinalize && <p className="mt-1 text-xs text-amber-700">Sign in as the configured Ashley approver to set this value.</p>}</div>
        </div>
        {Array.isArray(draft.warnings) && draft.warnings.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            {draft.warnings.map((warning) => <p key={warning}>• {warning}</p>)}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-stone-500">Status: {draft.status.replaceAll("_", " ")}{draft.confidence ? ` · AI confidence ${Math.round(Number(draft.confidence) * 100)}%` : ""}</span>
          <Button onClick={() => save.mutate()} disabled={save.isPending || draft.status === "published"} variant="outline">
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />} Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AshleyShopAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const [activeBatch, setActiveBatch] = useState(params.get("batch") || "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileList | null>(null);

  const batches = useQuery<Batch[]>({
    queryKey: ["ashley-shop-batches"],
    queryFn: () => jsonRequest("/api/ashley-shop/admin/batches"),
    enabled: Boolean(user),
    retry: false,
  });
  const drafts = useQuery<Draft[]>({
    queryKey: ["ashley-shop-drafts", activeBatch],
    queryFn: () => jsonRequest(`/api/ashley-shop/admin/drafts${activeBatch ? `?batch=${encodeURIComponent(activeBatch)}` : ""}`),
    enabled: Boolean(user),
    retry: false,
  });
  const executive = useQuery<any>({
    queryKey: ["ashley-shop-executive"],
    queryFn: () => jsonRequest("/api/ashley-shop/admin/executive-summary"),
    enabled: Boolean(user),
    retry: false,
  });
  const setup = useQuery<SetupStatus>({
    queryKey: ["ashley-shop-setup"],
    queryFn: () => jsonRequest("/api/ashley-shop/admin/setup-status"),
    enabled: Boolean(user),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ashley-shop-batches"] });
    queryClient.invalidateQueries({ queryKey: ["ashley-shop-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["ashley-shop-executive"] });
    queryClient.invalidateQueries({ queryKey: ["ashley-shop-setup"] });
  };
  const upload = useMutation({
    mutationFn: async () => {
      if (!files?.length) throw new Error("Choose at least one photo");
      const body = new FormData();
      Array.from(files).forEach((file) => body.append("photos", file));
      return jsonRequest("/api/ashley-shop/admin/intake-upload", { method: "POST", body });
    },
    onSuccess: (data) => {
      setActiveBatch(data.batchId);
      setFiles(null);
      refresh();
      toast({ title: "Photos received", description: "The batch is queued for draft generation." });
    },
    onError: (error: Error) => toast({ title: "Upload failed", description: error.message, variant: "destructive" }),
  });
  const process = useMutation({
    mutationFn: (id: string) => jsonRequest(`/api/ashley-shop/admin/batches/${id}/process`, { method: "POST" }),
    onSuccess: () => { refresh(); toast({ title: "Drafts are ready" }); },
    onError: (error: Error) => toast({ title: "Processing failed", description: error.message, variant: "destructive" }),
  });
  const checkInbox = useMutation({
    mutationFn: () => jsonRequest("/api/ashley-shop/admin/check-inbox", { method: "POST" }),
    onSuccess: (data) => {
      refresh();
      toast({ title: "Ashley inbox checked", description: `${data.ingested || 0} new email batch${data.ingested === 1 ? "" : "es"} imported.` });
    },
    onError: (error: Error) => toast({ title: "Inbox check failed", description: error.message, variant: "destructive" }),
  });
  const approve = useMutation({
    mutationFn: () => jsonRequest("/api/ashley-shop/admin/drafts/approve", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftIds: Array.from(selected) }),
    }),
    onSuccess: (data) => {
      setSelected(new Set());
      refresh();
      toast({ title: `${data.published.length} listings published` });
    },
    onError: (error: Error) => toast({ title: "Approval failed", description: error.message, variant: "destructive" }),
  });
  const pipelineCounts = useMemo(() => Object.fromEntries((executive.data?.pipeline || []).map((row: any) => [row.status, row.count])), [executive.data]);
  const canFinalize = setup.data?.currentActor.canFinalizeAndPublish === true;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-rose-500" /></div>;
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center p-4 bg-rose-50"><Card className="max-w-md"><CardContent className="pt-6 text-center space-y-4"><Mail className="h-10 w-10 mx-auto text-rose-500" /><h1 className="text-xl font-serif font-bold">Ashley Shop sign-in required</h1><p className="text-sm text-stone-600">Sign in with the account for ashleyseegert64@gmail.com to review and approve drafts.</p><Link href={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}><Button>Sign in</Button></Link></CardContent></Card></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 text-stone-800">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Link href="/handmade-jewels-by-ashley"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link><div><h1 className="text-2xl font-serif font-bold">Ashley’s Shop Studio</h1><p className="text-sm text-stone-500">Photos → AI drafts → Ashley prices and approves → published shop</p></div></div>
          <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="pt-4"><p className="text-xs text-stone-500">Active pieces</p><p className="text-3xl font-bold text-rose-600">{executive.data?.inventory?.active || 0}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-stone-500">Awaiting price/review</p><p className="text-3xl font-bold text-amber-600">{Number(pipelineCounts.needs_price || 0) + Number(pipelineCounts.needs_review || 0)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-stone-500">30-day paid orders</p><p className="text-3xl font-bold text-emerald-600">{executive.data?.last30Days?.orders || 0}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs text-stone-500">Remaining to 500</p><p className="text-3xl font-bold text-sky-600">{executive.data?.target?.remaining ?? 500}</p></CardContent></Card>
        </div>

        <Card className={setup.data?.ready ? "border-emerald-300" : "border-amber-300"}>
          <CardHeader><CardTitle className="flex items-center gap-2">{setup.data?.ready ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />} Photo-email setup</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {setup.isLoading && <div className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Verifying the mailbox connection…</div>}
            {setup.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{(setup.error as Error).message}</div>}
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{setup.data?.ready ? "Inbox connection verified and automatic intake enabled" : "Setup still needs attention"}</p><p className="text-sm text-stone-600">Intake: {setup.data?.intakeAlias || "loading…"} · Authorized sender/approver: {setup.data?.authorizedSender || "loading…"}</p></div><Button variant="outline" onClick={() => checkInbox.mutate()} disabled={checkInbox.isPending || !setup.data?.connection.ok}>{checkInbox.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Check inbox now</Button></div>
            {setup.data?.connection.checked && !setup.data.connection.ok && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">OAuth mailbox verification failed: {setup.data.connection.error || "The connected account does not match the configured mailbox."}</div>}
            <div className="grid gap-2 md:grid-cols-2">{(setup.data?.values || []).map((value) => <div key={value.key} className={`rounded-lg border p-3 ${["ready", "defaulted"].includes(value.state) ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold">{value.label} <span className="font-normal text-stone-500">({value.required ? "required" : "recommended"})</span></p><p className="break-all font-mono text-[11px] text-stone-500">{value.key}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${["ready", "defaulted"].includes(value.state) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{value.state}</span></div><p className="mt-2 text-xs text-stone-600">{value.description}</p>{value.effectiveValue && <p className="mt-1 break-all text-xs font-medium text-stone-700">Current: {value.effectiveValue}</p>}</div>)}</div>
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${canFinalize ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><ShieldCheck className="h-4 w-4" />{canFinalize ? "This signed-in account can set final prices and publish." : "This account can review setup and copy, but only Ashley's authorized account can set final prices or publish."}</div>
          </CardContent>
        </Card>

        <Card className="border-rose-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-rose-500" /> Add photos</CardTitle></CardHeader>
          <CardContent className="space-y-3"><p className="text-sm text-stone-600">Email several photos in one message to <strong>{setup.data?.intakeAlias || "ashleyseegert64+shop@gmail.com"}</strong>, or upload a batch here. AI only prepares drafts; final prices and publishing always wait for Ashley’s authorized account.</p><Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => setFiles(event.target.files)} /><Button onClick={() => upload.mutate()} disabled={upload.isPending || !files?.length}>{upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Upload batch</Button></CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit"><CardHeader><CardTitle className="text-base">Intake batches</CardTitle></CardHeader><CardContent className="space-y-2">{batches.isLoading && <Loader2 className="h-5 w-5 animate-spin" />}{(batches.data || []).map((batch) => <button key={batch.id} onClick={() => { setActiveBatch(batch.id); setSelected(new Set()); }} className={`w-full rounded-lg border p-3 text-left text-sm ${activeBatch === batch.id ? "border-rose-500 bg-rose-50" : "border-stone-200"}`}><span className="font-semibold block truncate">{batch.subject || "Photo batch"}</span><span className="text-xs text-stone-500">{batch.attachment_count} photos · {batch.draft_count} drafts · {batch.status.replaceAll("_", " ")}</span>{batch.status === "received" && <Button size="sm" className="w-full mt-2" onClick={(event) => { event.stopPropagation(); process.mutate(batch.id); }} disabled={process.isPending}><Bot className="h-3 w-3 mr-1" /> Make drafts now</Button>}</button>)}</CardContent></Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-serif font-bold">Draft listings</h2><p className="text-xs text-stone-500">Ashley must save final prices before selecting drafts for approval.</p></div><Button onClick={() => approve.mutate()} disabled={!canFinalize || !selected.size || approve.isPending} className="bg-emerald-600 hover:bg-emerald-700">{approve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gem className="h-4 w-4 mr-2" />} Publish selected ({selected.size})</Button></div>
            {drafts.isLoading && <Loader2 className="h-7 w-7 animate-spin text-rose-500" />}
            {drafts.error && <Card><CardContent className="pt-6 text-red-600">{(drafts.error as Error).message}</CardContent></Card>}
            {(drafts.data || []).map((draft) => <DraftEditor key={`${draft.id}:${draft.status}:${draft.final_price}`} draft={draft} selected={selected.has(draft.id)} canFinalize={canFinalize} onSelected={(value) => setSelected((current) => { const next = new Set(current); value ? next.add(draft.id) : next.delete(draft.id); return next; })} />)}
            {!drafts.isLoading && !(drafts.data || []).length && <Card><CardContent className="pt-6 text-center text-stone-500">Choose a batch, email photos, or upload a new batch to begin.</CardContent></Card>}
          </div>
        </div>
      </div>
    </div>
  );
}
