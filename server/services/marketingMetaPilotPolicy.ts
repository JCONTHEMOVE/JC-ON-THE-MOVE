import type { MarketingBotChannel } from "@shared/marketingBot";

export const MARKETING_META_PILOT_REP_SLUG = "matt";
export const MARKETING_META_PILOT_BRAND = "northwoods_moving";
export const MARKETING_META_PILOT_CHANNEL: MarketingBotChannel = "facebook";
export const MARKETING_META_PILOT_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
] as const;

const REQUIRED_CONFIGURATION = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_OAUTH_REDIRECT_URI",
  "META_OAUTH_TOKEN_ENCRYPTION_KEY",
  "META_GRAPH_API_VERSION",
  "MARKETING_META_PILOT_PAGE_ID",
] as const;

type PilotEnvironment = Record<string, string | undefined>;

export function getMarketingMetaPilotPolicy(env: PilotEnvironment = process.env) {
  const missing = REQUIRED_CONFIGURATION.filter((name) => !env[name]?.trim());
  const configuredSlugs = (env.MARKETING_META_PILOT_REP_SLUGS || MARKETING_META_PILOT_REP_SLUG)
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);
  const configurationErrors: string[] = [];
  if (configuredSlugs.length !== 1 || configuredSlugs[0] !== MARKETING_META_PILOT_REP_SLUG) {
    configurationErrors.push("MARKETING_META_PILOT_REP_SLUGS must be exactly matt during the pilot");
  }

  return {
    ready: missing.length === 0 && configurationErrors.length === 0,
    missing: [...missing],
    configurationErrors,
    repSlug: MARKETING_META_PILOT_REP_SLUG,
    brand: MARKETING_META_PILOT_BRAND,
    channel: MARKETING_META_PILOT_CHANNEL,
    authorizedPageId: env.MARKETING_META_PILOT_PAGE_ID?.trim() || null,
    authorizedPageName: env.MARKETING_META_PILOT_PAGE_NAME?.trim() || null,
    redirectUri: env.META_OAUTH_REDIRECT_URI?.trim() || null,
    scopes: [...MARKETING_META_PILOT_SCOPES],
    instagramEnabled: false,
    otherRepresentativesEnabled: false,
  };
}

export function isMarketingMetaPilotRep(slug: unknown) {
  return String(slug || "").trim().toLowerCase() === MARKETING_META_PILOT_REP_SLUG;
}

export function isMarketingMetaPilotCampaign(brand: unknown) {
  return String(brand || "").trim().toLowerCase() === MARKETING_META_PILOT_BRAND;
}

export function isMarketingMetaPilotPage(pageId: unknown, env: PilotEnvironment = process.env) {
  const authorizedPageId = getMarketingMetaPilotPolicy(env).authorizedPageId;
  return Boolean(authorizedPageId && String(pageId || "").trim() === authorizedPageId);
}

export function evaluateMarketingMetaPilotTarget(input: {
  repSlug: unknown;
  brand: unknown;
  channel: unknown;
  pageId: unknown;
}, env: PilotEnvironment = process.env) {
  const policy = getMarketingMetaPilotPolicy(env);
  if (!policy.ready) return { allowed: false, reason: "The Matt Facebook Page pilot is not fully configured" };
  if (!isMarketingMetaPilotRep(input.repSlug)) return { allowed: false, reason: "Only Matt is enabled for the Facebook Page pilot" };
  if (!isMarketingMetaPilotCampaign(input.brand)) return { allowed: false, reason: "The pilot can publish only Northwoods campaigns" };
  if (input.channel !== MARKETING_META_PILOT_CHANNEL) return { allowed: false, reason: "Instagram and every non-Facebook channel are disabled for the pilot" };
  if (!isMarketingMetaPilotPage(input.pageId, env)) return { allowed: false, reason: "Publishing is limited to the authorized pilot Facebook Page" };
  return { allowed: true, reason: null };
}

export function evaluateCompanyPublisherForCampaign(brand: unknown) {
  if (isMarketingMetaPilotCampaign(brand)) {
    return {
      allowed: false,
      reason: "Northwoods pilot campaigns publish only through Matt's authorized Facebook Page; company Facebook, Instagram, and Google publishing are disabled.",
    };
  }
  return { allowed: true, reason: null };
}
