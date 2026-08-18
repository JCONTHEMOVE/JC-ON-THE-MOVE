import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Fuel,
  Hammer,
  Home,
  MapPin,
  Megaphone,
  PackageCheck,
  Paintbrush,
  Phone,
  Shield,
  Trash2,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/footer";
import {
  IRONWOOD_DAILY_DISCOUNT,
  IRONWOOD_DAILY_DISCOUNT_CODE,
  ROUTE_DAY_NON_DISCOUNT_DAY_MULTIPLIER,
  ROUTE_DAY_OUT_OF_TOWN_MULTIPLIER,
  ROUTE_DAY_DISCOUNT,
  ROUTE_DAY_DISCOUNT_CODE,
  ROUTE_DAY_PROMO_PACKAGES,
  ROUTE_DAY_SCHEDULE,
  ROUTE_DAY_SERVICE_TAGS,
  ROUTE_DAY_TRACKING_POINTS,
  ROUTE_DAY_TRAVEL_PRICE_NOTE,
  RouteDay,
  RouteDayPromoPackage,
  SERVICE_ADDRESS_DISCOUNT_NOTE,
  routeDayBookingHref,
  routeDayCampaignId,
  routeDayLandingHref,
  routeDayTrackingParams,
} from "@shared/routeDays";
import brandedTruckImage from "@assets/google_movers/branded-truck.jpg";

const SITE_URL = "https://jconthemove.com";
const PHONE_DISPLAY = "(906) 285-9312";
const PHONE_HREF = "tel:+19062859312";
const SMS_HREF = "sms:+19062859312";
const PRIMARY_PACKAGE = ROUTE_DAY_PROMO_PACKAGES[1];
const OUT_OF_TOWN_PERCENT = Math.round((ROUTE_DAY_OUT_OF_TOWN_MULTIPLIER - 1) * 100);
const NON_ROUTE_DAY_PERCENT = Math.round((ROUTE_DAY_NON_DISCOUNT_DAY_MULTIPLIER - 1) * 100);
const ROUTE_CAPABILITY_CODE: Record<string, string> = {
  "minocqua-monday": "MINOCQUA_MONDAY",
  "houghton-tuesday": "HOUGHTON_TUESDAY",
  "iron-river-wednesday": "IRON_RIVER_WEDNESDAY",
  "ashland-thursday": "ASHLAND_THURSDAY",
};

const ROUTE_MAP_POSITIONS: Record<string, { left: string; top: string; drive: string }> = {
  "ashland-thursday": { left: "14%", top: "47%", drive: "about 45-60 min from Ironwood" },
  "minocqua-monday": { left: "54%", top: "77%", drive: "about 90-115 min from Ironwood" },
  "houghton-tuesday": { left: "86%", top: "18%", drive: "about 105-135 min from Ironwood" },
  "iron-river-wednesday": { left: "82%", top: "70%", drive: "about 90-120 min from Ironwood" },
};

const SERVICE_ACTION_DETAILS: Record<
  string,
  {
    service: string;
    fit: string;
    ready: string;
  }
> = {
  Moving: {
    service: "moving",
    fit: "Homes, apartments, storage units, load/unload help, and single-item moves.",
    ready: "Crew size, truck need, stairs, heavy items, and photos.",
  },
  "Junk Removal": {
    service: "junk_removal",
    fit: "Cleanouts, garage piles, curbside pickup, appliance removal, and disposal runs.",
    ready: "Photos, pickup location, item count, and disposal notes.",
  },
  Handyman: {
    service: "handyman",
    fit: "Punch lists, repairs, installs, assembly, property prep, and small project labor.",
    ready: "Task list, photos, parts status, and preferred arrival window.",
  },
  "Light Demo": {
    service: "light_demo",
    fit: "Non-structural tear-out, flooring prep, shed cleanup, and debris loading.",
    ready: "Photos, material type, debris volume, and haul-away need.",
  },
  Flooring: {
    service: "flooring",
    fit: "Flooring prep, removal, labor help, material moving, and install support.",
    ready: "Room size, flooring type, material status, and demo needs.",
  },
  Painting: {
    service: "painting",
    fit: "Interior prep, touchups, small rooms, trim help, and project labor.",
    ready: "Room count, photos, paint status, prep needs, and timeline.",
  },
  Roofing: {
    service: "roofing",
    fit: "Small roof help, cleanup, material moving, tear-off support, and repair labor.",
    ready: "Roof photos, access notes, pitch/safety notes, and material status.",
  },
};

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function getPriceSpec(packageIndex: number) {
  if (packageIndex === 0) {
    return { minPrice: 425, maxPrice: 600 };
  }
  return { minPrice: 850, maxPrice: 1200 };
}

