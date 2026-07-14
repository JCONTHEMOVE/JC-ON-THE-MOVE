import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bitcoin, Coins, CreditCard, DollarSign, Gift, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PRESETS = [50, 100, 250, 500, 1000];
const MOVING_HELP_BONUS_PACKS = [
  { id: "moving_help_100_bonus", amountUsd: 100, bonusTokens: 1000, label: "Starter" },
  { id: "moving_help_250_bonus", amountUsd: 250, bonusTokens: 2500, label: "Ready" },
  { id: "moving_help_500_bonus", amountUsd: 500, bonusTokens: 5000, label: "Crew" },
  { id: "moving_help_1000_bonus", amountUsd: 1000, bonusTokens: 10000, label: "Builder" },
];

type CheckoutPayload = {
  amountUsd: number;
  packId?: string;
};

export default function WalletAddCreditPage() {
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("50");

  const squareCheckout = useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const r = await apiRequest("POST", "/api/jcmoves-usd/prepaid-checkout", payload);
      return r.json() as Promise<{ checkoutUrl: string; intentId: number; packId?: string; bonusTokens?: number }>;
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Could not start checkout", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Checkout failed", description: err?.message ?? "Try again.", variant: "destructive" });
    },
  });

  const cryptoCheckout = useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const r = await apiRequest("POST", "/api/crypto/prepaid-checkout", payload);
      return r.json() as Promise<{
        checkoutUrl: string;
        intentId: number;
        provider?: string;
        packId?: string;
        bonusTokens?: number;
      }>;
    },
    onSuccess: (data) => {
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({ title: "Could not start crypto checkout", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Crypto checkout failed",
        description: err?.message ?? "Try again.",
        variant: "destructive",
      });
    },
  });

  const parsed = parseFloat(amount);
  const validAmount = Number.isFinite(parsed) && parsed >= 5 && parsed <= 10000;
  const checkoutPending = squareCheckout.isPending || cryptoCheckout.isPending;
  const standardCheckoutPending = squareCheckout.isPending && !squareCheckout.variables?.packId;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <Link href="/wallet">
          <Button variant="ghost" size="sm" className="-ml-2" data-testid="link-back-to-wallet">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Wallet
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold">Add JCMOVES USD Credit</h1>
          <p className="text-sm text-muted-foreground">
            Pre-pay for future services. $1 of credit = $1 off any JC ON THE MOVE invoice.
          </p>
        </div>

        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Moving Help Bonus Pack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOVING_HELP_BONUS_PACKS.map((pack) => {
                const squarePackPending = squareCheckout.isPending && squareCheckout.variables?.packId === pack.id;
                const cryptoPackPending = cryptoCheckout.isPending && cryptoCheckout.variables?.packId === pack.id;
                return (
                  <div
                    key={pack.id}
                    className="rounded-lg border bg-background/85 p-3 text-left transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/10"
                    data-testid={`moving-help-bonus-pack-${pack.amountUsd}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground">{pack.label}</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        ${pack.amountUsd.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-black">
                      ${pack.amountUsd.toLocaleString()} JCMOVES USD
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary">
                      <Coins className="h-4 w-4" />
                      +{pack.bonusTokens.toLocaleString()} JCMOVES
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={checkoutPending}
                        onClick={() => squareCheckout.mutate({ amountUsd: pack.amountUsd, packId: pack.id })}
                        data-testid={`button-moving-help-bonus-pack-square-${pack.amountUsd}`}
                      >
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                        {squarePackPending ? "Starting..." : "Card"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={checkoutPending}
                        onClick={() => cryptoCheckout.mutate({ amountUsd: pack.amountUsd, packId: pack.id })}
                        data-testid={`button-moving-help-bonus-pack-crypto-${pack.amountUsd}`}
                      >
                        <Bitcoin className="mr-1.5 h-3.5 w-3.5" />
                        {cryptoPackPending ? "Starting..." : "Crypto"}
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Service credit and bonus tokens post after the processor confirms payment.
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Choose an amount
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  variant={parsed === p ? "default" : "outline"}
                  onClick={() => setAmount(String(p))}
                  data-testid={`preset-${p}`}
                >
                  ${p}
                </Button>
              ))}
            </div>

            <div>
              <Label htmlFor="custom-amount">Custom amount (USD)</Label>
              <Input
                id="custom-amount"
                type="number"
                min={5}
                max={10000}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="input-custom-amount"
              />
              <p className="text-xs text-muted-foreground mt-1">Min $5 · Max $10,000 per top-up</p>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!validAmount || checkoutPending}
              onClick={() => squareCheckout.mutate({ amountUsd: parsed })}
              data-testid="button-checkout"
            >
              {standardCheckoutPending ? "Starting checkout..." : `Pay $${validAmount ? parsed.toFixed(2) : "0.00"} with Square`}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6 text-xs text-muted-foreground space-y-2">
            <p className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                JCMOVES USD is a <strong>service credit</strong>, not money or an investment. It can only be used to pay
                JC ON THE MOVE LLC invoices and cannot be withdrawn for cash, transferred to other users, or earn yield.
              </span>
            </p>
            <p>
              Refunds for cancelled jobs are issued as JCMOVES USD credit to your wallet, not back to your card.
              Card payments are processed by Square. Crypto pack payments are processed by BitPay and credit after confirmation.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
