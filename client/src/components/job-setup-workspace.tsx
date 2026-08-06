import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, CircleHelp, ClipboardPenLine, DollarSign, Loader2, PencilLine, Users } from "lucide-react";
import { JobOrderBuilder, type JobQuoteDraft } from "@/components/JobOrderBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  trailerRequested?: boolean;
  crewSize?: number;
  confirmedHours?: number;
  crewMembers?: string[];
  crewLeadUserId?: string | null;
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
  jobPlanDetails?: {
    stairsFlights?: number;
    hasElevator?: boolean;
    specialItemsNotes?: string;
    additionalStops?: Array<{ address?: string; note?: string }>;
  } | null;
  jobAccess?: {
    accessCode?: string;
    entryInstructions?: string;
  } | null;
  quoteSnapshot?: { manualQuoteOverride?: unknown } | null;
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
  trailerRequested: boolean;
  crewSize: number;
  confirmedHours: number;
  crewMembers: string[];
  crewLeadUserId: string;
  accessCode: string;
  entryInstructions: string;
  stairsFlights: number;
  hasElevator: boolean;
  specialItemsNotes: string;
  additionalStops: Array<{ address: string; note: string }>;
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
    trailerRequested: !!lead.trailerRequested,
    crewSize: lead.crewSize || 2,
    confirmedHours: lead.confirmedHours || 2,
    crewMembers: lead.crewMembers || [],
    crewLeadUserId: lead.crewLeadUserId || "",
    accessCode: lead.jobAccess?.accessCode || "",
    entryInstructions: lead.jobAccess?.entryInstructions || "",
    stairsFlights: Math.max(0, Number(lead.jobPlanDetails?.stairsFlights || 0)),
    hasElevator: Boolean(lead.jobPlanDetails?.hasElevator),
    specialItemsNotes: lead.jobPlanDetails?.specialItemsNotes || "",
    additionalStops: (lead.jobPlanDetails?.additionalStops || []).map((stop) => ({ address: stop.address || "", note: stop.note || "" })),
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
  const [quotePricingSource, setQuotePricingSource] = useState<"rate_card_auto" | "manual_override">(
    lead.quoteSnapshot?.manualQuoteOverride ? "manual_override" : "rate_card_auto",
  );
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(() => !savedQuote(lead));

  useEffect(() => {
    setDraft(setupDraftFromLead(lead));
    setQuoteDraft(savedQuote(lead));
    setQuoteDirty(false);
    setQuotePricingSource(lead.quoteSnapshot?.manualQuoteOverride ? "manual_override" : "rate_card_auto");
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
  const updateAdditionalStop = (index: number, key: "address" | "note", value: string) => {
    setDraft((current) => ({
      ...current,
      additionalStops: current.additionalStops.map((stop, stopIndex) => stopIndex === index ? { ...stop, [key]: value } : stop),
    }));
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
          trailerRequested: draft.trailerRequested,
          crewSize: draft.crewSize,
          confirmedHours: draft.confirmedHours,
          crewMembers: draft.crewMembers,
          crewLeadUserId: draft.crewLeadUserId || null,
          jobPlanDetails: {
            accessCode: draft.accessCode,
            entryInstructions: draft.entryInstructions,
            stairsFlights: draft.stairsFlights,
            hasElevator: draft.hasElevator,
            specialItemsNotes: draft.specialItemsNotes,
            additionalStops: draft.additionalStops.filter((stop) => stop.address.trim()).map((stop) => ({ address: stop.address.trim(), note: stop.note.trim() })),
          },
          quote: quoteDirty && quoteDraft ? { ...quoteDraft, pricingSource: quotePricingSource } : undefined,
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
  const { data: autoQuotePreview } = useQuery<{
    labor: number;
    truck: number;
    trailer: number;
    stairs: number;
    elevator: number;
    total: number;
    projectedCustomerJcMoves: number;
    projectedCrewPoolJcMoves: number;
  }>({
    queryKey: ["/api/leads", lead.id, "quote-preview", draft.crewSize, draft.confirmedHours, draft.truckConfig, draft.trailerRequested, draft.stairsFlights, draft.hasElevator],
    queryFn: async () => {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/quote-preview`, {
        crewSize: draft.crewSize,
        confirmedHours: draft.confirmedHours,
        truckConfig: draft.truckConfig,
        trailerRequested: draft.trailerRequested,
        stairsFlights: draft.stairsFlights,
        hasElevator: draft.hasElevator,
      });
      return response.json();
    },
    enabled: canManageSetup,
  });

  useEffect(() => {
    if (!canManageSetup || !autoQuotePreview || quotePricingSource !== "rate_card_auto") return;
    setQuoteDraft((current) => {
      const basePrice = autoQuotePreview.total.toFixed(2);
      const next = {
        basePrice,
        totalPrice: basePrice,
        crewSize: draft.crewSize,
        confirmedHours: draft.confirmedHours,
        quoteNotes: "Automatic rate-card quote.",
        hasHotTub: current?.hasHotTub || false,
        hotTubFee: current?.hotTubFee || "0",
        hasHeavySafe: current?.hasHeavySafe || false,
        heavySafeFee: current?.heavySafeFee || "0",
        hasPoolTable: current?.hasPoolTable || false,
        poolTableFee: current?.poolTableFee || "0",
        hasPiano: current?.hasPiano || false,
        pianoFee: current?.pianoFee || "0",
        totalSpecialItemsFee: current?.totalSpecialItemsFee || "0",
        lineItems: current?.lineItems || [],
      } as JobQuoteDraft;
      const changed = !current
        || current.basePrice !== next.basePrice
        || current.crewSize !== next.crewSize
        || current.confirmedHours !== next.confirmedHours;
      if (changed) setQuoteDirty(true);
      return next;
    });
  }, [autoQuotePreview, canManageSetup, draft.confirmedHours, draft.crewSize, quotePricingSource]);

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
            <div className="flex items-center gap-2"><ClipboardPenLine className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Move & access details</h3></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="setup-stairs">Stair flights</Label><Input id="setup-stairs" type="number" min="0" max="50" value={draft.stairsFlights} onChange={(event) => updateDraft("stairsFlights", Math.max(0, Math.min(50, Number(event.target.value) || 0)))} /></div>
              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={draft.hasElevator} onCheckedChange={(value) => updateDraft("hasElevator", value === true)} />Elevator access (+rate-card fee)</label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="setup-access-code">Access code</Label><Input id="setup-access-code" type="password" autoComplete="off" value={draft.accessCode} onChange={(event) => updateDraft("accessCode", event.target.value)} placeholder="Visible only to admins and assigned crew" /></div>
              <div><Label htmlFor="setup-entry-instructions">Entry instructions</Label><Input id="setup-entry-instructions" autoComplete="off" value={draft.entryInstructions} onChange={(event) => updateDraft("entryInstructions", event.target.value)} placeholder="Gate, lockbox, parking, or contact instructions" /></div>
            </div>
            <div><Label htmlFor="setup-special-items-notes">Special item details</Label><Textarea id="setup-special-items-notes" rows={2} value={draft.specialItemsNotes} onChange={(event) => updateDraft("specialItemsNotes", event.target.value)} placeholder="Weights, fragile items, disassembly needs, or equipment notes" /></div>
            <div className="space-y-2"><div className="flex items-center justify-between gap-3"><Label>Additional stops</Label><Button type="button" size="sm" variant="outline" onClick={() => updateDraft("additionalStops", [...draft.additionalStops, { address: "", note: "" }])}>Add stop</Button></div>{draft.additionalStops.map((stop, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"><Input value={stop.address} onChange={(event) => updateAdditionalStop(index, "address", event.target.value)} placeholder="Stop address" /><Input value={stop.note} onChange={(event) => updateAdditionalStop(index, "note", event.target.value)} placeholder="Stop note (optional)" /><Button type="button" variant="ghost" size="sm" onClick={() => updateDraft("additionalStops", draft.additionalStops.filter((_, stopIndex) => stopIndex !== index))}>Remove</Button></div>)}</div>
          </section>
          {autoQuotePreview && <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="flex items-center gap-1 text-sm font-semibold text-emerald-300">Automatic rate-card quote<Popover><PopoverTrigger asChild><button type="button" aria-label="Explain automatic quote"><CircleHelp className="h-3.5 w-3.5" /></button></PopoverTrigger><PopoverContent className="w-64 text-xs">The server applies the saved labor, equipment, stairs, and elevator rates. A manual adjustment never replaces this calculation in the audit history.</PopoverContent></Popover></p><p className="text-xs text-muted-foreground">Labor, equipment, and access fees are calculated by the server.</p><p className="mt-1 text-xs text-muted-foreground">Access: stairs ${autoQuotePreview.stairs.toFixed(2)} · elevator ${autoQuotePreview.elevator.toFixed(2)}</p><p className="mt-1 flex items-center gap-1 text-xs text-amber-300">JCMOVES projection<Popover><PopoverTrigger asChild><button type="button" aria-label="Explain JCMOVES projection"><CircleHelp className="h-3 w-3" /></button></PopoverTrigger><PopoverContent className="w-64 text-xs">The customer and total crew pool each use this amount. The lead receives a 15% crew-pool bonus at paid completion; the rest splits evenly.</PopoverContent></Popover></p></div><p className="text-xl font-bold text-emerald-300">${autoQuotePreview.total.toFixed(2)}</p></div>
            <p className="mt-2 text-xs text-muted-foreground">Labor ${autoQuotePreview.labor.toFixed(2)} · Truck ${autoQuotePreview.truck.toFixed(2)} · Trailer ${autoQuotePreview.trailer.toFixed(2)}</p>
            <p className="mt-1 text-xs text-amber-300">Projected: {autoQuotePreview.projectedCustomerJcMoves.toLocaleString()} customer JCMOVES and {autoQuotePreview.projectedCrewPoolJcMoves.toLocaleString()} crew-pool JCMOVES after paid completion.</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => { setQuoteDraft({ basePrice: autoQuotePreview.total.toFixed(2), totalPrice: autoQuotePreview.total.toFixed(2), crewSize: draft.crewSize, confirmedHours: draft.confirmedHours, quoteNotes: "Automatic rate-card quote.", hasHotTub: false, hotTubFee: "0", hasHeavySafe: false, heavySafeFee: "0", hasPoolTable: false, poolTableFee: "0", hasPiano: false, pianoFee: "0", totalSpecialItemsFee: "0", lineItems: [] } as JobQuoteDraft); setQuotePricingSource("rate_card_auto"); setQuoteDirty(true); setShowQuoteBuilder(false); }}>Use automatic quote</Button>
          </div>}

          <section className="space-y-4 border-t pt-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Crew & schedule</h3></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Confirmed Date</Label><DatePicker value={draft.confirmedDate || undefined} onChange={(value) => updateDraft("confirmedDate", value || "")} placeholder="Pick a confirmed date" /></div>
              <div><Label>Arrival Window</Label><Select value={draft.arrivalWindow || undefined} onValueChange={(value) => updateDraft("arrivalWindow", value)}><SelectTrigger><SelectValue placeholder="Select arrival window" /></SelectTrigger><SelectContent>{ARRIVAL_WINDOWS.map((window) => <SelectItem key={window} value={window}>{window}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Truck</Label><Select value={draft.truckConfig} onValueChange={(value) => updateDraft("truckConfig", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no_truck">Labor only — no truck</SelectItem><SelectItem value="company_truck">JC truck (+rate-card truck fee)</SelectItem><SelectItem value="customer_truck">Customer truck</SelectItem></SelectContent></Select></div>
              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={draft.trailerRequested} onCheckedChange={(value) => updateDraft("trailerRequested", value === true)} />Trailer (+rate-card trailer fee)</label>
              <div><Label htmlFor="setup-hours">Hours Estimate</Label><Input id="setup-hours" type="number" min="1" max="24" value={draft.confirmedHours} onChange={(event) => updateDraft("confirmedHours", Math.max(1, Number(event.target.value) || 1))} /></div>
            </div>
            <div><Label className="mb-2 block">Crew Size</Label><div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map((size) => <Button key={size} type="button" variant={draft.crewSize === size ? "default" : "outline"} className="min-w-12" onClick={() => updateDraft("crewSize", size)}>{size} {size === 1 ? "mover" : "movers"}</Button>)}</div></div>
            <div><Label className="mb-2 block">Named Crew</Label><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{approvedEmployees.length ? approvedEmployees.map((employee) => { const checked = draft.crewMembers.includes(employee.id); return <label key={employee.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => updateDraft("crewMembers", value ? [...draft.crewMembers, employee.id] : draft.crewMembers.filter((id) => id !== employee.id))} />{employee.firstName} {employee.lastName}</label>; }) : <p className="text-sm text-muted-foreground">No approved crew members found.</p>}</div></div>
            <div><Label>Crew lead</Label><Select value={draft.crewLeadUserId || undefined} onValueChange={(value) => updateDraft("crewLeadUserId", value)}><SelectTrigger><SelectValue placeholder="Select the crew lead" /></SelectTrigger><SelectContent>{draft.crewMembers.length ? draft.crewMembers.map((id) => { const employee = approvedEmployees.find((entry) => entry.id === id); return <SelectItem key={id} value={id}>{employee ? `${employee.firstName} ${employee.lastName}` : "Selected crew member"}</SelectItem>; }) : <SelectItem value="__none" disabled>Select a crew member first</SelectItem>}</SelectContent></Select></div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /><h3 className="font-semibold">Quote</h3></div><Button type="button" variant="outline" onClick={() => setShowQuoteBuilder((show) => !show)}>{showQuoteBuilder ? "Hide quote builder" : quoteDraft ? "Adjust quote" : "Build quote"}</Button></div>
            {quoteDraft && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3"><div><p className="text-sm font-semibold text-emerald-300">{quotePricingSource === "manual_override" ? "Manual quote override" : quoteDirty ? "Automatic quote ready to save" : "Saved automatic quote"}</p><p className="text-xs text-muted-foreground">{quotePricingSource === "manual_override" ? `Automatic base: $${autoQuotePreview?.total.toFixed(2) || "TBD"}. Both values are retained for audit.` : quoteDirty ? "It will be saved only when you press Save Job Setup." : "Updates automatically when priced job details change."}</p></div><p className="text-2xl font-bold text-emerald-300">${quoteTotal.toFixed(2)}</p></div>}
            {showQuoteBuilder && <JobOrderBuilder lead={quoteLead} disabled={saveMutation.isPending} applyLabel="Add quote to job setup" onApply={(quote) => { setQuoteDraft(quote); setQuotePricingSource("manual_override"); setQuoteDirty(true); setShowQuoteBuilder(false); toast({ title: "Manual quote adjustment added", description: "The saved rate-card quote is retained in the audit history." }); }} />}
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
