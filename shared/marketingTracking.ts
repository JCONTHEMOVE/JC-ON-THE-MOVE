export const MARKETING_ATTRIBUTION_PARAM_KEYS = [
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
  "service",
  "area",
  "routeDay",
  "routeKey",
  "fbclid",
] as const;

export type MarketingAttributionParam = typeof MARKETING_ATTRIBUTION_PARAM_KEYS[number];

type QueryValue = string | string[] | undefined | null | unknown;

function firstSafeQueryValue(value: QueryValue): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim().slice(0, 500) : "";
}

export function buildMarketingRepQrDestination(input: {
  appUrl: string;
  slug: string;
  query?: Record<string, QueryValue>;
}): string {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    throw new Error("Invalid marketing representative slug");
  }

  const appOrigin = new URL(input.appUrl).origin;
  const destination = new URL(`/network/${encodeURIComponent(slug)}`, appOrigin);

  for (const key of MARKETING_ATTRIBUTION_PARAM_KEYS) {
    const value = firstSafeQueryValue(input.query?.[key]);
    if (value) destination.searchParams.set(key, value);
  }

  // Generic profile QRs still receive useful attribution. Campaign-specific
  // callers keep their supplied UTM and jc_campaign values.
  if (!destination.searchParams.has("utm_source")) destination.searchParams.set("utm_source", "qr_code");
  if (!destination.searchParams.has("utm_medium")) destination.searchParams.set("utm_medium", "offline");
  if (!destination.searchParams.has("utm_campaign")) destination.searchParams.set("utm_campaign", `crew-profile-${slug}`);

  return destination.toString();
}
