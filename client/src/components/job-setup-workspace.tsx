import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, CircleHelp, ClipboardPenLine, DollarSign, Loader2, PencilLine, Users } from "lucide-react";
import type { JobQuoteDraft, JobQuoteLineItem } from "@/components/JobOrderBuilder";
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
  promoCode?: string | null;
  crewSize?: number;
  confirmedHours?: number;
  crewMembers?: string[];
  crewLeadUserId?: string | null;
  driverUserId?: string | null;
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
  isDriver?: boolean | null;
  capabilities?: string[] | null;
  payoutProfile?: { payoutClassification?: "lead_mover" | "mover" | "helper" | null } | null;
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
  promoCode: string;
  crewSize: number;
  confirmedHours: number;
  crewMembers: string[];
  crewLeadUserId: string;
  driverUserId: string;
  crewRoles: Record<string, "lead_mover" | "mover" | "helper">;
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

const PRICED_DRAFT_KEYS = new Set<keyof SetupDraft>([
  "fromAddress",
  "toAddress",
  "truckConfig",
  "trailerRequested",
  "promoCode",
  "crewSize",
  "confirmedHours",
  "stairsFlights",
  "hasElevator",
]);

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
    promoCode: lead.promoCode || "",
    crewSize: lead.crewSize || 2,
    confirmedHours: lead.confirmedHours || 2,
    crewMembers: lead.crewMembers || [],
    crewLeadUserId: lead.crewLeadUserId || lead.crewMembers?.[0] || "",
    driverUserId: lead.driverUserId || "",
    crewRoles: Object.fromEntries((lead.crewMembers || []).map((id) => [id, id === (lead.crewLeadUserId || lead.crewMembers?.[0]) ? "lead_mover" : "mover"])),
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

  useEffect(() => {
    setDraft(setupDraftFromLead(lead));
    setQuoteDraft(savedQuote(lead));
    setQuoteDirty(false);
    setQuotePricingSource(lead.quoteSnapshot?.manualQuoteOverride ? "manual_override" : "rate_card_auto");
  }, [lead]);

  const updateDraft = <Key extends keyof SetupDraft>(key: Key, value: SetupDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (PRICED_DRAFT_KEYS.has(key)) setQuotePricingSource("rate_card_auto");
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
          promoCode: draft.promoCode.trim().toUpperCase(),
          crewSize: draft.crewSize,
          confirmedHours: draft.confirmedHours,
          crewMembers: draft.crewMembers,
          crewLeadUserId: draft.crewLeadUserId || null,
          driverUserId: draft.driverUserId || null,
          crewAssignments: draft.crewMembers.map((workerId) => ({
            workerId,
            roleOnJob: workerId === draft.crewLeadUserId ? "lead_mover" : (draft.crewRoles[workerId] || "mover"),
          })),
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
  const {
    data: autoQuotePreview,
    isFetching: quotePreviewFetching,
    isError: quotePreviewFailed,
    refetch: retryQuotePreview,
  } = useQuery<{
    labor: number;
    truck: number;
    trailer: number;
    stairs: number;
    elevator: number;
    total: number;
    rewardEligibleTotal: number;
    preDiscountTotal?: number;
    discountAmount?: number;
    projectedCustomerJcMoves: number;
    projectedCrewPoolJcMoves: number;
    packagePrice?: number;
    promotion?: {
      code: string;
      description: string;
      kind: "percentage_discount" | "fixed_moving_package";
      discountPercent?: number;
      discountAmount?: number;
      fixedBasePrice?: number;
      requiredCrewSize?: number;
      requiredHours?: number;
      verifiedLocalMiles?: number;
      localMilesMax?: number;
      includesCompanyTruck?: boolean;
      includesTrailer?: boolean;
    };
    promo?: { requestedCode: string; applied: boolean; reason?: string };
    reservedEquipment?: { truckConfig: string; trailerRequested: boolean };
  }>({
    queryKey: ["/api/leads", lead.id, "quote-preview", draft.crewSize, draft.confirmedHours, draft.truckConfig, draft.trailerRequested, draft.stairsFlights, draft.hasElevator, draft.promoCode, draft.fromAddress, draft.toAddress],
    queryFn: async () => {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/quote-preview`, {
        crewSize: draft.crewSize,
        confirmedHours: draft.confirmedHours,
        truckConfig: draft.truckConfig,
        trailerRequested: draft.trailerRequested,
        stairsFlights: draft.stairsFlights,
        hasElevator: draft.hasElevator,
        promoCode: draft.promoCode.trim().toUpperCase(),
        fromAddress: draft.fromAddress,
        toAddress: draft.toAddress,
      });
      return response.json();
    },
    enabled: canManageSetup,
  });

  useEffect(() => {
    const reserved = autoQuotePreview?.reservedEquipment;
    if (!reserved) return;
    setDraft((current) => current.truckConfig === reserved.truckConfig && current.trailerRequested === reserved.trailerRequested
      ? current
      : { ...current, ...reserved });
  }, [autoQuotePreview?.reservedEquipment]);

  useEffect(() => {
    if (!canManageSetup || !autoQuotePreview || quotePricingSource !== "rate_card_auto") return;
    setQuoteDraft((current) => {
      const basePrice = autoQuotePreview.total.toFixed(2);
      const specialItems = [
        { selected: current?.hasHotTub, id: "hot_tub", name: "Hot tub surcharge", amount: Number(current?.hotTubFee || 0) },
        { selected: current?.hasHeavySafe, id: "heavy_safe", name: "Heavy safe surcharge", amount: Number(current?.heavySafeFee || 0) },
        { selected: current?.hasPoolTable, id: "pool_table", name: "Pool table surcharge", amount: Number(current?.poolTableFee || 0) },
        { selected: current?.hasPiano, id: "piano", name: "Piano surcharge", amount: Number(current?.pianoFee || 0) },
      ].filter((item) => item.selected && Number.isFinite(item.amount) && item.amount > 0);
      const totalSpecialItemsFee = specialItems.reduce((total, item) => total + item.amount, 0);
      const lineItems: JobQuoteLineItem[] = [
        { id: "labor", name: `Labor - ${draft.crewSize} ${draft.crewSize === 1 ? "mover" : "movers"} x ${draft.confirmedHours} ${draft.confirmedHours === 1 ? "hour" : "hours"}`, qty: 1, unitPrice: autoQuotePreview.labor, total: autoQuotePreview.labor, category: "labor" },
        { id: "truck", name: "Truck", qty: 1, unitPrice: autoQuotePreview.truck, total: autoQuotePreview.truck, category: "truck" },
        { id: "trailer", name: "Trailer", qty: 1, unitPrice: autoQuotePreview.trailer, total: autoQuotePreview.trailer, category: "trailer" },
        { id: "stairs", name: "Stairs", qty: 1, unitPrice: autoQuotePreview.stairs, total: autoQuotePreview.stairs, category: "access" },
        { id: "elevator", name: "Elevator", qty: 1, unitPrice: autoQuotePreview.elevator, total: autoQuotePreview.elevator, category: "access" },
        ...specialItems.map((item) => ({ id: item.id, name: item.name, qty: 1, unitPrice: item.amount, total: item.amount, category: "specialty" })),
      ].filter((item) => item.total > 0);
      const next = {
        basePrice,
        totalPrice: (autoQuotePreview.total + totalSpecialItemsFee).toFixed(2),
        crewSize: draft.crewSize,
        confirmedHours: draft.confirmedHours,
        quoteNotes: autoQuotePreview.promotion
          ? autoQuotePreview.promotion.kind === "fixed_moving_package"
            ? `${autoQuotePreview.promotion.code} fixed moving package.`
            : `${autoQuotePreview.promotion.code} ${autoQuotePreview.promotion.discountPercent}% moving discount.`
          : "Automatic rate-card quote.",
        hasHotTub: current?.hasHotTub || false,
        hotTubFee: current?.hotTubFee || "0",
        hasHeavySafe: current?.hasHeavySafe || false,
        heavySafeFee: current?.heavySafeFee || "0",
        hasPoolTable: current?.hasPoolTable || false,
        poolTableFee: current?.poolTableFee || "0",
        hasPiano: current?.hasPiano || false,
        pianoFee: current?.pianoFee || "0",
        totalSpecialItemsFee: totalSpecialItemsFee.toFixed(2),
        lineItems,
      } as JobQuoteDraft;
      const changed = !current
        || current.basePrice !== next.basePrice
        || current.totalPrice !== next.totalPrice
        || current.crewSize !== next.crewSize
        || current.confirmedHours !== next.confirmedHours
        || JSON.stringify(current.lineItems) !== JSON.stringify(next.lineItems);
      if (changed) setQuoteDirty(true);
      return next;
    });
  }, [autoQuotePreview, canManageSetup, draft.confirmedHours, draft.crewSize, quotePricingSource]);

  const quoteIsUpdating = canManageSetup && quotePricingSource === "rate_card_auto" && quotePreviewFetching;
  const quoteCannotSave = canManageSetup && quotePricingSource === "rate_card_auto" && quotePreviewFailed;

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
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"><div><Label htmlFor="setup-promo-code">Promo / package code</Label><Input id="setup-promo-code" value={draft.promoCode} onChange={(event) => updateDraft("promoCode", event.target.value.toUpperCase())} placeholder="e.g. LOCAL4X4" autoCapitalize="characters" /></div>{draft.promoCode && <Button type="button" variant="ghost" size="sm" onClick={() => updateDraft("promoCode", "")}>Clear code</Button>}</div>

          <section className="space-y-4 border-t pt-5">
            <div className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-400" /><h3 className="font-semibold">Crew & schedule</h3></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Confirmed Date</Label><DatePicker value={draft.confirmedDate || undefined} onChange={(value) => updateDraft("confirmedDate", value || "")} placeholder="Pick a confirmed date" /></div>
              <div><Label>Arrival Window</Label><Select value={draft.arrivalWindow || undefined} onValueChange={(value) => updateDraft("arrivalWindow", value)}><SelectTrigger><SelectValue placeholder="Select arrival window" /></SelectTrigger><SelectContent>{ARRIVAL_WINDOWS.map((window) => <SelectItem key={window} value={window}>{window}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Truck</Label><Select value={draft.truckConfig} onValueChange={(value) => updateDraft("truckConfig", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no_truck">Labor only — no truck</SelectItem><SelectItem value="company_truck">JC truck (+rate-card truck fee)</SelectItem><SelectItem value="customer_truck">Customer truck</SelectItem></SelectContent></Select></div>
              <label className="flex items-center gap-3 rounded-lg border p-3 text-sm"><Checkbox checked={draft.trailerRequested} onCheckedChange={(value) => updateDraft("trailerRequested", value === true)} />Trailer (+rate-card trailer fee)</label>
              <div><Label htmlFor="setup-hours">Hours Estimate</Label><Select value={String(draft.confirmedHours)} onValueChange={(value) => updateDraft("confirmedHours", Number(value))}><SelectTrigger id="setup-hours"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => <SelectItem key={hour} value={String(hour)}>{hour} {hour === 1 ? "hour" : "hours"}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label className="mb-2 block">Crew Size</Label><div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map((size) => <Button key={size} type="button" variant={draft.crewSize === size ? "default" : "outline"} className="min-w-12" onClick={() => updateDraft("crewSize", size)}>{size} {size === 1 ? "mover" : "movers"}</Button>)}</div></div>
            <div><Label className="mb-2 block">Named Crew</Label><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{approvedEmployees.length ? approvedEmployees.map((employee) => { const checked = draft.crewMembers.includes(employee.id); return <label key={employee.id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={checked} onCheckedChange={(value) => setDraft((current) => { const crewMembers = value ? [...current.crewMembers, employee.id] : current.crewMembers.filter((id) => id !== employee.id); const crewLeadUserId = crewMembers.includes(current.crewLeadUserId) ? current.crewLeadUserId : crewMembers[0] || ""; const driverUserId = crewMembers.includes(current.driverUserId) ? current.driverUserId : ""; const crewRoles = { ...current.crewRoles }; if (value) crewRoles[employee.id] = employee.payoutProfile?.payoutClassification || "mover"; else delete crewRoles[employee.id]; return { ...current, crewMembers, crewLeadUserId, driverUserId, crewRoles }; })} />{employee.firstName} {employee.lastName}</label>; }) : <p className="text-sm text-muted-foreground">No approved crew members found.</p>}</div></div>
            <div><Label>Crew lead</Label><Select value={draft.crewLeadUserId || undefined} onValueChange={(value) => updateDraft("crewLeadUserId", value)}><SelectTrigger><SelectValue placeholder="Select the crew lead" /></SelectTrigger><SelectContent>{draft.crewMembers.length ? draft.crewMembers.map((id) => { const employee = approvedEmployees.find((entry) => entry.id === id); return <SelectItem key={id} value={id}>{employee ? `${employee.firstName} ${employee.lastName}` : "Selected crew member"}</SelectItem>; }) : <SelectItem value="__none" disabled>Select a crew member first</SelectItem>}</SelectContent></Select></div>
            <div><Label>Driver bonus</Label><Select value={draft.driverUserId || "__none"} onValueChange={(value) => updateDraft("driverUserId", value === "__none" ? "" : value)}><SelectTrigger><SelectValue placeholder="No designated driver" /></SelectTrigger><SelectContent><SelectItem value="__none">No driver bonus</SelectItem>{draft.crewMembers.map((id) => approvedEmployees.find((employee) => employee.id === id)).filter((employee): employee is JobSetupEmployee => Boolean(employee && (employee.isDriver || employee.capabilities?.includes("driver")))).map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} (+$5/hour)</SelectItem>)}</SelectContent></Select></div>
            {draft.crewMembers.length > 0 && <div><Label className="mb-2 block">Job classifications</Label><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">{draft.crewMembers.map((id) => { const employee = approvedEmployees.find((entry) => entry.id === id); const isLead = id === draft.crewLeadUserId; return <div key={id} className="flex items-center justify-between gap-2"><span className="text-sm">{employee ? `${employee.firstName} ${employee.lastName}` : "Crew member"}</span><Select disabled={isLead} value={isLead ? "lead_mover" : (draft.crewRoles[id] || "mover")} onValueChange={(value) => setDraft((current) => ({ ...current, crewRoles: { ...current.crewRoles, [id]: value as "lead_mover" | "mover" | "helper" } }))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lead_mover">Lead Mover</SelectItem><SelectItem value="mover">Mover</SelectItem><SelectItem value="helper">Helper</SelectItem></SelectContent></Select></div>; })}</div><p className="mt-1 text-xs text-muted-foreground">Per-job classifications override the employee default and feed the payout ledger.</p></div>}
          </section>

          <section className="space-y-4 border-t pt-5">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /><h3 className="font-semibold">Quote</h3></div>
            {quotePreviewFailed && quotePricingSource === "rate_card_auto" ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm font-semibold text-red-300">The quote could not be recalculated.</p>
                <p className="mt-1 text-xs text-muted-foreground">Job setup will wait so crew, hours, and price cannot be saved out of sync.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => retryQuotePreview()}>Retry quote</Button>
              </div>
            ) : quoteDraft ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3" data-testid="job-setup-quote-summary">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-sm font-semibold text-emerald-300">
                      {quotePricingSource === "manual_override" ? "Saved manual quote" : quoteIsUpdating ? "Updating automatic quote..." : quoteDirty ? "Automatic quote ready to save" : "Saved automatic quote"}
                      <Popover><PopoverTrigger asChild><button type="button" aria-label="Explain active quote"><CircleHelp className="h-3.5 w-3.5" /></button></PopoverTrigger><PopoverContent className="w-64 text-xs">This is the one active job price. The server rate card calculates it from the crew, hours, equipment, access, and promo fields above.</PopoverContent></Popover>
                    </p>
                    <p className="text-xs text-muted-foreground">{quotePricingSource === "manual_override" ? "This previously saved override remains active until you replace it with the current rate card." : `${draft.crewSize} ${draft.crewSize === 1 ? "mover" : "movers"} · ${draft.confirmedHours} ${draft.confirmedHours === 1 ? "hour" : "hours"} · updates from the setup fields above`}</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-300">${quoteTotal.toFixed(2)}</p>
                </div>

                {quotePricingSource === "manual_override" ? (
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setQuotePricingSource("rate_card_auto")}>Replace with current rate-card quote</Button>
                ) : autoQuotePreview ? (
                  <>
                    {autoQuotePreview.promo && !autoQuotePreview.promo.applied && <p className="mt-2 text-xs text-amber-300">{autoQuotePreview.promo.reason}</p>}
                    {autoQuotePreview.promotion?.kind === "fixed_moving_package" && <p className="mt-2 text-xs font-medium text-emerald-200">{autoQuotePreview.promotion.code}: {autoQuotePreview.promotion.requiredCrewSize} movers x {autoQuotePreview.promotion.requiredHours} hours local special. JC truck and trailer are reserved.</p>}
                    {autoQuotePreview.promotion?.kind === "percentage_discount" && <p className="mt-2 text-xs font-medium text-emerald-200">{autoQuotePreview.promotion.code}: {autoQuotePreview.promotion.discountPercent}% off the automatic quote.</p>}
                    <p className="mt-2 text-xs text-muted-foreground">Labor ${autoQuotePreview.labor.toFixed(2)} · Truck ${autoQuotePreview.truck.toFixed(2)} · Trailer ${autoQuotePreview.trailer.toFixed(2)} · Access ${(autoQuotePreview.stairs + autoQuotePreview.elevator).toFixed(2)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-300">Projected from the $${autoQuotePreview.rewardEligibleTotal.toFixed(2)} reward-eligible rate: {autoQuotePreview.projectedCustomerJcMoves.toLocaleString()} customer JCMOVES and {autoQuotePreview.projectedCrewPoolJcMoves.toLocaleString()} crew-pool JCMOVES.<Popover><PopoverTrigger asChild><button type="button" aria-label="Explain JCMOVES projection"><CircleHelp className="h-3 w-3" /></button></PopoverTrigger><PopoverContent className="w-64 text-xs">The customer and total crew pool each use this amount after full payment and completion. The lead receives a 15% crew-pool bonus; the rest splits evenly.</PopoverContent></Popover></p>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">Calculating the quote from the job setup...</div>
            )}
          </section>
        </> : <p className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">An owner or admin can add crew, scheduling, and pricing. Your edits to customer and job details will still save here.</p>}

        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-xl border border-blue-500/30 bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => { setDraft(setupDraftFromLead(lead)); setQuoteDraft(savedQuote(lead)); setQuoteDirty(false); setQuotePricingSource(lead.quoteSnapshot?.manualQuoteOverride ? "manual_override" : "rate_card_auto"); }} disabled={saveMutation.isPending}>Reset</Button>
          <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || quoteIsUpdating || quoteCannotSave} className="bg-blue-600 hover:bg-blue-700" data-testid="button-save-job-setup">{saveMutation.isPending || quoteIsUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{quoteIsUpdating ? "Updating Quote" : "Save Job Setup"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
