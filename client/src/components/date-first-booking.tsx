import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, CheckCircle2, Clock3, Home, MapPin, ShieldCheck, Truck, Users } from "lucide-react";
import { estimateJobDuration, JOB_SCHEDULE_OPTIONS, type SizingBasis, type TruckSize } from "@shared/jcOperations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Service = "moving" | "labor" | "junk_removal";
type Capacity = { status: "open" | "limited" | "ask_jc"; availableCrew: number; message: string };

function phoneIsComplete(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits);
}

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Please try again.";
  try {
    const parsed = JSON.parse(raw.replace(/^\d+:\s*/, ""));
    return parsed.error || parsed.message || raw;
  } catch {
    return raw.replace(/^\d+:\s*/, "");
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-200"><span>{label}</span>{children}</label>;
}

export function DateFirstBooking({ onChooseCallback, onDetailedBooking }: { onChooseCallback: () => void; onDetailedBooking: () => void }) {
  const { toast } = useToast();
  const [service, setService] = useState<Service>("moving");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [workScope, setWorkScope] = useState("");
  const [sizingBasis, setSizingBasis] = useState<SizingBasis>("square_footage");
  const [squareFootage, setSquareFootage] = useState("1500");
  const [truckSize, setTruckSize] = useState<TruckSize>("15_ft");
  const [crewSize, setCrewSize] = useState<2 | 3 | 4 | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState<{ manageUrl: string; capacityStatus: string; duplicate?: boolean } | null>(null);

  const estimate = useMemo(() => estimateJobDuration({
    sizingBasis,
    squareFootage: sizingBasis === "square_footage" ? Number(squareFootage) : null,
    truckSize: sizingBasis === "truck" ? truckSize : null,
    selectedCrewSize: crewSize,
  }), [sizingBasis, squareFootage, truckSize, crewSize]);

  const selectedCrew = crewSize || estimate.recommendedCrewSize;

  async function checkCapacity() {
    if (!date || !time) {
      toast({ title: "Choose a date and time first", variant: "destructive" });
      return null;
    }
    setChecking(true);
    try {
      const response = await apiRequest("POST", "/api/scheduling/preference-capacity", {
        date,
        time,
        crewSize: selectedCrew,
        planningMinutes: Math.round(estimate.planningHours * 60),
      });
      const result = await response.json() as Capacity;
      setCapacity(result);
      return result;
    } catch (error) {
      toast({ title: "Could not check that time", description: errorMessage(error), variant: "destructive" });
      return null;
    } finally {
      setChecking(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || !phoneIsComplete(phone)) {
      toast({ title: "Add your name and complete 10-digit phone number", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/leads/quick-request", {
        requestType: "scheduled",
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || "Customer",
        email,
        phone,
        serviceCode: service,
        serviceAddress: address,
        zip,
        workScope,
        sizingBasis,
        squareFootage: sizingBasis === "square_footage" ? Number(squareFootage) : undefined,
        truckSize: sizingBasis === "truck" ? truckSize : undefined,
        selectedCrewSize: selectedCrew,
        preferredDate: date,
        preferredStartTime: time,
        notes,
        photos: [],
      });
      const result = await response.json() as { duplicate?: boolean; scheduleRequest?: { manageUrl?: string; capacityStatus?: string } };
      if (!result.scheduleRequest?.manageUrl) throw new Error("Your request was saved, but the management link could not be created. Please call JC ON THE MOVE.");
      setComplete({ manageUrl: result.scheduleRequest.manageUrl, capacityStatus: result.scheduleRequest.capacityStatus || capacity?.status || "ask_jc", duplicate: result.duplicate });
    } catch (error) {
      toast({ title: "Could not save your requested date", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (complete) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5 text-slate-100">
        <CardContent className="p-7 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h2 className="mt-4 text-2xl font-black">Your preferred date is saved</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">{complete.duplicate ? "We found your recent request and refreshed its secure management link." : "This is a tentative request, not a dispatch or confirmed booking. JC will call to confirm the details and time."}</p>
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm">
            Current capacity: <strong className="capitalize text-emerald-300">{complete.capacityStatus.replace("_", " ")}</strong>
          </div>
          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-500"><a href={complete.manageUrl}>Review or change my request</a></Button>
            <Button variant="outline" asChild><a href="tel:9062859312">Call 906-285-9312</a></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <Card className="border-blue-500/40 bg-slate-900/95 text-slate-100">
        <CardHeader>
          <div className="flex items-center gap-2"><CalendarClock className="h-6 w-6 text-blue-300" /><CardTitle>Choose your preferred moving date first</CardTitle></div>
          <CardDescription>Pick an exact hourly start. JC will call to confirm the scope, crew, price, and date before anything is dispatched.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Service"><select className="field-select" value={service} onChange={(event) => setService(event.target.value as Service)}><option value="moving">Moving</option><option value="labor">Loading / unloading labor</option><option value="junk_removal">Junk removal</option></select></Field>
            <Field label="Preferred date"><Input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => { setDate(event.target.value); setCapacity(null); }} required /></Field>
            <Field label="Preferred start"><select className="field-select" value={time} onChange={(event) => { setTime(event.target.value); setCapacity(null); }}>{JOB_SCHEDULE_OPTIONS.filter((option) => option.start).map((option) => <option key={option.start!} value={option.start!}>{option.label} Central</option>)}</select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Your name"><Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></Field>
            <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
            <Field label="Phone"><Input type="tel" autoComplete="tel" placeholder="(906) 285-9312" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Service address"><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input className="pl-9" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} required /></div></Field>
            <Field label="ZIP code"><Input inputMode="numeric" maxLength={10} value={zip} onChange={(event) => setZip(event.target.value)} required /></Field>
          </div>
          <Field label="What work do you need done?"><Textarea rows={3} placeholder="Pickup/drop-off, rooms or items, stairs, access, and anything unusually heavy" value={workScope} onChange={(event) => setWorkScope(event.target.value)} required /></Field>
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-900/95 text-slate-100">
        <CardHeader>
          <div className="flex items-center gap-2"><Home className="h-5 w-5 text-cyan-300" /><CardTitle>Plan the crew time</CardTitle></div>
          <CardDescription>Use the home size or rental-truck size so the calendar has a realistic planning window.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Estimate from"><select className="field-select" value={sizingBasis} onChange={(event) => { setSizingBasis(event.target.value as SizingBasis); setCrewSize(null); setCapacity(null); }}><option value="square_footage">Home square footage</option><option value="truck">Truck size</option></select></Field>
            {sizingBasis === "square_footage" ? <Field label="Approx. square footage"><Input type="number" min="1" max="100000" value={squareFootage} onChange={(event) => { setSquareFootage(event.target.value); setCrewSize(null); setCapacity(null); }} required /></Field> : <Field label="Truck"><select className="field-select" value={truckSize} onChange={(event) => { setTruckSize(event.target.value as TruckSize); setCrewSize(null); setCapacity(null); }}><option value="pickup_van_10">Pickup / cargo van / 10 ft</option><option value="15_ft">15 ft box truck</option><option value="20_ft">20 ft box truck</option><option value="26_ft">26 ft box truck</option></select></Field>}
            <Field label="Crew"><select className="field-select" value={selectedCrew} onChange={(event) => { setCrewSize(Number(event.target.value) as 2 | 3 | 4); setCapacity(null); }}><option value="2">2 movers</option><option value="3">3 movers</option><option value="4">4 movers</option></select></Field>
          </div>
          <div className="grid gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 sm:grid-cols-3">
            <div><p className="text-xs uppercase tracking-wide text-cyan-200/70">Recommended crew</p><p className="mt-1 font-black">{estimate.recommendedCrewSize} movers</p></div>
            <div><p className="text-xs uppercase tracking-wide text-cyan-200/70">Estimated work time</p><p className="mt-1 font-black">{estimate.minimumHours === estimate.maximumHours ? `${estimate.planningHours} hours` : `${estimate.minimumHours}–${estimate.maximumHours} hours`}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-cyan-200/70">Calendar planning</p><p className="mt-1 font-black">{estimate.planningHours} hours</p></div>
          </div>
          {estimate.manualReview && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">This size or crew combination needs JC review before confirmation.</p>}
          <Field label="Additional notes (optional)"><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/30 bg-emerald-500/[0.06] text-slate-100">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><p className="font-black">Clear minimums and local package options</p></div>
            <p className="mt-1 text-sm text-slate-300">Moving and junk-removal labor/service has a $400 floor. Eligible local jobs can use 2 movers / 3 hours or 3 movers / 2 hours for $555. Truck, equipment, disposal, hazmat, specialty items, and pass-through costs stay separate.</p>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-56">
            <Button type="button" variant="outline" onClick={checkCapacity} disabled={checking || !date}>{checking ? "Checking…" : "Check this time"}</Button>
            {capacity && <div className={`rounded-lg border px-3 py-2 text-center text-sm ${capacity.status === "open" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : capacity.status === "limited" ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-red-400/40 bg-red-400/10 text-red-100"}`}><strong className="capitalize">{capacity.status.replace("_", " ")}</strong><br /><span className="text-xs">{capacity.message}</span></div>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <p className="text-sm text-slate-400"><Clock3 className="mr-1 inline h-4 w-4" />Your preference does not block the crew calendar until staff confirms it.</p>
        <Button type="submit" size="lg" className="bg-blue-600 px-8 hover:bg-blue-500" disabled={submitting}>{submitting ? "Saving request…" : "Request this date"}</Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2 border-t border-slate-800 pt-4 text-sm">
        <Button type="button" variant="ghost" onClick={onChooseCallback}><Users className="mr-2 h-4 w-4" />Just request a callback</Button>
        <Button type="button" variant="ghost" onClick={onDetailedBooking}><Truck className="mr-2 h-4 w-4" />Build deposit-ready booking</Button>
      </div>
    </form>
  );
}