function preserveInboundAttribution(href: string) {
  if (typeof window === "undefined") return href;
  const inbound = new URLSearchParams(window.location.search);
  const url = new URL(href, window.location.origin);
  const keys = [
    "promo",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "jc_campaign",
    "jc_area",
    "jc_focus",
    "jc_route_city",
    "jc_route_state",
    "jc_route_zip",
    "jc_route_day",
    "jc_route_key",
    "jc_promo_type",
    "jc_package",
    "jc_crew_target",
    "jc_hours_target",
    "jc_price_band",
    "rep",
    "ref",
    "fbclid",
  ];

  keys.forEach((key) => {
    const value = inbound.get(key);
    if (value) url.searchParams.set(key, value);
  });

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function buildShareUrl(route: RouteDay) {
  const params = routeDayTrackingParams(route, "custom", PRIMARY_PACKAGE);
  params.set("utm_source", "facebook");
  params.set("utm_medium", "post");
  params.set("utm_campaign", `route-day-${route.key}`);
  return `${SITE_URL}${routeDayLandingHref(route)}?${params.toString()}`;
}

function buildSmsHref(route: RouteDay) {
  const body = `Hi JC ON THE MOVE, I need help in ${route.area}. I want to check ${route.label}, route-day savings, and crew availability.`;
  return `${SMS_HREF}?&body=${encodeURIComponent(body)}`;
}

function getServiceIcon(service: string) {
  const className = "h-5 w-5";
  if (service === "Moving") return <Truck className={className} />;
  if (service === "Junk Removal") return <Trash2 className={className} />;
  if (service === "Handyman") return <Wrench className={className} />;
  if (service === "Light Demo") return <Hammer className={className} />;
  if (service === "Flooring") return <Home className={className} />;
  if (service === "Painting") return <Paintbrush className={className} />;
  if (service === "Roofing") return <Shield className={className} />;
  return <CheckCircle2 className={className} />;
}

function buildStructuredData(route: RouteDay) {
  const canonical = `${SITE_URL}${routeDayLandingHref(route)}`;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${canonical}#service`,
    name: `${route.label} moving, junk removal, handyman, light demo, flooring, painting, and roofing help`,
    description: route.seoDescription,
    url: canonical,
    serviceType: ROUTE_DAY_SERVICE_TAGS,
    areaServed: [
      {
        "@type": "City",
        name: `${route.city}, ${route.state}`,
      },
      ...route.nearbyAreas.map((area) => ({
        "@type": "Place",
        name: area,
      })),
    ],
    provider: {
      "@type": "LocalBusiness",
      name: "JC ON THE MOVE",
      url: SITE_URL,
      telephone: "+19062859312",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Ironwood",
        addressRegion: "MI",
        addressCountry: "US",
      },
    },
    offers: {
      "@type": "OfferCatalog",
      name: `${route.label} route-day promo packages`,
      itemListElement: ROUTE_DAY_PROMO_PACKAGES.map((promoPackage, index) => {
        const priceSpec = getPriceSpec(index);
        return {
          "@type": "Offer",
          name: `${promoPackage.title}: ${promoPackage.crew} for ${promoPackage.hours}`,
          description: `${promoPackage.priceRange}. ${promoPackage.bestFor}`,
          priceCurrency: "USD",
          priceSpecification: {
            "@type": "PriceSpecification",
            priceCurrency: "USD",
            minPrice: priceSpec.minPrice,
            maxPrice: priceSpec.maxPrice,
          },
          areaServed: `${route.city}, ${route.state}`,
          availability: "https://schema.org/InStock",
        };
      }),
    },
  };
}

