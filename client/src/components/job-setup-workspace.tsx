import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, ClipboardPenLine, DollarSign, Loader2, PencilLine, Users } from "lucide-react";
import { JobOrderBuilder, type JobQuoteDraft } from "@/components/JobOrderBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface JobSetupLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceType: string;
  fromAddress: string;
  toAddress?: string;
  moveDate?: string;
  details?: string;
  confirmedDate?: string;
  arrivalWindow?: string;
  truckConfig?: string;
  crewSize?: number;
  confirmedHours?: number;
  crewMembers?: string[];
  basePrice?: string;
  totalPrice?: string;
  quoteNotes?: string;
  hasHotTub?: boolean;
  hotTubFee?: string;
  hasHeavySafe?: boolean;
  heavySafeFee?: string;
  hasPoolTable?: boolean;
  poolTableFee?: string;
  hasPiano?: boolean;
  pianoFee?: string;
}

export interface JobSetupEmployee {
  id: string;
  firstName: string;
  lastName: string;
  isApproved: boolean;
  status: string;
}

type SetupDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fromAddress: string;
  toAddress: string;
  moveDate: string;
  details: string;
  confirmedDate: string;
  arrivalWindow: string;
  truckConfig: string;
  crewSize: number;
  confirmedHours: number;
  crewMembers: string[];
};

const ARRIVAL_WINDOWS = [
  "7:00 AM – 9:00 AM", "8:00 AM – 10:00 AM", "9:00 AM – 11:00 AM",
  "10:00 AM – 12:00 PM", "11:00 AM – 1:00 PM", "12:00 PM – 2:00 PM",
  "1:00 PM – 3:00 PM", "2:00 PM – 4:00 PM", "3:00 PM – 5:00 PM", "Flexible / TBD",
];

function setupDraftFromLead(lead: JobSetupLead): SetupDraft {
  return {
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    fromAddress: lead.fromAddress || "",
    toAddress: lead.toAddress || "",
    moveDate: lead.moveDate || "",
    details: lead.details || "",
    confirmedDate: lead.confirmedDate || "",
    arrivalWindow: lead.arrivalWindow || "",
    truckConfig: lead.truckConfig || "no_truck",
    crewSize: lead.crewSize || 2,
    confirmedHours: lead.confirmedHours || 2,
    crewMembers: lead.crewMembers || [],
  };
}

function savedQuote(lead: JobSetupLead): JobQuoteDraft | null {
  const total = Number(lead.totalPrice || lead.basePrice || 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    basePrice: String(lead.basePrice || total.toFixed(2)),
    totalPrice: total.toFixed(2),
    crewSize: lead.crewSize || 2,
    confirmedHours: lead.confirmedHours || 2,
    quoteNotes: lead.quoteNotes || "",
    hasHotTub: !!lead.hasHotTub,
    hotTubFee: lead.hotTubFee || "0",
    hasHeavySafe: !!lead.hasHeavySafe,
    heavySafeFee: lead.heavySafeFee || "0",
    hasPoolTable: !!lead.hasPoolTable,
    poolTableFee: lead.poolTableFee || "0",
    hasPiano: !!lead.hasPiano,
    pianoFee: lead.pianoFee || "0",
    totalSpecialItemsFee: "0",
    lineItems: [],
  };
}

interface JobSetupWorkspaceProps {
  lead: JobSetupLead;
  employees: JobSetupEmployee[];
  canManageSetup: boolean;
  onSaved: () => void;
}

/**
 * One place to collect the information needed to turn a request into a ready job.
 * Quote selection is staged locally and only becomes real when Save Job Setup is pressed.
 */
