import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Box, CheckCircle2, ExternalLink, PackageCheck, Piano, ShieldCheck, Truck, Users } from "lucide-react";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Market = {
  slug: string;
  city: string;
  stateCode: string;
  postalCode: string;
  providerId: string;
  services: string[];
  bookingUrls: Record<string, string>;
  bookingDisclosure: string;
};

const details: Record<string, { label: string; description: string; icon: typeof Truck }> = {
  loading: { label: "Loading help", description: "A crew to load your rental truck, trailer, or storage unit.", icon: Truck },
  unloading: { label: "Unloading help", description: "Careful unloading and placement at your destination.", icon: Users },
  u_box: { label: "U-Box services", description: "U-Box delivery, loading, unloading, or combined service.", icon: Box },
  packing: { label: "Packing help", description: "Hands-on help packing or unpacking your household.", icon: PackageCheck },
  piano: { label: "Piano moving", description: "Specialty help for a piano move.", icon: Piano },
  safe: { label: "Safe moving", description: "Experienced help with safes and other heavy items.", icon: ShieldCheck },
};

export default function UhaulMarketPage() {
  const params = useParams<{ slug: string }>();
  const search = new URLSearchParams(window.location.search);
  const variant = search.get("variant") || "";
  const preferredFocus = search.get("focus") || "";
  const query = useQuery<{ market: Market }>({
    queryKey: [`/api/public/northwoods/markets/${encodeURIComponent(params.slug)}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`],
  });
  const market = query.data?.market;

  const bookingLink = (focus: string) => `/api/public/northwoods/redirect/${encodeURIComponent(params.slug)}/${encodeURIComponent(focus)}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`;

  if (query.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Loading Northwoods Moving…</div>;
  if (!market) return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-center text-slate-200">This Northwoods Moving market page is not available.</div>;

  const ordered = [...market.services].sort((a, b) => Number(b === preferredFocus) - Number(a === preferredFocus));

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#174431_0%,#07130e_42%,#020806_100%)] text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div><p className="text-lg font-black tracking-tight">NORTHWOODS MOVING</p><p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">and Junk Removing</p></div>
        <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100">Moving Help provider</Badge>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-100"><CheckCircle2 className="h-4 w-4" />Professional moving labor</div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Moving help around {market.city}, {market.stateCode}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Choose the help you need, then view live pricing and reserve Northwoods Moving directly through the Moving Help marketplace.</p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Choose crew size</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Choose service hours</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Marketplace checkout</span></div>
        </div>
        <Card className="border-emerald-400/20 bg-white/[0.06] shadow-2xl shadow-emerald-950/50 backdrop-blur"><CardContent className="p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Book with confidence</p><h2 className="mt-2 text-2xl font-black text-white">Live details stay with Moving Help</h2><p className="mt-3 text-sm leading-6 text-slate-300">{market.bookingDisclosure} Crew size, hours, service options, availability, and marketplace terms are confirmed there.</p><Button asChild className="mt-6 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"><a href={bookingLink(preferredFocus && market.services.includes(preferredFocus) ? preferredFocus : market.services[0] || "loading")}>View live price & availability <ExternalLink className="ml-2 h-4 w-4" /></a></Button><p className="mt-3 text-center text-xs text-slate-500">Provider ID {market.providerId}</p></CardContent></Card>
      </section>

      <section className="border-y border-white/10 bg-black/20">
        <div className="mx-auto max-w-6xl px-5 py-14"><div className="mb-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Choose a service</p><h2 className="mt-2 text-3xl font-black">What do you need help with?</h2></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{ordered.map((focus) => { const item = details[focus]; if (!item) return null; const Icon = item.icon; return <a key={focus} href={bookingLink(focus)} className={`group rounded-2xl border p-5 transition hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-emerald-400/10 ${focus === preferredFocus ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-white/[0.04]"}`}><div className="flex items-start justify-between"><div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Icon className="h-6 w-6" /></div><ArrowRight className="h-5 w-5 text-slate-600 transition group-hover:translate-x-1 group-hover:text-emerald-300" /></div><h3 className="mt-5 text-lg font-black">{item.label}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>{focus === preferredFocus ? <Badge className="mt-4 bg-emerald-400 text-emerald-950">Featured for you</Badge> : null}</a>; })}</div></div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Northwoods Moving and Junk Removing</span><span>Serving the {market.city} regional market through Moving Help powered by U-Haul.</span></footer>
    </main>
  );
}
