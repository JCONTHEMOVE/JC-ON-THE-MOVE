import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Clock3, Coins, Gift, Mail, ShieldCheck, UserRound } from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { apiRequest } from "@/lib/queryClient";

type BonusClaim = {
  id: string;
  claimRole: "buyer" | "recipient";
  status: string;
  faceValueUsd: number;
  bonusTokens: number;
  currentServiceCreditUsd: number;
  goldEligible: boolean;
  eligibleAt: string | null;
  targetSelected: boolean;
  recipientInviteExpiresAt: string | null;
  creditedAt: string | null;
};

const CLAIM_SESSION_KEY = "jc_gift_card_bonus_claim";

async function responseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  try {
    const body = JSON.parse(text.replace(/^\d+:\s*/, ""));
    return body.error || body.message || text;
  } catch {
    return text;
  }
}

function initialClaimToken(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashToken = params.get("claim") || "";
  try {
    if (hashToken.length >= 32 && hashToken.length <= 256) {
      window.sessionStorage.setItem(CLAIM_SESSION_KEY, hashToken);
      return hashToken;
    }
    return window.sessionStorage.getItem(CLAIM_SESSION_KEY) || "";
  } catch {
    return hashToken;
  }
}

function claimStatusText(claim: BonusClaim): string {
  if (claim.status === "released") return "Your bonus is spendable now.";
  if (claim.status === "partially_reversed") return "A refund reduced this bonus; the remaining amount is reflected below.";
  if (claim.status === "reversed") return "This bonus was reversed after the related purchase was refunded or disputed.";
  if (claim.status === "disputed") return "This bonus is paused while Square reviews the related payment.";
  if (claim.status === "invite_pending") return "The invitation is waiting for the selected person to create or confirm their account.";
  if (claim.status === "assigned_pending") return "The owner is confirmed. The bonus is waiting for the 14-day hold to finish.";
  return "Choose who should receive this purchase bonus.";
}

