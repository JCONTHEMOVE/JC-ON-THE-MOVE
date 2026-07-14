import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type CleanupCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  fromAddress: string;
  moveDate?: string | null;
  confirmedDate?: string | null;
  details?: string | null;
  source?: string | null;
};

type CleanupPreview = {
  unmistakableTest: CleanupCandidate[];
  internalSynthetic: CleanupCandidate[];
  pastDated: CleanupCandidate[];
  defaultSelectedIds: string[];
};

type CleanupGroupProps = {
  title: string;
  description: string;
  candidates: CleanupCandidate[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  tone: "red" | "amber" | "slate";
};

function CleanupGroup({ title, description, candidates, selectedIds, onToggle, tone }: CleanupGroupProps) {
  const toneClass = tone === "red" ? "border-red-500/30 bg-red-950/15" : tone === "amber" ? "border-amber-500/30 bg-amber-950/15" : "border-slate-600 bg-slate-900/30";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-semibold text-white">{title}</p><p className="text-xs text-slate-400">{description}</p></div>
        <Badge variant="outline" className="border-slate-500 text-slate-200">{candidates.length}</Badge>
      </div>
      {candidates.length === 0 ? <p className="text-sm text-slate-500">None found.</p> : (
        <div className="space-y-2">
          {candidates.map((lead) => {
            const schedule = lead.confirmedDate || lead.moveDate;
            return <label key={lead.id} className="flex cursor-pointer items-start gap-3 rounded-lg bg-slate-950/25 p-3 hover:bg-slate-950/45">
              <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => onToggle(lead.id)} aria-label={`Select ${lead.firstName} ${lead.lastName}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-100">{lead.firstName} {lead.lastName}</span>
                <span className="block truncate text-xs text-slate-400">{lead.serviceType} · {lead.fromAddress || "No address"}{schedule ? ` · ${schedule}` : ""}</span>
                {(lead.email || lead.phone || lead.details) && <span className="mt-1 block line-clamp-1 text-xs text-slate-500">{lead.email || lead.phone}{lead.details ? ` — ${lead.details}` : ""}</span>}
              </span>
            </label>;
          })}
        </div>
      )}
    </div>
  );
}

export function LeadCleanupPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOverride, setSelectedOverride] = useState<Set<string> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const previewQuery = useQuery<CleanupPreview>({ queryKey: ["/api/admin/leads/cleanup-preview"] });
  const preview = previewQuery.data;
  const selectedIds = selectedOverride ?? new Set(preview?.defaultSelectedIds ?? []);

  const archiveSelected = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/leads/cleanup-archive", { ids: [...selectedIds] });
      return response.json() as Promise<{ archived: number }>;
    },
    onSuccess: (result) => {
      setSelectedOverride(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads/cleanup-preview"] });
      toast({ title: "Jobs archived", description: `${result.archived} selected job${result.archived === 1 ? "" : "s"} removed from active jobs. You can restore them from Archived Jobs.` });
    },
    onError: (error: Error) => toast({ title: "Cleanup failed", description: error.message, variant: "destructive" }),
  });

  const toggle = (id: string) => {
    setSelectedOverride((current) => {
      const next = new Set(current ?? preview?.defaultSelectedIds ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const candidateCount = (preview?.unmistakableTest.length ?? 0) + (preview?.internalSynthetic.length ?? 0) + (preview?.pastDated.length ?? 0);

  return <>
    <Card className="border-slate-700 bg-slate-800/50" data-testid="lead-cleanup-panel">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl text-white"><ShieldCheck className="h-5 w-5 text-blue-300" /> Cleanup active jobs</CardTitle>
            <CardDescription className="mt-1 text-slate-400">Preview records before removal. Archive is reversible and immediately hides a job from active leads, calendars, and available jobs.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSelectedOverride(null); previewQuery.refetch(); }} disabled={previewQuery.isFetching} className="border-slate-600 text-slate-200"><RefreshCw className={`mr-1.5 h-4 w-4 ${previewQuery.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewQuery.isLoading ? <p className="text-sm text-slate-400">Preparing cleanup preview…</p> : previewQuery.isError ? <p className="text-sm text-red-300">Could not load the cleanup preview. Refresh and try again.</p> : candidateCount === 0 ? <p className="text-sm text-slate-400">No test, synthetic, or past-dated active jobs were identified.</p> : <>
          <div className="rounded-lg border border-blue-500/25 bg-blue-950/20 p-3 text-sm text-blue-100"><CircleAlert className="mr-1.5 inline h-4 w-4" /> Clearly marked test records are selected by default. Internal/synthetic and past-dated records stay unchecked until you review them.</div>
          <CleanupGroup title="Clearly marked test jobs" description="Default-selected only when the record explicitly identifies itself as a test / safe-to-archive flow." candidates={preview?.unmistakableTest ?? []} selectedIds={selectedIds} onToggle={toggle} tone="red" />
          <CleanupGroup title="Internal or synthetic jobs" description="Review these manually before archiving." candidates={preview?.internalSynthetic ?? []} selectedIds={selectedIds} onToggle={toggle} tone="amber" />
          <CleanupGroup title="Past-dated active jobs" description="These are still active, so review whether they are completed, rescheduled, or should be archived." candidates={preview?.pastDated ?? []} selectedIds={selectedIds} onToggle={toggle} tone="slate" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-4"><p className="text-sm text-slate-400">{selectedIds.size} job{selectedIds.size === 1 ? "" : "s"} selected</p><Button variant="destructive" disabled={selectedIds.size === 0} onClick={() => setConfirmOpen(true)} data-testid="button-archive-cleanup-selection"><Archive className="mr-2 h-4 w-4" /> Archive selected jobs</Button></div>
        </>}
      </CardContent>
    </Card>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent className="border-slate-700 bg-slate-900 text-white">
        <AlertDialogHeader><AlertDialogTitle>Remove selected jobs from active views?</AlertDialogTitle><AlertDialogDescription className="text-slate-300">{selectedIds.size} job{selectedIds.size === 1 ? "" : "s"} will be archived. They will disappear from active leads, calendars, and available jobs, but can be restored later.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => archiveSelected.mutate()} disabled={archiveSelected.isPending} className="bg-red-600 hover:bg-red-500">{archiveSelected.isPending ? "Archiving…" : "Archive selected"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
