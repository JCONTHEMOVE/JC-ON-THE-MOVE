import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Check, Clock, Loader2, AlertCircle, Bitcoin, Percent, Shield, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { BtcAutoConfirmStatus } from "@/components/btc-auto-confirm-status";

interface BtcPaymentData {
  id: string;
  btcAddress: string;
  btcAmount: number;
  usdAmount: number;
  originalUsdAmount: number;
  btcPrice: number;
  discountPercent: number;
  expiresAt: string;
  referenceType?: string;
  notes?: string;
  customerName?: string;
  status?: string;
}

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  job_payment: "Job Payment",
  jcmoves_purchase: "JCMOVES Token Purchase",
  shop_purchase: "Shop Item",
  jewelry: "Jewelry Purchase",
  sponsorship: "Sponsorship",
  general: "Payment",
};

export default function BitcoinPaymentPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get("id");

  interface BtcPaymentRow {
    id: string;
    btcAddress: string;
    btcAmount: string;
    usdAmount: string;
    originalUsdAmount: string;
    btcPrice: string;
    expiresAt?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    customerName?: string | null;
    status: string;
  }

  const { data: payment, isLoading, error } = useQuery<BtcPaymentRow>({
    queryKey: ["/api/btc/payment", paymentId],
    queryFn: async () => {
      if (!paymentId) throw new Error("No payment ID");
      const res = await fetch(`/api/btc/payment/${paymentId}`);
      if (!res.ok) throw new Error("Payment not found");
      return res.json();
    },
    enabled: !!paymentId,
    // Poll fast while we're still pending so the customer sees the
    // "Detected on blockchain — finalizing your hold…" → "auto-confirmed"
    // transition without refreshing. Slow once finalized.
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return 8000;
      return data.status === "pending" ? 8000 : 60_000;
    },
  });

  // When a *jewelry* BTC payment flips to verified, hand off to the
  // shared payment-success surface so the customer lands on the same
  // jewelry receipt + auto-confirm badge that card buyers see. We only
  // redirect for jewelry because /payment-success default copy is
  // jewelry-oriented; non-jewelry BTC payments stay on this page where
  // the verified card already shows the auto-confirm badge.
  useEffect(() => {
    if (payment?.status !== "verified") return;
    if (payment.referenceType !== "jewelry" || !payment.referenceId) return;
    const qs = new URLSearchParams();
    qs.set("btcPaymentId", payment.id);
    qs.set("itemId", payment.referenceId);
    const target = `/payment-success?${qs.toString()}`;
    if (window.location.pathname + window.location.search === target) return;
    const t = setTimeout(() => navigate(target), 1500);
    return () => clearTimeout(t);
  }, [payment?.status, payment?.id, payment?.referenceType, payment?.referenceId, navigate]);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    const expiresAt = payment.expiresAt;
    const timer = setInterval(() => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;
      if (diff <= 0) {
        setTimeLeft("Expired");
        clearInterval(timer);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [payment?.expiresAt]);

  const copyToClipboard = async (text: string, type: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast({ title: `${type === "address" ? "Address" : "Amount"} copied!` });
      setTimeout(() => setCopied(null), 3000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const btcUri = payment ? `bitcoin:${payment.btcAddress}?amount=${payment.btcAmount}` : "";

  if (!paymentId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-600">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invalid Payment</h2>
            <p className="text-slate-400">No payment ID provided.</p>
            <Link href="/">
              <Button className="mt-4">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-600">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Payment Not Found</h2>
            <Link href="/">
              <Button className="mt-4">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (payment.status === "verified") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800 border-emerald-500/50">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Payment Verified!</h2>
            <p className="text-slate-400">Your Bitcoin payment has been confirmed. Thank you!</p>
            <BtcAutoConfirmStatus paymentId={payment.id} variant="dark" className="text-left" />
            <Link href="/">
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Button variant="ghost" className="text-white hover:bg-white/10 mb-4" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 px-4 py-2 rounded-full text-sm font-medium mb-3">
            <Bitcoin className="h-4 w-4" />
            Legacy manual BTC
          </div>
          <h1 className="text-2xl font-bold text-white">Manual Bitcoin Payment</h1>
          <p className="mt-2 text-xs text-slate-400">
            For multi-crypto service-credit packs, use Wallet Add Credit with BitPay checkout.
          </p>
          {(payment?.referenceType || payment?.notes) && (
            <div className="mt-3 inline-block px-4 py-2 bg-slate-700/60 border border-slate-600/50 rounded-xl">
              <p className="text-sm text-slate-300">
                <span className="text-slate-400">For: </span>
                <span className="font-semibold text-white">
                  {payment.notes || REFERENCE_TYPE_LABELS[payment.referenceType || ""] || payment.referenceType}
                </span>
              </p>
              {payment.customerName && (
                <p className="text-xs text-slate-400 mt-0.5">Customer: {payment.customerName}</p>
              )}
            </div>
          )}
        </div>

        <Card className="bg-emerald-900/30 border-emerald-500/30 mb-4">
          <CardContent className="py-3 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-300 font-medium">
              <Percent className="h-4 w-4" />
              <span>10% Bitcoin Discount Applied!</span>
            </div>
            <p className="text-emerald-400/70 text-xs mt-1">
              ${parseFloat(payment.originalUsdAmount).toFixed(2)} → ${parseFloat(payment.usdAmount).toFixed(2)} (Save ${(parseFloat(payment.originalUsdAmount) - parseFloat(payment.usdAmount)).toFixed(2)})
            </p>
          </CardContent>
        </Card>

        {timeLeft && timeLeft !== "Expired" && (
          <Card className="bg-yellow-900/30 border-yellow-500/30 mb-4">
            <CardContent className="py-3">
              <div className="flex items-center justify-center gap-2 text-yellow-300 text-sm">
                <Clock className="h-4 w-4" />
                <span>Price locked for: <strong>{timeLeft}</strong></span>
              </div>
            </CardContent>
          </Card>
        )}

        {timeLeft === "Expired" && (
          <Card className="bg-red-900/30 border-red-500/30 mb-4">
            <CardContent className="py-3 text-center">
              <p className="text-red-300 text-sm">Price quote expired. Please create a new payment.</p>
            </CardContent>
          </Card>
        )}

        <div className="mb-4">
          <BtcAutoConfirmStatus paymentId={payment.id} variant="dark" />
        </div>

        <Card className="bg-slate-800/80 border-orange-500/30 mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-orange-300 flex items-center gap-2">
              <Bitcoin className="h-5 w-5" />
              Send Exactly
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900/60 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-orange-400 font-mono tracking-wider">
                {parseFloat(payment.btcAmount).toFixed(8)}
              </p>
              <p className="text-slate-400 text-sm mt-1">BTC</p>
              <p className="text-slate-500 text-xs mt-1">≈ ${parseFloat(payment.usdAmount).toFixed(2)} USD</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 border-orange-500/50 text-orange-300 hover:bg-orange-900/30"
                onClick={() => copyToClipboard(parseFloat(payment.btcAmount).toFixed(8), "amount")}
              >
                {copied === "amount" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied === "amount" ? "Copied!" : "Copy Amount"}
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-400 font-medium">To this Bitcoin address:</p>
              <div className="bg-slate-900/60 rounded-xl p-4">
                <p className="text-xs text-orange-300 font-mono break-all text-center leading-relaxed">
                  {payment.btcAddress}
                </p>
                <div className="flex gap-2 mt-3 justify-center">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-500/50 text-orange-300 hover:bg-orange-900/30"
                    onClick={() => copyToClipboard(payment.btcAddress, "address")}
                  >
                    {copied === "address" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied === "address" ? "Copied!" : "Copy Address"}
                  </Button>
                  <a href={btcUri}>
                    <Button
                      size="sm"
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open Wallet
                    </Button>
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>BTC Price</span>
                <span>${parseFloat(payment.btcPrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400 mb-1">
                <span>Original Price</span>
                <span className="line-through">${parseFloat(payment.originalUsdAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-400 font-medium">
                <span>You Pay (10% off)</span>
                <span>${parseFloat(payment.usdAmount).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-500/30 mb-4">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-200 space-y-1">
                <p className="font-semibold text-blue-100">How It Works</p>
                <p>1. Copy the BTC amount and address above</p>
                <p>2. Send the exact amount from your Bitcoin wallet</p>
                <p>3. Our team or auto-verifier will verify your payment on the blockchain</p>
                <p>4. You'll receive a confirmation email once verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-900/20 border-orange-500/30 mb-4">
          <CardContent className="py-3">
            <p className="text-orange-200 text-xs text-center font-medium">
              Bitcoin payments are non-refundable. Unused payments can be applied as credit toward future moves for up to 1 year from the payment date.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-4">
          Payment ID: {payment.id?.slice(0, 8)}... | Questions? Call (906) 285-9312
        </p>
      </div>
    </div>
  );
}
