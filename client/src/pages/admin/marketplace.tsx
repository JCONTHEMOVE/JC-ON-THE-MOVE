import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminRewardShopPage from "@/pages/admin-reward-shop";
import AdminLotteryPage from "@/pages/admin-lottery";
import RewardsMarketplacePage from "@/pages/rewards-marketplace";
import MarketplaceZonePricingPage from "@/pages/admin/marketplace-zone-pricing";
import AuthorityTasksCard from "@/components/AuthorityTasksCard";
import MarketplaceActionMatrix from "@/components/MarketplaceActionMatrix";
import MarketplaceCoverageAudit from "@/components/MarketplaceCoverageAudit";
import MarketplaceFocusRouter from "@/components/MarketplaceFocusRouter";
import MarketplaceNextStepFlow from "@/components/MarketplaceNextStepFlow";
import MarketplaceSmartBookingEngine from "@/components/MarketplaceSmartBookingEngine";
import MarketplaceSourceReadinessBoard from "@/components/MarketplaceSourceReadinessBoard";
import MarketplaceSourceLookup from "@/components/MarketplaceSourceLookup";
import MarketplaceTaskSplit from "@/components/MarketplaceTaskSplit";
import { useQuery } from "@tanstack/react-query";
import { HeartHandshake, ShieldCheck, UsersRound, WalletCards } from "lucide-react";

const flowCards = [
  ["1", "Start", "Capture every request as a lead card."],
  ["2", "Progress", "Quote, approve, assign, and invoice."],
  ["3", "Finish", "Complete, pay, reward, review, and rebook."],
] as const;

type MomStats = {
  tokenBalance: number;
  totalEarned: number;
  totalHearts: number;
  totalDonated: number;
  recentDonors: Array<{
    display_name: string | null;
    jcmoves_amount: string | number;
    message: string | null;
    created_at: string;
  }>;
};

type GenerosityStats = {
  balance: number;
  totalCollected: number;
  totalDonated: number;
};

type Nominee = {
  id: number;
  name: string;
  description: string | null;
  wallet_user_id: string;
  is_active: boolean;
  added_by: string | null;
  created_at: string;
};

function formatTokens(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString(undefined, { maximumFractionDigits: amount >= 1000 ? 0 : 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof HeartHandshake;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-500/10">
          <Icon className="h-5 w-5 text-amber-200" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function GenerosityFundPanel() {
  const { data: momStats, isLoading: momLoading } = useQuery<MomStats>({
    queryKey: ["/api/mom/stats"],
  });
  const { data: fundStats, isLoading: fundLoading } = useQuery<GenerosityStats>({
    queryKey: ["/api/generosity-fund"],
  });
  const { data: nominees = [], isLoading: nomineesLoading } = useQuery<Nominee[]>({
    queryKey: ["/api/nominees"],
  });

  const loading = momLoading || fundLoading || nomineesLoading;
  const activeNominees = nominees.filter((nominee) => nominee.is_active);
  const recentDonors = momStats?.recentDonors ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-amber-200" />
              <h2 className="text-lg font-black text-white">Generosity Fund</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Keep Mom's fund, nominee pools, and JCMOVES giveback visible without mixing them into worker payout,
              customer discounts, or company profit.
            </p>
          </div>
          <span className="rounded-full border border-amber-400/30 bg-slate-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100">
            earn / give / verify
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Mom Wallet"
          value={`${formatTokens(momStats?.tokenBalance)} JCMOVES`}
          detail="Dedicated Nicolasa Jackson generosity wallet."
          icon={HeartHandshake}
        />
        <MetricCard
          label="Mom Hearts"
          value={formatTokens(momStats?.totalHearts)}
          detail={`${formatTokens(momStats?.totalDonated)} JCMOVES sent as direct love.`}
          icon={WalletCards}
        />
        <MetricCard
          label="Platform Fund"
          value={`${formatTokens(fundStats?.balance)} JCMOVES`}
          detail={`${formatTokens(fundStats?.totalCollected)} collected through verified wallet events.`}
          icon={ShieldCheck}
        />
        <MetricCard
          label="Nominees"
          value={formatTokens(activeNominees.length)}
          detail="Active giveback recipients connected to the marketplace."
          icon={UsersRound}
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Recent Mom Hearts</h3>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading generosity activity...</p>
            ) : recentDonors.length > 0 ? (
              recentDonors.map((donor, index) => (
                <div key={`${donor.created_at}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-white">{donor.display_name || "Someone special"}</p>
                    <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-100">
                      {formatTokens(donor.jcmoves_amount)} JCMOVES
                    </span>
                  </div>
                  {donor.message && <p className="mt-2 text-sm leading-5 text-slate-300">{donor.message}</p>}
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {formatDate(donor.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No heart activity yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-300">Active Nominees</h3>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="text-sm text-slate-400">Loading nominees...</p>
            ) : activeNominees.length > 0 ? (
              activeNominees.map((nominee) => (
                <div key={nominee.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-white">{nominee.name}</p>
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                      active
                    </span>
                  </div>
                  {nominee.description && <p className="mt-2 text-sm leading-5 text-slate-300">{nominee.description}</p>}
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Added {formatDate(nominee.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No active nominees configured.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminMarketplacePage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Marketplace</h1>
            <p className="text-slate-400 text-sm">Start requests, price zones, assign work, and close rewards from one simple hub.</p>
          </div>
          <a
            href="/admin/marketplace-playbook"
            className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-blue-500/30 bg-blue-600/15 px-4 text-sm font-bold text-blue-200 hover:bg-blue-600/25"
          >
            Open playbook
          </a>
        </div>
        <Tabs defaultValue="flow">
          <TabsList className="mb-6 grid w-full grid-cols-2 border border-slate-700/50 bg-slate-800/50 md:grid-cols-7">
            <TabsTrigger value="flow" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Flow</TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Tasks</TabsTrigger>
            <TabsTrigger value="sources" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Sources</TabsTrigger>
            <TabsTrigger value="zones" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Zones</TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Rewards</TabsTrigger>
            <TabsTrigger value="giveback" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Giveback</TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="flow" className="space-y-5">
            <section className="grid gap-3 md:grid-cols-3">
              {flowCards.map(([number, title, detail]) => (
                <div key={number} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                    {number}
                  </div>
                  <h2 className="mt-3 text-sm font-black text-white">{title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">{detail}</p>
                </div>
              ))}
            </section>
            <MarketplaceFocusRouter />
            <AuthorityTasksCard />
            <MarketplaceNextStepFlow compact />
            <MarketplaceTaskSplit compact />
            <MarketplaceActionMatrix compact rail="all" limit={9} />
            <MarketplaceSmartBookingEngine />
          </TabsContent>
          <TabsContent value="tasks" className="space-y-5">
            <MarketplaceSourceReadinessBoard />
            <AuthorityTasksCard />
            <MarketplaceTaskSplit compact />
          </TabsContent>
          <TabsContent value="sources" className="space-y-5">
            <MarketplaceSourceLookup />
            <MarketplaceCoverageAudit />
          </TabsContent>
          <TabsContent value="zones">
            <MarketplaceZonePricingPage />
          </TabsContent>
          <TabsContent value="rewards" className="space-y-8">
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Catalog</h2>
              <AdminRewardShopPage />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">Lottery</h2>
              <AdminLotteryPage />
            </section>
          </TabsContent>
          <TabsContent value="giveback">
            <GenerosityFundPanel />
          </TabsContent>
          <TabsContent value="preview">
            <RewardsMarketplacePage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
