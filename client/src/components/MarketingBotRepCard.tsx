import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Link2,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type MetaConnection = {
  status: string;
  pageId: string;
  pageName: string;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
  authorizedForPilot?: boolean;
};

type RepCampaign = {
  id: string;
  campaignCode: string;
  headline: string;
  service: string;
  territory: string;
  campaignRevision: number;
  approvedAt: string;
  imageUrl?: string | null;
  safety?: { passed?: boolean; checks?: Array<{ key: string; ok: boolean; label: string }> };
  variantId: string;
  variantCode: string;
  caption: string;
  repRevision: number;
  destinationUrl: string;
  promoCode?: string | null;
  metrics: { views: number; bookingClicks: number; callClicks: number; messageClicks: number };
  publication: null | {
    id: string;
    status: string;
    attempts: number;
    externalId?: string | null;
    externalUrl?: string | null;
    errorMessage?: string | null;
    publishedAt?: string | null;
  };
};

type RepDashboard = {
  rep: { id: string; slug: string; displayName: string; promoCode?: string | null };
  meta: {
    configured: boolean;
    setupState: "owner_setup_required" | "oauth_required" | "page_selection_required" | "ready" | "reauthorization_required" | "authorized_page_mismatch";
    missing: string[];
    configurationErrors: string[];
    authorizedPageId?: string | null;
    authorizedPageName?: string | null;
    redirectUri?: string | null;
    requiredScopes: string[];
    instagramEnabled: false;
    otherRepresentativesEnabled: false;
    connection: MetaConnection | null;
    canChoosePage: boolean;
  };
  campaigns: RepCampaign[];
};

type MetaPage = { id: string; name: string };

const serviceLabels: Record<string, string> = {
  moving: "Moving",
  packing: "Packing",
  junk_removal: "Junk removal",
  helping_hands: "Helping hands",
  heavy_item: "Heavy items",
  lawn_seasonal: "Lawn / seasonal",
  last_minute: "Last-minute availability",
  reputation: "Community reputation",
};

const territoryLabels: Record<string, string> = {
  ironwood_hurley: "Ironwood / Hurley",
  houghton: "Houghton",
  eagle_river: "Eagle River",
  iron_river: "Iron River",
  mercer_minocqua: "Mercer / Minocqua",
  up_northwoods: "UP / Northwoods",
};

function statusClass(status: string) {
  if (status === "published" || status === "connected") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
  if (status === "failed" || status === "reauth_required") return "border-amber-500/30 bg-amber-500/15 text-amber-200";
  return "border-blue-500/30 bg-blue-500/15 text-blue-200";
}