export function JobSetupWorkspace({ lead, employees, canManageSetup, onSaved }: JobSetupWorkspaceProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<SetupDraft>(() => setupDraftFromLead(lead));
  const [quoteDraft, setQuoteDraft] = useState<JobQuoteDraft | null>(() => savedQuote(lead));
  const [quoteDirty, setQuoteDirty] = useState(false);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(() => !savedQuote(lead));

  useEffect(() => {
    setDraft(setupDraftFromLead(lead));
    setQuoteDraft(savedQuote(lead));
    setQuoteDirty(false);
    setShowQuoteBuilder(!savedQuote(lead));
  }, [lead]);

  const quoteLead = useMemo(() => ({
    ...lead,
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    phone: draft.phone,
    fromAddress: draft.fromAddress,
    toAddress: draft.toAddress,
    moveDate: draft.moveDate,
    confirmedDate: draft.confirmedDate,
    arrivalWindow: draft.arrivalWindow,
    truckConfig: draft.truckConfig,
    crewSize: draft.crewSize,
    confirmedHours: draft.confirmedHours,
  }), [draft, lead]);

  const updateDraft = <Key extends keyof SetupDraft>(key: Key, value: SetupDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.firstName.trim() || !draft.lastName.trim()) {
        throw new Error("Enter the customer's first and last name.");
      }
      if (!draft.fromAddress.trim()) {
        throw new Error("Enter the pickup or service address.");
      }
      return apiRequest("PATCH", `/api/leads/${lead.id}/setup`, {
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        fromAddress: draft.fromAddress.trim(),
        toAddress: draft.toAddress.trim(),
        moveDate: draft.moveDate,
        details: draft.details.trim(),
        ...(canManageSetup ? {
          confirmedDate: draft.confirmedDate,
          arrivalWindow: draft.arrivalWindow,
          truckConfig: draft.truckConfig,
          crewSize: draft.crewSize,
          confirmedHours: draft.confirmedHours,
          crewMembers: draft.crewMembers,
          quote: quoteDirty ? quoteDraft : undefined,
        } : {}),
      });
    },
    onSuccess: () => {
      toast({ title: "Job setup saved", description: "Customer and job details are up to date. Nothing was sent to the customer." });
      onSaved();
    },
    onError: (error: Error) => {
      toast({ title: "Could not save job setup", description: error.message || "Please review the job details and try again.", variant: "destructive" });
    },
  });

  const approvedEmployees = employees.filter((employee) => employee.isApproved || employee.status === "approved" || employee.status === "active");
  const quoteTotal = quoteDraft ? Number(quoteDraft.totalPrice || 0) : 0;

  return (
    <Card id="job-setup" className="mb-4 scroll-mt-4 border-blue-500/35 bg-gradient-to-b from-blue-950/20 to-background" data-testid="job-setup-workspace">
      <CardHeader className="gap-3 border-b border-blue-500/15 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300"><ClipboardPenLine className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-lg">Job Setup</CardTitle>
              <CardDescription>Customer, job plan, and quote in one place. Save when it is ready—nothing is sent automatically.</CardDescription>
            </div>
          </div>
          {canManageSetup ? <Badge className="bg-blue-600/20 text-blue-200">Full setup access</Badge> : <Badge variant="secondary">Customer & job details</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <section className="space-y-3">
          <div className="flex items-center gap-2"><PencilLine className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Customer</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="setup-first-name">First Name</Label><Input id="setup-first-name" value={draft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} data-testid="input-setup-first-name" /></div>
            <div><Label htmlFor="setup-last-name">Last Name</Label><Input id="setup-last-name" value={draft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} data-testid="input-setup-last-name" /></div>
            <div><Label htmlFor="setup-phone">Phone</Label><Input id="setup-phone" type="tel" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} /></div>
            <div><Label htmlFor="setup-email">Email</Label><Input id="setup-email" type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-3 border-t pt-5">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Job details</h3></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="setup-from-address">Pickup / Service Address</Label><Input id="setup-from-address" value={draft.fromAddress} onChange={(event) => updateDraft("fromAddress", event.target.value)} /></div>
            <div className="sm:col-span-2"><Label htmlFor="setup-to-address">Drop-off Address <span className="text-muted-foreground">(if applicable)</span></Label><Input id="setup-to-address" value={draft.toAddress} onChange={(event) => updateDraft("toAddress", event.target.value)} /></div>
            <div><Label>Requested Date</Label><DatePicker value={draft.moveDate || undefined} onChange={(value) => updateDraft("moveDate", value || "")} placeholder="Pick a requested date" /></div>
          </div>
          <div><Label htmlFor="setup-details">Job Notes & Details</Label><Textarea id="setup-details" rows={4} value={draft.details} onChange={(event) => updateDraft("details", event.target.value)} placeholder="Items, access instructions, customer requests, and anything the crew needs to know." /></div>
        </section>

        {canManageSetup ? <>
          <section className="space-y-4 border-t pt-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Crew & schedule</h3></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Confirmed Date</Label><DatePicker value={draft.confirmedDate || undefined} onChange={(value) => updateDraft("confirmedDate", value || "")} placeholder="Pick a confirmed date" /></div>
              <div><Label>Arrival Window</Label><Select value={draft.arrivalWindow || undefined} onValueChange={(value) => updateDraft("arrivalWindow", value)}><SelectTrigger><SelectValue placeholder="Select arrival window" /></SelectTrigger><SelectContent>{ARRIVAL_WINDOWS.map((window) => <SelectItem key={window} value={window}>{window}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Truck / Trailer</Label><Select value={draft.truckConfig} onValueChange={(value) => updateDraft("truckConfig", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no_truck">No truck needed</SelectItem><SelectItem value="company_truck">JC truck</SelectItem><SelectItem value="customer_truck">Customer truck</SelectItem><SelectItem value="trailer_only">Trailer only</SelectItem></SelectContent></Select></div>
              <div><Label htmlFor="setup-hours">Hours Estimate</Label><Input id="setup-hours" type="number" min="1" max="24" value={draft.confirmedHours} onChange={(event) => updateDraft("confirmedHours", Math.max(1, Number(event.target.value) || 1))} /></div>
            </div>
            <div><Label className="mb-2 block">Crew Size</Label><div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map((size) => <Button key={size} type="button" variant={draft.crewSize === size ? "default" : "outline"} className="min-w-12" onClick={() => updateDraft("crewSize", size)}>{size} {size === 1 ? "mover" : "movers"}</Button>)}</div></div>
            <div><Label className="mb-2 block">Named Crew</Label><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{approvedEmployees.length ? approvedEmployees.map((employee) => { const checked = draft.crewMembers.includes(employee.id); return <label key={employee.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => updateDraft("crewMembers", value ? [...draft.crewMembers, employee.id] : draft.crewMembers.filter((id) => id !== employee.id))} />{employee.firstName} {employee.lastName}</label>; }) : <p className="text-sm text-muted-foreground">No approved crew members found.</p>}</div></div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /><h3 className="font-semibold">Quote</h3></div><Button type="button" variant="outline" onClick={() => setShowQuoteBuilder((show) => !show)}>{showQuoteBuilder ? "Hide quote builder" : quoteDraft ? "Adjust quote" : "Build quote"}</Button></div>
            {quoteDraft && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3"><div><p className="text-sm font-semibold text-emerald-300">{quoteDirty ? "New quote ready to save" : "Saved quote"}</p><p className="text-xs text-muted-foreground">{quoteDirty ? "It will be saved only when you press Save Job Setup." : "Adjust it here if the job needs a new price."}</p></div><p className="text-2xl font-bold text-emerald-300">${quoteTotal.toFixed(2)}</p></div>}
            {showQuoteBuilder && <JobOrderBuilder lead={quoteLead} disabled={saveMutation.isPending} applyLabel="Add quote to job setup" onApply={(quote) => { setQuoteDraft(quote); setQuoteDirty(true); setShowQuoteBuilder(false); toast({ title: "Quote added to setup", description: "Review the details, then save the full job setup." }); }} />}
          </section>
        </> : <p className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">An owner or admin can add crew, scheduling, and pricing. Your edits to customer and job details will still save here.</p>}

        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-blue-500/30 bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => { setDraft(setupDraftFromLead(lead)); setQuoteDraft(savedQuote(lead)); setQuoteDirty(false); }} disabled={saveMutation.isPending}>Reset</Button>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-job-setup">{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Save Job Setup</Button>
        </div>
      </CardContent>
    </Card>
  );
}
