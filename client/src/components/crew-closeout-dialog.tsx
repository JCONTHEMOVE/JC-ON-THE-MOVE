import { useEffect, useState } from "react";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ChangeOrderDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  customerAcknowledged: boolean;
};

type Props = {
  leadId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

function nowForDateTimeInput() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CrewCloseoutDialog({ leadId, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [actualEndAt, setActualEndAt] = useState(nowForDateTimeInput);
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [proofPhotos, setProofPhotos] = useState<Array<{ url: string; type: "completion"; description: string }>>([]);
  const [changes, setChanges] = useState<ChangeOrderDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [damageReported, setDamageReported] = useState(false);
  const [customerDisputed, setCustomerDisputed] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!leadId) return;
    setActualEndAt(nowForDateTimeInput());
    setBreakMinutes("0");
    setProofPhotos([]);
    setChanges([]);
    setNotes("");
    setDamageReported(false);
    setCustomerDisputed(false);
  }, [leadId]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error("Job not selected");
      if (!proofPhotos.length) throw new Error("Add at least one completion photo");
      const response = await apiRequest("POST", `/api/crew/jobs/${leadId}/closeout`, {
        actualEndAt: new Date(actualEndAt).toISOString(),
        breakMinutes: Number(breakMinutes || 0),
        proofPhotos: proofPhotos.map((photo) => ({ ...photo, capturedAt: new Date().toISOString() })),
        changeOrders: changes.map((change, index) => ({
          code: `crew-change-${index + 1}`,
          description: change.description.trim(),
          quantity: Number(change.quantity || 0),
          unitPrice: Number(change.unitPrice || 0),
          catalogBacked: false,
          customerAcknowledged: change.customerAcknowledged,
        })),
        damageReported,
        customerDisputed,
        crewNotes: notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Closeout submitted",
        description: data.status === "awaiting_customer"
          ? "The customer was asked to review the final amount."
          : "The owner was notified to review the exception.",
      });
      onSuccess();
    },
    onError: (error: Error) => toast({ title: "Closeout failed", description: error.message, variant: "destructive" }),
  });

  const uploadProof = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: Array<{ url: string; type: "completion"; description: string }> = [];
      for (const file of Array.from(files).slice(0, 10 - proofPhotos.length)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/leads/upload", { method: "POST", body: form, credentials: "include" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || `Could not upload ${file.name}`);
        uploaded.push({ url: data.url, type: "completion", description: file.name });
      }
      setProofPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      toast({ title: "Photo upload failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const invalidChanges = changes.some((change) => !change.description.trim() || Number(change.quantity) <= 0 || Number(change.unitPrice) < 0);

  return (
    <Dialog open={!!leadId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-700 bg-slate-950 text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Complete job closeout</DialogTitle>
          <p className="text-sm text-slate-400">Record actual time and completion proof. Billing waits for customer or owner approval.</p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="closeout-end">Work ended</Label><Input id="closeout-end" type="datetime-local" value={actualEndAt} onChange={(event) => setActualEndAt(event.target.value)} className="border-slate-700 bg-slate-900" /></div>
            <div className="space-y-1.5"><Label htmlFor="closeout-break">Unpaid break minutes</Label><Input id="closeout-break" type="number" min="0" max="1440" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} className="border-slate-700 bg-slate-900" /></div>
          </div>

          <div>
            <Label>Completion proof</Label>
            <label className="mt-2 flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-blue-400/50 bg-blue-500/10 text-sm font-semibold text-blue-200">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Take or upload completion photos"}
              <input className="hidden" type="file" accept="image/*" capture="environment" multiple disabled={uploading || proofPhotos.length >= 10} onChange={(event) => void uploadProof(event.target.files)} />
            </label>
            {proofPhotos.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{proofPhotos.map((photo, index) => <div key={`${photo.url}-${index}`} className="relative"><img src={photo.url} alt={photo.description} className="h-24 w-full rounded-lg object-cover" /><button type="button" aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-black/75 p-1" onClick={() => setProofPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}
          </div>

          <div>
            <div className="flex items-center justify-between"><Label>Added work or materials</Label><Button type="button" size="sm" variant="outline" onClick={() => setChanges((current) => [...current, { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "0", customerAcknowledged: false }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add change</Button></div>
            {changes.length === 0 && <p className="mt-2 text-xs text-slate-500">Leave blank when the approved scope did not change.</p>}
            <div className="mt-2 space-y-3">{changes.map((change) => <div key={change.id} className="rounded-xl border border-slate-700 p-3"><div className="flex gap-2"><Input placeholder="Describe added work" value={change.description} onChange={(event) => setChanges((current) => current.map((item) => item.id === change.id ? { ...item, description: event.target.value } : item))} className="border-slate-700 bg-slate-900" /><Button type="button" size="icon" variant="ghost" onClick={() => setChanges((current) => current.filter((item) => item.id !== change.id))}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-2 grid grid-cols-2 gap-2"><Input aria-label="Quantity" type="number" min="0.01" step="0.01" value={change.quantity} onChange={(event) => setChanges((current) => current.map((item) => item.id === change.id ? { ...item, quantity: event.target.value } : item))} className="border-slate-700 bg-slate-900" /><Input aria-label="Unit price" type="number" min="0" step="0.01" value={change.unitPrice} onChange={(event) => setChanges((current) => current.map((item) => item.id === change.id ? { ...item, unitPrice: event.target.value } : item))} className="border-slate-700 bg-slate-900" /></div><label className="mt-2 flex items-center gap-2 text-xs text-slate-300"><Checkbox checked={change.customerAcknowledged} onCheckedChange={(checked) => setChanges((current) => current.map((item) => item.id === change.id ? { ...item, customerAcknowledged: checked === true } : item))} /> Customer acknowledged this change</label></div>)}</div>
            {changes.length > 0 && <p className="mt-2 text-xs text-amber-300">Crew-added charges are routed to the owner before customer billing.</p>}
          </div>

          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Completion notes, access issues, or customer comments" className="min-h-24 border-slate-700 bg-slate-900" />
          <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-lg border border-slate-700 p-3 text-sm"><Checkbox checked={damageReported} onCheckedChange={(checked) => setDamageReported(checked === true)} /> Damage or incident reported</label><label className="flex items-center gap-2 rounded-lg border border-slate-700 p-3 text-sm"><Checkbox checked={customerDisputed} onCheckedChange={(checked) => setCustomerDisputed(checked === true)} /> Customer disputed scope or time</label></div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-500" disabled={submit.isPending || uploading || !proofPhotos.length || !actualEndAt || invalidChanges} onClick={() => submit.mutate()}>{submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit closeout"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