function RepCampaignCard({ campaign, connected }: { campaign: RepCampaign; connected: boolean }) {
  const { toast } = useToast();
  const [caption, setCaption] = useState(campaign.caption);

  useEffect(() => setCaption(campaign.caption), [campaign.variantId, campaign.repRevision, campaign.caption]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/crew/marketing-bot/dashboard"] });
  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/crew/marketing-bot/variants/${campaign.variantId}`, { caption });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: "Your Facebook copy was saved", description: "Verified JC facts and your tracked link were preserved." });
    },
    onError: (error: Error) => toast({ title: "Copy was not saved", description: error.message, variant: "destructive" }),
  });
  const publish = useMutation({
    mutationFn: async (retry: boolean) => {
      const response = await apiRequest("POST", `/api/crew/marketing-bot/variants/${campaign.variantId}/publish`, { retry });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: "Facebook post recorded", description: "The Meta post ID and public link are now saved." });
    },
    onError: (error: Error) => toast({ title: "Facebook post failed", description: error.message, variant: "destructive" }),
  });
  const dirty = caption.trim() !== campaign.caption.trim();
  const publication = campaign.publication;
  const busy = save.isPending || publish.isPending;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/55">
      {campaign.imageUrl && <img src={campaign.imageUrl} alt={campaign.headline} className="aspect-[16/9] w-full object-cover" />}
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Owner approved · revision {campaign.campaignRevision}</p>
            <h3 className="mt-1 text-lg font-black text-white">{campaign.headline}</h3>
            <p className="mt-1 text-xs text-slate-400">{serviceLabels[campaign.service] || campaign.service} · {territoryLabels[campaign.territory] || campaign.territory}</p>
          </div>
          <Badge className={statusClass(publication?.status || "ready")}>{publication?.status?.replaceAll("_", " ") || "ready"}</Badge>
        </div>

        <div className="mt-4">
          <label className="text-xs font-bold text-slate-300" htmlFor={`caption-${campaign.variantId}`}>Your Facebook Page caption</label>
          <Textarea
            id={`caption-${campaign.variantId}`}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={1800}
            className="mt-2 min-h-44 border-slate-700 bg-slate-900 text-white"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>JC facts, disclosure, promo, and tracked URL are enforced by the server.</span><span>{caption.length}/1800</span></div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-center">
          <div><p className="font-black text-white">{campaign.metrics.views}</p><p className="text-[9px] uppercase text-slate-500">Views</p></div>
          <div><p className="font-black text-white">{campaign.metrics.bookingClicks}</p><p className="text-[9px] uppercase text-slate-500">Book</p></div>
          <div><p className="font-black text-white">{campaign.metrics.callClicks}</p><p className="text-[9px] uppercase text-slate-500">Calls</p></div>
          <div><p className="font-black text-white">{campaign.metrics.messageClicks}</p><p className="text-[9px] uppercase text-slate-500">Messages</p></div>
        </div>

        {publication?.errorMessage && <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">{publication.errorMessage}</p>}
        {publication?.externalUrl && <a href={publication.externalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-300 hover:text-blue-200">Open recorded Facebook post <ExternalLink className="h-3.5 w-3.5" /></a>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="border-slate-700" disabled={!dirty || busy} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save my copy
          </Button>
          {publication?.status === "failed" ? (
            <Button className="bg-amber-600 hover:bg-amber-500" disabled={!connected || dirty || busy} onClick={() => publish.mutate(true)}>
              {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Retry post
            </Button>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-500" disabled={!connected || dirty || busy || publication?.status === "published" || publication?.status === "publishing"} onClick={() => publish.mutate(false)}>
              {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publish to my Page
            </Button>
          )}
        </div>
        {dirty && <p className="mt-2 text-xs text-amber-200">Save your changes before publishing.</p>}
        {!connected && <p className="mt-2 text-xs text-slate-400">Connect and verify your Facebook Page to publish this approved campaign.</p>}
      </div>
    </article>
  );
}

export function MarketingBotRepCard() {
  const { toast } = useToast();
  const dashboardQuery = useQuery<RepDashboard>({
    queryKey: ["/api/crew/marketing-bot/dashboard"],
    retry: false,
    refetchInterval: 30_000,
  });
  const dashboard = dashboardQuery.data;
  const pagesQuery = useQuery<{ pages: MetaPage[] }>({
    queryKey: ["/api/crew/marketing-bot/meta/pages"],
    enabled: Boolean(dashboard?.meta.canChoosePage),
    retry: false,
  });

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("meta_error");
    if (message) toast({ title: "Facebook connection not completed", description: message, variant: "destructive" });
  }, [toast]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/crew/marketing-bot/dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/crew/marketing-bot/meta/pages"] });
  };
  const connect = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/crew/marketing-bot/meta/connect");
      return response.json();
    },
    onSuccess: (data) => window.location.assign(data.authorizationUrl),
    onError: (error: Error) => toast({ title: "Facebook connection unavailable", description: error.message, variant: "destructive" }),
  });
  const selectPage = useMutation({
    mutationFn: async (pageId: string) => {
      const response = await apiRequest("POST", "/api/crew/marketing-bot/meta/select-page", { pageId });
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: "Facebook Page connected" });
    },
    onError: (error: Error) => toast({ title: "Page was not connected", description: error.message, variant: "destructive" }),
  });
  const connectionAction = useMutation({
    mutationFn: async (action: "verify" | "disconnect") => {
      const response = await apiRequest(action === "verify" ? "POST" : "DELETE", action === "verify" ? "/api/crew/marketing-bot/meta/verify" : "/api/crew/marketing-bot/meta/connection");
      return response.json();
    },
    onSuccess: async (_, action) => {
      await refresh();
      toast({ title: action === "verify" ? "Facebook Page verified" : "Facebook Page disconnected" });
    },
    onError: (error: Error) => toast({ title: "Connection action failed", description: error.message, variant: "destructive" }),
  });

  if (dashboardQuery.isLoading) {
    return <section className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5"><Loader2 className="h-5 w-5 animate-spin text-blue-300" /></section>;
  }
  if (!dashboard) return null;

  const connection = dashboard.meta.connection;
  const connected = connection?.status === "connected" && connection.authorizedForPilot === true;
  const setupCopy = {
    owner_setup_required: "Owner setup required",
    oauth_required: "Ready for Matt to authorize",
    page_selection_required: "Choose the authorized Page",
    ready: "Ready to publish approved Northwoods campaigns",
    reauthorization_required: "Facebook authorization expired",
    authorized_page_mismatch: "Connected Page does not match the pilot Page",
  }[dashboard.meta.setupState];
  const authorizedPageLabel = dashboard.meta.authorizedPageName
    ? `${dashboard.meta.authorizedPageName} (${dashboard.meta.authorizedPageId})`
    : dashboard.meta.authorizedPageId || "not configured";

  return (
    <section className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-300">Marketing Bot · {dashboard.rep.displayName}</p>
          <h2 className="mt-1 text-xl font-black text-white">Your owner-approved Facebook campaigns</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">Edit only your tracked version, then publish it to the Facebook Page you manage. Nothing posts automatically.</p>
        </div>
        <ShieldCheck className="h-6 w-6 shrink-0 text-blue-300" />
      </div>

      <div className={`mt-4 rounded-xl border p-4 ${connected ? "border-emerald-500/25 bg-emerald-500/10" : "border-amber-500/25 bg-amber-500/10"}`}>
        <div className="flex items-start gap-3">
          {connected ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />}
          <div>
            <p className="font-black text-white">{setupCopy}</p>
            <p className="mt-1 text-xs text-slate-300">Authorized target: {authorizedPageLabel}</p>
            <p className="mt-1 text-xs text-slate-400">Facebook Page only · Northwoods campaigns only · Instagram disabled · every representative except Matt disabled.</p>
          </div>
        </div>
        {dashboard.meta.setupState === "owner_setup_required" && (
          <div className="mt-3 border-t border-amber-500/20 pt-3 text-xs text-amber-100">
            <p>The owner must finish these server settings before OAuth can start:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...dashboard.meta.missing, ...dashboard.meta.configurationErrors].map((item) => <code key={item} className="rounded bg-slate-950/70 px-2 py-1">{item}</code>)}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-600"><Facebook className="h-5 w-5 text-white" /></div>
            <div>
              <p className="font-black text-white">{connection?.pageName || "Facebook Page not connected"}</p>
              <p className="text-xs text-slate-400">{setupCopy}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!connected && !dashboard.meta.canChoosePage && <Button size="sm" className="bg-blue-600 hover:bg-blue-500" disabled={!dashboard.meta.configured || connect.isPending} onClick={() => connect.mutate()}>{connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}{dashboard.meta.setupState === "reauthorization_required" || dashboard.meta.setupState === "authorized_page_mismatch" ? "Reconnect Page" : "Authorize with Facebook"}</Button>}
            {connected && <Button size="sm" variant="outline" className="border-slate-700" disabled={connectionAction.isPending} onClick={() => connectionAction.mutate("verify")}><RefreshCw className="mr-2 h-4 w-4" />Verify</Button>}
            {connection && connection.status !== "disconnected" && <Button size="sm" variant="outline" className="border-red-500/30 text-red-200" disabled={connectionAction.isPending} onClick={() => connectionAction.mutate("disconnect")}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button>}
          </div>
        </div>
        {connected && <p className="mt-3 flex items-center gap-2 text-xs text-emerald-200"><LockKeyhole className="h-4 w-4" />The Page token is encrypted, never shown, and accepted only for Page {dashboard.meta.authorizedPageId}.</p>}
        {connection?.lastError && <p className="mt-3 text-xs text-amber-200">{connection.lastError}</p>}
      </div>

      {dashboard.meta.canChoosePage && (
        <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/10 p-4">
          <p className="font-black text-white">Confirm the one authorized Page</p>
          <p className="mt-1 text-xs text-blue-100">Only {authorizedPageLabel} is returned here; every other managed Page is filtered out by the server.</p>
          <div className="mt-3 grid gap-2">
            {pagesQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-300" />}
            {(pagesQuery.data?.pages || []).map((page) => <Button key={page.id} variant="outline" className="justify-start border-slate-700 bg-slate-950/40" disabled={selectPage.isPending} onClick={() => selectPage.mutate(page.id)}><Facebook className="mr-2 h-4 w-4 text-blue-300" />{page.name}</Button>)}
            {pagesQuery.data?.pages.length === 0 && <p className="text-xs text-amber-200">Meta did not return a Page with publishing access for this account.</p>}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {dashboard.campaigns.map((campaign) => <RepCampaignCard key={`${campaign.variantId}:${campaign.campaignRevision}`} campaign={campaign} connected={connected} />)}
        {dashboard.campaigns.length === 0 && <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No owner-approved campaign is ready for Matt yet.</div>}
      </div>
    </section>
  );
}