export default function GiftCardBonusPage() {
  const [claimToken, setClaimToken] = useState(initialClaimToken);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Gift Card Bonus JCMOVES | JC ON THE MOVE";
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    robots.content = "noindex,nofollow";
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    return () => {
      document.title = previousTitle;
      if (created) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, [claimToken]);

  const claimQuery = useQuery<{ claim: BonusClaim }>({
    queryKey: ["gift-card-bonus-claim", claimToken],
    enabled: Boolean(claimToken),
    queryFn: async () => responseJson(await apiRequest("POST", "/api/gift-card-bonuses/resolve", { token: claimToken })),
    staleTime: 0,
  });

  const setClaim = (claim: BonusClaim) => queryClient.setQueryData(["gift-card-bonus-claim", claimToken], { claim });

  const assignMutation = useMutation({
    mutationFn: async (destination: "buyer" | "recipient") => responseJson<{ claim: BonusClaim }>(await apiRequest(
      "POST",
      "/api/gift-card-bonuses/assign",
      destination === "buyer" ? { token: claimToken, destination } : { token: claimToken, destination, recipientEmail },
    )),
    onSuccess: ({ claim }) => {
      setClaim(claim);
      setNotice(claim.status === "invite_pending" ? "Invitation sent. The recipient has 30 days to accept." : "Bonus owner confirmed.");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => responseJson<{ claim: BonusClaim }>(await apiRequest("POST", "/api/gift-card-bonuses/accept", { token: claimToken })),
    onSuccess: ({ claim }) => {
      setClaim(claim);
      setNotice("Bonus accepted. We will release it automatically when the hold finishes.");
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => responseJson<{ message: string }>(await apiRequest("POST", "/api/gift-card-bonuses/resend", { buyerEmail: resendEmail })),
    onSuccess: ({ message }) => setNotice(message),
  });

  const claim = claimQuery.data?.claim;
  const mutationError = assignMutation.error || acceptMutation.error || resendMutation.error;
  const canAssign = claim?.claimRole === "buyer" && ["awaiting_claim", "invite_pending"].includes(claim.status);
  const clearStoredClaim = () => {
    try {
      window.sessionStorage.removeItem(CLAIM_SESSION_KEY);
    } catch {}
    setClaimToken("");
    setNotice("");
  };

  return (
    <div className="min-h-screen bg-[#020915] text-white">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <Link href="/gift-cards" className="inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-blue-100">
          <ArrowLeft className="h-4 w-4" /> Gift cards
        </Link>
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_38%)] p-6 md:p-9">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
              <Coins className="h-4 w-4" /> Gift-card purchase bonus
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Choose who receives the bonus JCMOVES.</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">
              Square manages the eGift card itself. This page only assigns the separate JC rewards bonus earned by the purchase.
            </p>
          </div>

          <div className="p-6 md:p-9">
            {claimToken && claimQuery.isLoading && <p className="text-slate-300">Securely checking your bonus…</p>}
            {claimQuery.error && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-rose-100" role="alert">
                <p>{errorMessage(claimQuery.error)}</p>
                <button type="button" onClick={clearStoredClaim} className="mt-3 text-sm font-black underline underline-offset-4">
                  Request a fresh link
                </button>
              </div>
            )}

            {claim && (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Gift purchase</p>
                    <p className="mt-1 text-2xl font-black">${claim.faceValueUsd.toLocaleString("en-US")}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <p className="text-xs uppercase tracking-wider text-emerald-200/70">Bonus</p>
                    <p className="mt-1 text-2xl font-black text-emerald-200">{claim.bonusTokens.toLocaleString("en-US")}</p>
                    <p className="text-xs text-emerald-100/70">JCMOVES</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Current service value</p>
                    <p className="mt-1 text-2xl font-black">${claim.currentServiceCreditUsd.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-blue-300/20 bg-blue-300/10 p-4">
                  {claim.status === "released" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" /> : <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" />}
                  <div>
                    <p className="font-black capitalize">{claim.status.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-sm text-slate-300">{claimStatusText(claim)}</p>
                    {claim.eligibleAt && !claim.creditedAt && <p className="mt-1 text-xs text-slate-400">Scheduled release: {new Date(claim.eligibleAt).toLocaleString()}</p>}
                  </div>
                </div>

                {canAssign && (
                  <div>
                    <h2 className="text-xl font-black">Assign this bonus</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => assignMutation.mutate("buyer")}
                        disabled={assignMutation.isPending}
                        className="rounded-xl border border-blue-300/25 bg-blue-300/10 p-5 text-left transition hover:bg-blue-300/15 disabled:opacity-60"
                      >
                        <UserRound className="h-6 w-6 text-blue-200" />
                        <span className="mt-3 block font-black">Give the bonus to me</span>
                        <span className="mt-1 block text-sm text-slate-400">Uses the purchaser email from the completed Square payment.</span>
                      </button>
                      <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-5">
                        <Gift className="h-6 w-6 text-amber-200" />
                        <label htmlFor="recipient-email" className="mt-3 block font-black">Give it to the recipient</label>
                        <input
                          id="recipient-email"
                          type="email"
                          value={recipientEmail}
                          onChange={(event) => setRecipientEmail(event.target.value)}
                          placeholder="recipient@example.com"
                          className="mt-3 min-h-11 w-full rounded-lg border border-white/15 bg-slate-950 px-3 text-white outline-none focus:border-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => assignMutation.mutate("recipient")}
                          disabled={assignMutation.isPending || !recipientEmail.trim()}
                          className="mt-3 min-h-11 w-full rounded-lg bg-amber-300 px-4 font-black text-slate-950 hover:bg-amber-200 disabled:opacity-50"
                        >
                          Send recipient invitation
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {claim.claimRole === "recipient" && claim.status === "invite_pending" && (
                  <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-5">
                    <h2 className="text-xl font-black">Accept your bonus</h2>
                    <p className="mt-2 text-sm text-slate-300">Sign in or create a JC account using the exact email address that received this invitation.</p>
                    <button
                      type="button"
                      onClick={() => acceptMutation.mutate()}
                      disabled={acceptMutation.isPending}
                      className="mt-4 min-h-11 rounded-lg bg-emerald-300 px-5 font-black text-slate-950 hover:bg-emerald-200 disabled:opacity-60"
                    >
                      Accept bonus
                    </button>
                    <Link href="/login?redirect=%2Fgift-cards%2Fbonus" className="ml-4 inline-flex text-sm font-bold text-emerald-200 hover:text-emerald-100">Sign in first</Link>
                  </div>
                )}
              </div>
            )}

            {!claimToken && (
              <div className="max-w-xl">
                <Mail className="h-8 w-8 text-blue-200" />
                <h2 className="mt-3 text-2xl font-black">Need a fresh purchaser link?</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">Enter the email used at Square checkout. For privacy, the response is the same whether a matching bonus exists or not.</p>
                <label htmlFor="resend-email" className="mt-5 block text-sm font-bold">Purchaser email</label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(event) => setResendEmail(event.target.value)}
                    className="min-h-11 flex-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 text-white outline-none focus:border-blue-300"
                  />
                  <button
                    type="button"
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending || !resendEmail.trim()}
                    className="min-h-11 rounded-lg bg-blue-500 px-5 font-black text-white hover:bg-blue-400 disabled:opacity-50"
                  >
                    Email fresh link
                  </button>
                </div>
              </div>
            )}

            {(notice || mutationError) && (
              <p className={`mt-5 rounded-lg border p-3 text-sm ${mutationError ? "border-rose-400/30 bg-rose-400/10 text-rose-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"}`} role="status">
                {mutationError ? errorMessage(mutationError) : notice}
              </p>
            )}

            <p className="mt-8 flex items-start gap-2 border-t border-white/10 pt-5 text-xs leading-relaxed text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> We store only the Square order/payment references and the email needed to assign rewards. JC ON THE MOVE never stores the gift-card number or access code.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
