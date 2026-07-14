import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Megaphone, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InviteInfo = {
  recipientName: string;
  rep: null | { displayName: string; brandName: string; slug: string; promoCode: string };
  discordInviteUrl: string;
  siteUrl: string;
  tutorialUrl: string;
};

export default function MarketingOnboardingPage() {
  const [location] = useLocation();
  const token = useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : location.split("?")[1] || "";
    return new URLSearchParams(search).get("invite") || "";
  }, [location]);
  const invite = useQuery<InviteInfo>({ queryKey: [`/api/marketing-execution/invite/${token}`], enabled: Boolean(token) });

  useEffect(() => {
    document.title = "JC ON THE MOVE Marketing Launch";
  }, []);

  if (!token) return <OnboardingMessage title="Marketing invite not found" detail="Ask the crew lead to send you a fresh JC ON THE MOVE marketing invite." />;
  if (invite.isLoading) return <OnboardingMessage title="Loading your launch" detail="Getting your crew marketing invitation ready…" />;
  if (!invite.data) return <OnboardingMessage title="Marketing invite unavailable" detail="This invite may have expired or been replaced. Ask your crew lead for a new link." />;

  const data = invite.data;
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/35 bg-amber-300/10 text-amber-200"><Megaphone className="h-6 w-6" /></div><p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-amber-300">JC ON THE MOVE</p><h1 className="mt-2 text-3xl font-black">Welcome to the marketing launch</h1><p className="mt-3 text-slate-300">{data.recipientName}, help turn useful local posts into booked work for the family.</p></div>
        <Card className="border-emerald-400/25 bg-emerald-500/10"><CardContent className="space-y-4 p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-black">Your simple first move</p><p className="mt-1 text-sm text-slate-300">Open the in-app tutorial, confirm your promo code, build one tracked route-day post, share it responsibly, and log your follow-up.</p></div></div>{data.rep && <div className="rounded-lg border border-white/10 bg-slate-950/40 p-3"><p className="text-xs font-black uppercase tracking-widest text-emerald-200">Your marketing profile</p><p className="mt-1 text-lg font-black">{data.rep.brandName}</p><p className="mt-1 text-sm text-slate-300">Promo code: <span className="font-mono text-amber-200">{data.rep.promoCode}</span></p><Link href={`/network/${data.rep.slug}`}><Button size="sm" variant="outline" className="mt-3 border-emerald-300/35">View rep page</Button></Link></div>}</CardContent></Card>
        <div className="grid gap-3 sm:grid-cols-2"><a href={data.discordInviteUrl} target="_blank" rel="noreferrer"><Button className="h-12 w-full bg-indigo-500 hover:bg-indigo-400"><Users className="mr-2 h-4 w-4" />Join crew Discord</Button></a><Link href="/crew/tutorials"><Button variant="outline" className="h-12 w-full border-amber-300/35 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"><ExternalLink className="mr-2 h-4 w-4" />Open marketing tutorial</Button></Link></div>
      </div>
    </main>
  );
}

function OnboardingMessage({ title, detail }: { title: string; detail: string }) {
  return <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-center text-white"><div className="max-w-md"><Megaphone className="mx-auto h-8 w-8 text-amber-300" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-2 text-slate-400">{detail}</p><Link href="/"><Button className="mt-5">JC ON THE MOVE home</Button></Link></div></main>;
}
