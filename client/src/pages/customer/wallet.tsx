import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, Lock, ArrowRight, Zap, Gift, ShoppingBag, History, DollarSign, Plus, ShieldCheck, Wallet, Copy, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WalletChoiceModal } from "@/components/WalletChoiceModal";

interface WalletData {
  balance: string;
  stakedAmount: string;
  pendingRewards: string;
  totalEarned: string;
  tokenBalance?: string;
  cashBalance?: string;
}

interface RewardHistory {
  id: string;
  rewardType: string;
  tokenAmount: string;
  status: string;
  earnedDate: string;
}

interface WalletPreference {
  walletMode: "personal" | "company" | null;
  personalWalletAddress: string | null;
  companyWalletAddress: string | null;
  hasWalletConfigured: boolean;
}

export default function CustomerWalletPage() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const { data: wallet, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/wallet/balance"],
  });

  const { data: walletPreference } = useQuery<WalletPreference>({
    queryKey: ["/api/user/wallet-preference"],
  });

  const { data: historyData } = useQuery<RewardHistory[]>({
    queryKey: ["/api/rewards/history"],
  });

  const balance = parseFloat(wallet?.tokenBalance ?? wallet?.balance ?? "0");
  const cashBalance = parseFloat(wallet?.cashBalance ?? "0");
  const staked = parseFloat(wallet?.stakedAmount ?? "0");
  const pending = parseFloat(wallet?.pendingRewards ?? "0");
  const history: RewardHistory[] = Array.isArray(historyData) ? historyData.slice(0, 10) : [];
  const receiveMode = walletPreference?.walletMode === "personal"
    ? "Phantom wallet"
    : walletPreference?.hasWalletConfigured
      ? "Company rewards account"
      : "Not set up yet";
  const receiveDetail = walletPreference?.walletMode === "personal" && walletPreference.personalWalletAddress
    ? `${walletPreference.personalWalletAddress.slice(0, 6)}...${walletPreference.personalWalletAddress.slice(-6)}`
    : walletPreference?.hasWalletConfigured
      ? "Internal JCMOVES tracking is active"
      : "Choose how you want to receive rewards";

  const copyWalletAddress = async () => {
    if (!walletPreference?.personalWalletAddress) return;
    await navigator.clipboard.writeText(walletPreference.personalWalletAddress);
    setCopiedAddress(true);
    toast({ title: "Wallet address copied", description: "Your Phantom address is ready to share." });
    setTimeout(() => setCopiedAddress(false), 1600);
  };

  // Reconcile prepaid top-up on Square redirect (?prepaid=success&intent=...)
  const reconcile = useMutation({
    mutationFn: async (intentId: number) => {
      const r = await apiRequest("POST", "/api/jcmoves-usd/prepaid-reconcile", { intentId });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      if (data?.success) {
        const bonusTokens = parseFloat(String(data?.bonusTokens ?? "0"));
        toast({
          title: "Credit added",
          description: Number.isFinite(bonusTokens) && bonusTokens > 0
            ? `Your JCMOVES USD balance is updated, plus ${bonusTokens.toLocaleString()} JCMOVES bonus tokens.`
            : "Your JCMOVES USD balance has been updated.",
        });
      } else if (data?.pending) {
        toast({ title: "Payment pending", description: "We'll credit your wallet as soon as Square confirms." });
      }
    },
  });

  const cryptoReconcile = useMutation({
    mutationFn: async (intentId: number) => {
      const r = await apiRequest("POST", "/api/crypto/prepaid-reconcile", { intentId });
      return r.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      if (data?.success) {
        const bonusTokens = parseFloat(String(data?.bonusTokens ?? "0"));
        toast({
          title: "JCMOVES USD added",
          description: Number.isFinite(bonusTokens) && bonusTokens > 0
            ? `Your service credit is updated, plus ${bonusTokens.toLocaleString()} JCMOVES bonus tokens.`
            : "Your service credit balance has been updated.",
        });
      } else if (data?.pending) {
        toast({ title: "Crypto payment pending", description: "We'll credit your wallet as soon as BitPay confirms." });
      }
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prepaid") === "success") {
      const intentId = parseInt(params.get("intent") ?? "0", 10);
      if (intentId) reconcile.mutate(intentId);
      // Clean the URL so we don't re-trigger
      window.history.replaceState({}, "", "/wallet");
    } else if (params.get("crypto") === "success") {
      const intentId = parseInt(params.get("intent") ?? "0", 10);
      if (intentId) cryptoReconcile.mutate(intentId);
      window.history.replaceState({}, "", "/wallet");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold">Your Wallet</h1>
          <p className="text-sm text-muted-foreground">JCMOVES USD credit & JCMOVES tokens</p>
        </div>

        {/* Receive / Earn / Redeem hub */}
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setWalletChoiceOpen(true)}
            className="flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/10 p-4 text-left transition-all hover:border-primary/50"
            data-testid="button-jcmoves-receive"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/15 p-2">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-black">Receive JCMOVES</p>
                <p className="text-xs text-muted-foreground">{receiveMode} - {receiveDetail}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {walletPreference?.personalWalletAddress && (
            <button
              type="button"
              onClick={copyWalletAddress}
              className="flex items-center justify-center gap-2 rounded-xl border border-muted bg-muted/30 px-3 py-2 text-xs font-semibold"
              data-testid="button-copy-jcmoves-address"
            >
              {copiedAddress ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedAddress ? "Copied" : "Copy receive address"}
            </button>
          )}
        </div>

        {/* Dual-currency Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* JCMOVES USD — service credit */}
          <Card className="bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/30">
            <CardContent className="pt-6 pb-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <DollarSign className="h-6 w-6 text-emerald-500" />
                <span className="text-sm text-muted-foreground font-medium">JCMOVES USD</span>
              </div>
              {isLoading ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded mx-auto my-2" />
              ) : (
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400" data-testid="text-cash-balance">
                  ${cashBalance.toFixed(2)}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Service credit · $1 = $1 off</p>
              <Link href="/wallet/add-credit">
                <button
                  className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg py-2 transition-colors"
                  data-testid="button-add-credit"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Credit
                </button>
              </Link>
            </CardContent>
          </Card>

          {/* JCMOVES — engagement token */}
          <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
            <CardContent className="pt-6 pb-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Coins className="h-6 w-6 text-primary" />
                <span className="text-sm text-muted-foreground font-medium">JCMOVES</span>
              </div>
              {isLoading ? (
                <div className="h-10 w-32 bg-muted animate-pulse rounded mx-auto my-2" />
              ) : (
                <p className="text-3xl font-black text-primary" data-testid="text-token-balance">
                  {balance.toLocaleString()}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Engagement tokens · earn & redeem</p>
              <Link href="/earn">
                <button className="mt-3 w-full inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg py-2 transition-colors">
                  <Zap className="h-3.5 w-3.5" /> Earn More
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Lock className="h-4 w-4" />
                <span className="text-xs">Staked</span>
              </div>
              <p className="text-xl font-bold">{staked.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">JCMOVES</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs">Pending</span>
              </div>
              <p className="text-xl font-bold">{pending.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">JCMOVES</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Quick Actions</p>

          <Link href="/staking">
            <button className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-muted hover:border-primary/40 transition-all bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Lock className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Stake Tokens</p>
                  <p className="text-xs text-muted-foreground">Earn yield on your JCMOVES</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>

          <Link href="/earn">
            <button className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-muted hover:border-primary/40 transition-all bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Earn More Tokens</p>
                  <p className="text-xs text-muted-foreground">Mining, faucet & daily bonuses</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>

          <Link href="/rewards">
            <button className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-muted hover:border-primary/40 transition-all bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <Gift className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Redeem Rewards</p>
                  <p className="text-xs text-muted-foreground">Use tokens for discounts & perks</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>

          <Link href="/marketplace">
            <button className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-muted hover:border-primary/40 transition-all bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-xl">
                  <ShoppingBag className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">Marketplace</p>
                  <p className="text-xs text-muted-foreground">Shop with your JCMOVES</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </Link>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions yet. Earn tokens by booking jobs or mining daily.</p>
            ) : (
              <div className="space-y-2">
                {history.map(h => {
                  const amount = parseFloat(h.tokenAmount ?? "0");
                  const isPositive = amount >= 0;
                  const date = h.earnedDate ? new Date(h.earnedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                  return (
                    <div key={h.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium capitalize">{h.rewardType?.replace(/_/g, " ") ?? "Reward"}</p>
                        <p className="text-xs text-muted-foreground">{date} · {h.status}</p>
                      </div>
                      <span className={`text-sm font-bold ${isPositive ? "text-green-600" : "text-red-500"}`}>
                        {isPositive ? "+" : ""}{amount.toLocaleString()} JCMOVES
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* How to earn */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> How to Earn JCMOVES
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {[
              { label: "Book a job", tokens: "+50", sub: "Per booking" },
              { label: "Job completed", tokens: "$1 = 15", sub: "Based on total cost" },
              { label: "Daily mining", tokens: "+100", sub: "Every 24 hours" },
              { label: "Referral bonus", tokens: "+500", sub: "Per new customer" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <span className="text-sm">{item.label}</span>
                <div className="text-right">
                  <Badge variant="secondary" className="text-xs">{item.tokens}</Badge>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Compliance disclosure */}
        <Card className="bg-muted/20 border-muted">
          <CardContent className="pt-4 pb-4 text-xs text-muted-foreground space-y-2">
            <p className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                <strong>JCMOVES USD</strong> is a service credit (not money or an investment). It can only be used to
                pay JC ON THE MOVE LLC invoices and cannot be withdrawn for cash or transferred to other users.
              </span>
            </p>
            <p>
              <strong>JCMOVES tokens</strong> are an engagement reward that may be applied as a discount on services
              up to your loyalty tier's coverage cap. Tokens have no cash value, do not earn yield, and cannot be
              traded peer-to-peer.
            </p>
          </CardContent>
        </Card>
      </div>
      <WalletChoiceModal
        open={walletChoiceOpen}
        onClose={() => setWalletChoiceOpen(false)}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/user/wallet-preference"] });
          queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
          queryClient.invalidateQueries({ queryKey: ["/api/rewards/wallet"] });
        }}
      />
    </div>
  );
}
