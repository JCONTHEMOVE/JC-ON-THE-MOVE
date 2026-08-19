import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowRight,
  CalendarClock,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Gift,
  Leaf,
  Mail,
  MessageCircle,
  Coins,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Snowflake,
  Trash2,
  Truck,
} from "lucide-react";
import Header from "@/components/header";
import Footer from "@/components/footer";

const SITE_URL = "https://www.jconthemove.com";
const GIFT_CARD_IMAGE = "/gift-cards/jc-helping-hand-egift.png";
const GOLD_GIFT_CARD_IMAGE = "/gift-cards/jc-gold-helping-hand-5000.png";
const PHONE_HREF = "tel:+19062859312";
const SMS_HREF = "sms:+19062859312";

function normalizeHttpsUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const SQUARE_EGIFT_URL = normalizeHttpsUrl(import.meta.env.VITE_SQUARE_EGIFT_URL);
const FEATURED_AMOUNTS = [50, 100, 250, 500, 1_000];

type GiftCardBonusConfig = {
  enabled: boolean;
  tokensPerDollar: number;
  holdDays: number;
  redeemRate: number;
  tiers: Array<{
    amountUsd: number;
    bonusTokens: number;
    currentServiceCreditUsd: number;
    gold: boolean;
  }>;
};

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  const created = !element;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("content");
  element.setAttribute("content", content);
  return () => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute("content");
    else element?.setAttribute("content", previous);
  };
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const created = !element;
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  const previous = element.getAttribute("href");
  element.setAttribute("href", href);
  return () => {
    if (created) element?.remove();
    else if (previous === null) element?.removeAttribute("href");
    else element?.setAttribute("href", previous);
  };
}

const SERVICES = [
  { title: "Moving help", detail: "Packing, loading, unloading, and heavy-item help", icon: Truck },
  { title: "Junk removal", detail: "Hauling, cleanouts, and getting unwanted items gone", icon: Trash2 },
  { title: "Seasonal lawn care", detail: "Practical outdoor help when the yard needs attention", icon: Leaf },
  { title: "Snow removal", detail: "Prepaid help for Northwoods winter cleanup", icon: Snowflake },
];

const STEPS = [
  {
    title: "Choose and personalize",
    detail: "Pick an amount in Square, add your message, and send it now or on a future date.",
    icon: CalendarCheck,
  },
  {
    title: "They receive the gift",
    detail: "Square securely emails the recipient their eGift card and redemption details.",
    icon: Mail,
  },
  {
    title: "Apply it to service",
    detail: "They book with JC ON THE MOVE and apply the card toward their Square invoice.",
    icon: ReceiptText,
  },
];

const GOLD_PERKS = [
  {
    title: "Priority planning",
    detail: "Priority estimate review and a single JC contact to help coordinate the work.",
    icon: ClipboardCheck,
  },
  {
    title: "Concierge service plan",
    detail: "A complimentary planning call and a practical plan for using the balance across eligible services.",
    icon: Sparkles,
  },
  {
    title: "Scheduling assistance",
    detail: "Priority scheduling assistance, always subject to crew availability, weather, and the service area.",
    icon: CalendarClock,
  },
];

function PurchaseCallToAction({ compact = false, label = "Send a Gift Card" }: { compact?: boolean; label?: string }) {
  if (SQUARE_EGIFT_URL) {
    return (
      <div className={compact ? "space-y-2" : "space-y-3"}>
        <a
          href={SQUARE_EGIFT_URL}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-base font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
          data-testid="gift-card-square-checkout"
        >
          {label} <ArrowRight className="h-5 w-5" />
        </a>
        <p className="flex items-center justify-center gap-2 text-xs text-slate-400 sm:justify-start">
          <ShieldCheck className="h-4 w-4 text-emerald-300" /> Secure checkout and eGift delivery by Square
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </p>
        <p className="text-xs text-slate-500">
          Terms and conditions apply to gift cards and gift certificates. <Link href="/terms" className="font-bold text-blue-200 hover:text-blue-100">Review terms</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4" data-testid="gift-card-contact-fallback">
      <p className="font-black text-amber-100">Online gift checkout is being connected.</p>
      <p className="mt-1 text-sm text-slate-300">Call or text us and we will help you purchase a Square eGift card.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a href={PHONE_HREF} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-black text-slate-950 hover:bg-amber-300">
          Call (906) 285-9312
        </a>
        <a href={SMS_HREF} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10">
          <MessageCircle className="h-4 w-4" /> Text “GIFT”
        </a>
      </div>
      <p className="mt-3 text-xs text-slate-500">Terms and conditions apply to gift cards and gift certificates. <Link href="/terms" className="font-bold text-blue-200">Review terms</Link></p>
    </div>
  );
}

function GoldBundleCallToAction() {
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
      <p className="font-black text-amber-100">We personally coordinate the $5,000 Gold Bundle.</p>
      <p className="mt-1 text-sm text-slate-300">Square limits each individual gift card to $2,000, so JC arranges the Gold package as multiple Square eGift cards under one service plan.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a href={PHONE_HREF} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-400 px-5 text-sm font-black text-slate-950 hover:bg-amber-300">Call (906) 285-9312</a>
        <a href={SMS_HREF} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10"><MessageCircle className="h-4 w-4" /> Text “GOLD”</a>
      </div>
      <p className="mt-3 text-xs text-slate-500">All gift-card sales are final. Terms and conditions apply to gift cards and gift certificates. <Link href="/terms" className="font-bold text-amber-100">Review terms</Link></p>
    </div>
  );
}