function RouteNotFound() {
  useEffect(() => {
    document.title = "Route Days | JC ON THE MOVE";
    setMeta("name", "description", "See JC ON THE MOVE route-day scheduling for Minocqua, Houghton, Iron River, Ashland, and nearby Northwoods service areas.");
    setCanonical(`${SITE_URL}/route-days`);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="-ml-2 mb-8 text-slate-700 hover:text-slate-950">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>
        <p className="text-sm font-black uppercase text-emerald-700">Route Days</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
          Choose the target service area.
        </h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ROUTE_DAY_SCHEDULE.map((route) => (
            <Link
              key={route.key}
              href={routeDayLandingHref(route)}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <p className="text-sm font-black uppercase text-blue-700">{route.day}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{route.city}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{route.note}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function RouteDaysPage() {
  const [, params] = useRoute("/route-days/:slug");
  const route = ROUTE_DAY_SCHEDULE.find((candidate) => candidate.key === params?.slug);
  const capabilityQuery = useQuery<{ areas: Array<{ code: string; name: string; verificationStatus: string; autoBookEnabled: boolean; adsEnabled: boolean }> }>({
    queryKey: ["/api/service-areas/capabilities"],
    enabled: !!route,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!route) return;

    const canonical = `${SITE_URL}${routeDayLandingHref(route)}`;
    document.title = route.seoTitle;
    setMeta("name", "description", route.seoDescription);
    setMeta("name", "keywords", route.serviceKeywords.join(", "));
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:title", route.seoTitle);
    setMeta("property", "og:description", route.seoDescription);
    setMeta("property", "og:image", `${SITE_URL}/icons/icon-512x512.png`);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", route.seoTitle);
    setMeta("name", "twitter:description", route.seoDescription);
    setCanonical(canonical);

    let script = document.getElementById("route-day-structured-data") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "route-day-structured-data";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(buildStructuredData(route));
  }, [route]);

  if (!route) {
    return <RouteNotFound />;
  }

  const bookingHref = (promoPackage?: RouteDayPromoPackage | null) =>
    preserveInboundAttribution(routeDayBookingHref(route, "custom", promoPackage));
  const serviceHref = (service: string) =>
    preserveInboundAttribution(routeDayBookingHref(route, service, PRIMARY_PACKAGE));
  const shareUrl = buildShareUrl(route);
  const campaignId = routeDayCampaignId(route, PRIMARY_PACKAGE);
  const capability = capabilityQuery.data?.areas.find((area) => area.code === ROUTE_CAPABILITY_CODE[route.key]);
  const autoBookEnabled = capability?.verificationStatus === "verified" && capability.autoBookEnabled;
  const adsEnabled = capability?.adsEnabled !== false;

  const flowSteps = [
    {
      icon: <Megaphone className="h-5 w-5" />,
      title: "Advertise the route day",
      detail: `Post the ${route.label} link on Facebook, the website, Google profile posts, and crew referral pages.`,
      action: "Tracked link",
    },
    {
      icon: <PackageCheck className="h-5 w-5" />,
      title: "Customer chooses service and package",
      detail: "Moving, junk removal, handyman, light demo, flooring, painting, and roofing all start from the same route page.",
      action: "Service + package",
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" />,
      title: "Address checks the savings",
      detail: `${route.city} service addresses save 5% on ${route.day}. Ironwood service addresses can save 5% every day.`,
      action: "Auto promo check",
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: "Admin sees performance",
      detail: "Bookings carry area, day, source, package, crew target, hour target, price band, and promo code into reporting.",
      action: "Job counts",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-45"
            style={{ backgroundImage: `url(${brandedTruckImage})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/82 to-slate-900/45" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[540px] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <Link href="/">
                <Button variant="ghost" className="-ml-2 text-slate-100 hover:bg-white/10 hover:text-white">
                  <ArrowLeft className="mr-2 h-4 w-4" /> JC ON THE MOVE
                </Button>
              </Link>
              <a href={PHONE_HREF} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-black text-white hover:bg-white/15">
                <Phone className="h-4 w-4" /> {PHONE_DISPLAY}
              </a>
            </div>

            <div className="grid flex-1 items-end gap-8 pb-8 pt-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/15 px-3 py-1 text-sm font-black uppercase text-emerald-100">
                  <CalendarCheck className="h-4 w-4" /> {route.label}
                </p>
                <h1 className="mt-5 text-4xl font-black leading-[1.02] md:text-6xl">
                  {route.city} route-day help for moves, junk, handyman work, and project labor.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-100 md:text-lg">
                  Book {route.day} when your service address is in {route.city}, {route.state} and the booking flow can apply 5% route-day savings. Surrounding areas can still request availability at full price with travel pricing.
                </p>
                <div className="mt-4 max-w-2xl rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
                  Scheduled regional service dispatched from our Ironwood operation — this page does not represent a storefront in {route.city}. {autoBookEnabled ? "Verified standard jobs may book automatically." : "Requests are reviewed for route capacity before any deposit is requested."}
                  {!adsEnabled && " Advertising for this route is currently paused."}
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={bookingHref(PRIMARY_PACKAGE)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-950/30 hover:bg-blue-500"
                  >
                    {autoBookEnabled ? `Book ${route.label}` : `Request ${route.label} availability`} <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href={buildSmsHref(route)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 text-sm font-black text-white hover:bg-white/15"
                  >
                    Text job photos
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur">
                  <p className="text-sm font-black uppercase text-emerald-100">Savings</p>
                  <p className="mt-2 text-3xl font-black">5%</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100">
                    {ROUTE_DAY_DISCOUNT} {SERVICE_ADDRESS_DISCOUNT_NOTE}
                  </p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur">
                  <p className="text-sm font-black uppercase text-blue-100">Capacity</p>
                  <p className="mt-2 text-3xl font-black">2 crews</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100">
                    Up to 6 movers can be scheduled as demand builds in each route area.
                  </p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/12 p-4 backdrop-blur sm:col-span-2">
                  <p className="text-sm font-black uppercase text-amber-100">Route package target</p>
                  <p className="mt-2 text-2xl font-black">{PRIMARY_PACKAGE.crew} / {PRIMARY_PACKAGE.hours}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-100">
                    {PRIMARY_PACKAGE.priceRange} for larger moving, cleanout, light demo, flooring prep, painting prep, and multi-task route blocks.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-4">
            {flowSteps.map((step, index) => (
              <div key={step.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
                    {step.icon}
                  </span>
                  <span className="text-sm font-black text-slate-500">0{index + 1}</span>
                </div>
                <p className="mt-4 text-sm font-black uppercase text-blue-700">{step.action}</p>
                <h2 className="mt-1 text-xl font-black leading-snug">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase text-blue-700">Ironwood dispatch map</p>
                  <h2 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
                    Crews start in Ironwood, then build smarter route days.
                  </h2>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-950">
                  Ironwood: 5% every day
                </div>
              </div>

              <div className="relative mt-6 min-h-[390px] overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
                <div
                  className="absolute inset-0 opacity-70"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 34% 53%, rgba(16,185,129,0.24), transparent 18%), radial-gradient(circle at 86% 18%, rgba(59,130,246,0.18), transparent 16%), radial-gradient(circle at 54% 77%, rgba(37,99,235,0.18), transparent 18%), linear-gradient(135deg, rgba(15,23,42,1), rgba(30,41,59,0.86))",
                  }}
                  aria-hidden="true"
                />
                <div className="absolute left-[34%] top-[53%] -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <span className="absolute -inset-5 rounded-full border border-emerald-300/30" />
                    <span className="absolute -inset-10 rounded-full border border-emerald-300/15" />
                    <div className="relative rounded-lg border border-emerald-300 bg-emerald-400 px-3 py-2 text-sm font-black text-slate-950 shadow-lg">
                      <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Ironwood, MI</span>
                      <span className="block text-[11px] font-bold">Home base + daily 5%</span>
                    </div>
                  </div>
                </div>

                {ROUTE_DAY_SCHEDULE.map((mapRoute) => {
                  const position = ROUTE_MAP_POSITIONS[mapRoute.key];
                  const isCurrent = mapRoute.key === route.key;
                  return (
                    <Link
                      key={mapRoute.key}
                      href={routeDayLandingHref(mapRoute)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2 text-left text-xs shadow-lg transition ${
                        isCurrent
                          ? "border-blue-300 bg-blue-500 text-white"
                          : "border-white/20 bg-white/10 text-slate-100 backdrop-blur hover:border-blue-300 hover:bg-blue-500/80"
                      }`}
                      style={{ left: position.left, top: position.top }}
                    >
                      <span className="block font-black uppercase">{mapRoute.day}</span>
                      <span className="block text-base font-black">{mapRoute.city}</span>
                      <span className="mt-0.5 block text-[11px] opacity-85">{mapRoute.state} route promo</span>
                    </Link>
                  );
                })}

                <div className="absolute bottom-3 left-3 right-3 grid gap-2 text-xs text-slate-100 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                    <p className="font-black text-emerald-200">Promo city + promo day</p>
                    <p className="mt-1 text-slate-300">5% off with {ROUTE_DAY_DISCOUNT_CODE}.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                    <p className="font-black text-amber-200">Nearby towns</p>
                    <p className="mt-1 text-slate-300">Full price plus {OUT_OF_TOWN_PERCENT}% out-of-town travel pricing.</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
                    <p className="font-black text-orange-200">Wrong day</p>
                    <p className="mt-1 text-slate-300">{NON_ROUTE_DAY_PERCENT}% non-route-day pricing if the trip breaks the route.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-black uppercase text-emerald-700">Monday-Thursday promo board</p>
                <h2 className="mt-2 text-3xl font-black leading-tight">
                  Customers can see the best day before they book.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  This makes the offer easier to trust: exact promo-city addresses get the 5% savings on their day, Ironwood saves every day, and surrounding areas can still request full-price availability.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase text-emerald-700">Every day</p>
                      <h3 className="mt-1 text-xl font-black text-emerald-950">Ironwood, MI clients</h3>
                      <p className="mt-2 text-sm leading-relaxed text-emerald-900">
                        Use {IRONWOOD_DAILY_DISCOUNT_CODE}. Ironwood service addresses can save 5% any day crews are available.
                      </p>
                    </div>
                    <MapPin className="h-5 w-5 text-emerald-700" />
                  </div>
                </div>

                {ROUTE_DAY_SCHEDULE.map((promoRoute) => (
                  <Link
                    key={promoRoute.key}
                    href={routeDayLandingHref(promoRoute)}
                    className={`rounded-lg border p-4 transition ${
                      promoRoute.key === route.key
                        ? "border-blue-300 bg-blue-50 text-blue-950"
                        : "border-slate-200 bg-white text-slate-900 hover:border-blue-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black uppercase text-blue-700">{promoRoute.day}</p>
                        <h3 className="mt-1 text-xl font-black">{promoRoute.city}, {promoRoute.state}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                          5% off for {promoRoute.city} service addresses on {promoRoute.day}. Nearby areas can request availability at full price with travel pricing.
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-black uppercase text-emerald-700">Choose the job type</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                One route page should send every customer to the right request.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Customers do not need to guess what JC ON THE MOVE can do. Each service button starts a booking with the {route.label} campaign, {ROUTE_DAY_DISCOUNT_CODE} promo, target package, crew target, hours target, price band, and address-based pricing rules already attached.
              </p>
              <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-black text-emerald-950">Address-based savings</p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-900">
                  {route.city} service addresses save 5% on {route.day}. Nearby towns do not get the discount. {IRONWOOD_DAILY_DISCOUNT} Code: {IRONWOOD_DAILY_DISCOUNT_CODE}.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {ROUTE_DAY_SERVICE_TAGS.map((service) => {
                const detail = SERVICE_ACTION_DETAILS[service];
                return (
                  <Link
                    key={service}
                    href={serviceHref(detail.service)}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        {getServiceIcon(service)}
                      </span>
                      <div>
                        <h3 className="text-lg font-black">{route.city} {service}</h3>
                        <p className="text-sm font-bold text-blue-700">Book this service</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{detail.fit}</p>
                    <p className="mt-3 text-xs font-bold uppercase text-slate-500">Ready to quote: {detail.ready}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase text-blue-700">Route-day package choices</p>
                <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                  Price the trip around useful work blocks.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  These packages make the travel cost clear before a crew drives from Ironwood. Final pricing is still confirmed after address, photos, scope, truck needs, and schedule are reviewed.
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-black text-amber-950">Why this works</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">{ROUTE_DAY_TRAVEL_PRICE_NOTE}</p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {ROUTE_DAY_PROMO_PACKAGES.map((promoPackage) => (
                <div key={promoPackage.id} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase text-emerald-700">{promoPackage.title}</p>
                      <h3 className="mt-2 text-2xl font-black">{promoPackage.crew}</h3>
                      <p className="mt-1 text-sm font-bold text-slate-600">{promoPackage.hours}</p>
                    </div>
                    <PackageCheck className="h-6 w-6 text-blue-700" />
                  </div>
                  <p className="mt-5 text-3xl font-black text-slate-950">{promoPackage.priceRange}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{promoPackage.bestFor}</p>
                  <Link
                    href={bookingHref(promoPackage)}
                    className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-blue-700"
                  >
                    Book {promoPackage.crew} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-10 text-white sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-black uppercase text-emerald-300">Full-cycle campaign link</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                One post can become a tracked job count.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Use this route page as the public destination for ads, website posts, Google updates, crew shares, and text campaigns. The booking buttons carry the route day and package data into the request.
              </p>
              <div className="mt-5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4">
                <p className="text-sm font-black uppercase text-emerald-200">Customer code</p>
                <p className="mt-2 text-3xl font-black">{ROUTE_DAY_DISCOUNT_CODE}</p>
                <p className="mt-2 text-sm leading-relaxed text-emerald-50">
                  The code identifies the offer. The service address and requested date decide whether the 5% savings applies, whether the customer should switch to {route.day}, or whether travel pricing applies.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-black uppercase text-blue-200">Share this campaign URL</p>
              <div className="mt-3 break-all rounded-lg border border-white/10 bg-slate-900 p-3 text-sm leading-relaxed text-slate-100">
                {shareUrl}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-slate-900 p-4">
                  <p className="text-sm font-black uppercase text-slate-300">Campaign ID</p>
                  <p className="mt-2 break-all text-sm font-bold text-white">{campaignId}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900 p-4">
                  <p className="text-sm font-black uppercase text-slate-300">Default package</p>
                  <p className="mt-2 text-sm font-bold text-white">{PRIMARY_PACKAGE.crew}, {PRIMARY_PACKAGE.hours}, {PRIMARY_PACKAGE.priceRange}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900 p-4">
                  <p className="text-sm font-black uppercase text-slate-300">Route area</p>
                  <p className="mt-2 text-sm font-bold text-white">{route.area} on {route.day}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-slate-900 p-4">
                  <p className="text-sm font-black uppercase text-slate-300">Crew target</p>
                  <p className="mt-2 text-sm font-bold text-white">2 crews, up to 6 movers</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black uppercase text-blue-700">Performance reporting</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                The job record keeps the data needed to scale.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                These are not placeholder fields. They move through the booking URL, booking record, lead notes, and analytics so the route can be measured by source, town, day, package, discount, travel pricing, and revenue.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black uppercase text-slate-500">Area</p>
                  <p className="mt-1 text-lg font-black">{route.area}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black uppercase text-slate-500">Day</p>
                  <p className="mt-1 text-lg font-black">{route.day}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black uppercase text-slate-500">Promo</p>
                  <p className="mt-1 text-lg font-black">{ROUTE_DAY_DISCOUNT_CODE}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROUTE_DAY_TRACKING_POINTS.map((point) => (
                <div key={point} className="rounded-lg border border-slate-200 bg-white p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="mt-2 text-sm font-black text-slate-950">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-10 sm:px-6 md:py-14 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-sm font-black uppercase text-emerald-700">Service area plan</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Build the {route.city} route first, then fill open time wisely.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                The target is to stack work in {route.city} on {route.day}. If no local jobs are requested, the crew can accept other work. If a customer outside the promo city requests help, they can still ask and the team can confirm full-price availability with travel pricing.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {route.nearbyAreas.map((area) => (
                  <span key={area} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-bold text-slate-700">
                    {area}
                  </span>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={bookingHref(PRIMARY_PACKAGE)}>
                  <Button className="h-12 rounded-lg bg-emerald-600 px-6 text-sm font-black text-white hover:bg-emerald-500">
                    Request {route.city} help <Truck className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href={PHONE_HREF} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-black text-slate-950 hover:bg-slate-50">
                  <Phone className="h-4 w-4" /> Call {PHONE_DISPLAY}
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <MapPin className="h-6 w-6 text-emerald-700" />
                <h3 className="text-xl font-black">Other route days</h3>
              </div>
              <div className="mt-4 space-y-2">
                {ROUTE_DAY_SCHEDULE.map((otherRoute) => (
                  <Link
                    key={otherRoute.key}
                    href={routeDayLandingHref(otherRoute)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      otherRoute.key === route.key
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-900"
                    }`}
                  >
                    <span>{otherRoute.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Users className="h-5 w-5 text-blue-700" />
                <p className="mt-2 text-sm font-black text-blue-950">More route days coming</p>
                <p className="mt-1 text-sm leading-relaxed text-blue-900">
                  As job counts grow, the same ad link, promo, package, and performance flow can be copied into new cities.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