export default function GiftCardsPage() {
  const { data: bonusConfig } = useQuery<GiftCardBonusConfig>({
    queryKey: ["/api/public/gift-card-bonus-config"],
  });
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Service Gift Cards | JC ON THE MOVE";
    const canonical = `${SITE_URL}/gift-cards`;
    const image = `${SITE_URL}${GIFT_CARD_IMAGE}`;
    const description = "Bless someone with prepaid JC ON THE MOVE help for moving, junk removal, lawn care, snow removal, or a $5,000 Gold Helping Hand concierge bundle.";
    const cleanups = [
      setMeta("name", "description", description),
      setMeta("property", "og:type", "website"),
      setMeta("property", "og:url", canonical),
      setMeta("property", "og:title", "Give the Gift of a Helping Hand | JC ON THE MOVE"),
      setMeta("property", "og:description", description),
      setMeta("property", "og:image", image),
      setMeta("name", "twitter:card", "summary_large_image"),
      setMeta("name", "twitter:title", "Give the Gift of a Helping Hand | JC ON THE MOVE"),
      setMeta("name", "twitter:description", description),
      setMeta("name", "twitter:image", image),
      setCanonical(canonical),
    ];
    return () => {
      document.title = previousTitle;
      cleanups.reverse().forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#020915] text-white">
      <Header />
      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.20),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.22),transparent_38%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1fr_0.95fr] md:items-center md:py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                <Gift className="h-4 w-4" /> Bless someone with service
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
                Give the gift of a <span className="text-amber-300">helping hand.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
                Send practical prepaid help for a move, a cleanout, summer yard work, winter snow, or another eligible JC ON THE MOVE service.
              </p>
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Suggested gift card amounts">
                {FEATURED_AMOUNTS.map((amount) => (
                  <span key={amount} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-black text-white">
                    ${amount.toLocaleString("en-US")}
                  </span>
                ))}
                <a href="#gold-card" className="rounded-full border border-amber-300/40 bg-amber-300/15 px-4 py-2 text-sm font-black text-amber-100 transition hover:bg-amber-300/25">
                  $5,000 Gold Bundle
                </a>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                Square shows $50, $100, $250, and $500 as quick choices. Enter $1,000 as a custom amount; contact JC for the multi-card $5,000 Gold Bundle.
              </p>
              <div className="mt-7">
                <PurchaseCallToAction />
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-amber-400/20 to-blue-500/10 blur-2xl" />
              <img
                src={GIFT_CARD_IMAGE}
                alt="JC ON THE MOVE Give the Gift of a Helping Hand eGift card design"
                className="relative aspect-[8/5] w-full rounded-2xl border border-white/15 object-cover shadow-2xl"
                width={640}
                height={400}
              />
            </div>
          </div>
        </section>

        <section className="px-4 py-12 md:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-blue-300">Help that meets a real need</p>
            <h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-black tracking-tight md:text-4xl">One gift card. Many ways to lighten the load.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map(({ title, detail, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {bonusConfig?.enabled && (
          <section className="border-y border-emerald-300/20 bg-emerald-950/20 px-4 py-12 md:py-16" data-testid="gift-card-bonus-section">
            <div className="mx-auto max-w-6xl">
              <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                    <Coins className="h-4 w-4" /> Purchase bonus
                  </p>
                  <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Buy a helping hand. Earn bonus JCMOVES.</h2>
                  <p className="mt-3 leading-relaxed text-slate-300">
                    Every eligible new Square eGift-card purchase of $50 or more earns {bonusConfig.tokensPerDollar} bonus JCMOVES per dollar. The purchaser chooses whether the bonus belongs to them or the gift recipient.
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-slate-400">
                    Bonuses become spendable after a {bonusConfig.holdDays}-day hold. Reloads and discounted gift-card purchases do not qualify. When the card later pays for service, that gift-funded portion does not also earn the normal customer per-dollar reward; service-completion bonuses still apply.
                  </p>
                  <Link href="/gift-cards/bonus" className="mt-5 inline-flex items-center gap-2 font-black text-emerald-200 hover:text-emerald-100">
                    Claim or check a bonus <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/65">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-white/[0.06] text-left text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Gift value</th>
                          <th className="px-4 py-3">Bonus JCMOVES</th>
                          <th className="px-4 py-3">Current service-credit value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bonusConfig.tiers.map((tier) => (
                          <tr key={tier.amountUsd} className={tier.gold ? "border-t border-amber-300/25 bg-amber-300/10" : "border-t border-white/10"}>
                            <td className={tier.gold ? "px-4 py-3 font-black text-amber-200" : "px-4 py-3 font-black text-white"}>
                              ${tier.amountUsd.toLocaleString("en-US")}{tier.gold ? " Gold" : ""}
                            </td>
                            <td className="px-4 py-3 font-mono font-black text-emerald-200">{tier.bonusTokens.toLocaleString("en-US")}</td>
                            <td className="px-4 py-3 text-slate-300">${tier.currentServiceCreditUsd.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed text-slate-500">
                    Current redemption rate: {bonusConfig.redeemRate.toLocaleString("en-US")} JCMOVES = $1 in eligible JC service credit. Redemption rules and rates can change prospectively; the gift-card balance itself remains managed by Square.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="gold-card" className="border-y border-amber-300/20 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.18),transparent_34%),linear-gradient(135deg,#02050a,#111827_55%,#140d02)] px-4 py-12 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-amber-400/20 blur-2xl" />
              <img
                src={GOLD_GIFT_CARD_IMAGE}
                alt="$5,000 JC ON THE MOVE Gold Helping Hand concierge bundle design"
                className="relative aspect-[8/5] w-full rounded-2xl border border-amber-300/35 object-cover shadow-2xl shadow-amber-500/10"
                width={640}
                height={400}
              />
            </div>

            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                <Sparkles className="h-4 w-4" /> $5,000 Gold Helping Hand Bundle
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">Big help, personally coordinated.</h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">
                The Gold Bundle is built for a major move, estate cleanout, recurring property help, or a family that may need several JC services over time.
              </p>
              <div className="mt-6 grid gap-3">
                {GOLD_PERKS.map(({ title, detail, icon: Icon }) => (
                  <article key={title} className="flex gap-3 rounded-xl border border-amber-200/15 bg-white/[0.05] p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-300/15 text-amber-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-amber-50">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{detail}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-relaxed text-slate-300">
                Square caps one gift card at $2,000. JC coordinates the $5,000 Gold package as multiple eGift cards purchased together; the combined Square balance remains fully usable while the Gold perks add personal service coordination.
              </div>
              <div className="mt-6">
                <GoldBundleCallToAction />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Priority assistance does not guarantee a particular date. Normal quotes, service minimums, weather, availability, and service-area rules apply.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white px-4 py-12 text-slate-950 md:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-blue-700">How it works</p>
            <h2 className="mt-3 text-center text-3xl font-black tracking-tight md:text-4xl">Square makes sending and using it simple.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ title, detail, icon: Icon }, index) => (
                <article key={title} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <span className="absolute right-5 top-4 text-4xl font-black text-slate-200" aria-hidden="true">{index + 1}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-12 md:py-16">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Good to know</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">The value stays available until it is used.</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "No expiration or inactivity fees",
                  "Remaining balance carries forward",
                  "Usable toward eligible JC services",
                  "Recipient can combine it with another payment method",
                ].map((item) => (
                  <p key={item} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> {item}
                  </p>
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-slate-500">
                All gift-card sales are final and nonrefundable. No cash back or cash refunds except where required by law. If JC approves an adjustment for service paid with a gift card, it is returned to the Square gift card or issued as Square store credit where supported. Normal estimates, service minimums, scheduling, availability, and service-area rules still apply. Terms and conditions apply to gift cards and gift certificates.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-300/10 to-blue-500/10 p-6 md:p-8">
              <Gift className="h-9 w-9 text-amber-300" />
              <h2 className="mt-4 text-3xl font-black">Ready to bless someone?</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">Choose the amount and delivery date in Square, then add the message you want them to receive.</p>
              <div className="mt-6">
                <PurchaseCallToAction compact />
              </div>
              <Link href="/services" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-200 hover:text-blue-100">
                See eligible services <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
