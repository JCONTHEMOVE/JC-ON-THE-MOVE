import type { MarketingBotChannel, MarketingBotCta } from "@shared/marketingBot";

export type MarketingPublishInput = {
  channel: MarketingBotChannel;
  caption: string;
  imageUrl: string;
  campaignUrl: string;
  cta: MarketingBotCta;
};

export type MarketingPublishResult = {
  externalId: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
};

export type ChannelReadiness = {
  channel: MarketingBotChannel;
  ready: boolean;
  missing: string[];
  note: string;
};

function required(names: string[]) {
  return names.filter((name) => !process.env[name]?.trim());
}

export function getMarketingChannelReadiness(): ChannelReadiness[] {
  const facebookMissing = required(["META_GRAPH_API_VERSION", "META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"]);
  const instagramMissing = required([
    "META_GRAPH_API_VERSION",
    "META_PAGE_ACCESS_TOKEN",
    "META_INSTAGRAM_ACCOUNT_ID",
  ]);
  const googleMissing = required([
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_BUSINESS_REFRESH_TOKEN",
    "GOOGLE_BUSINESS_ACCOUNT_ID",
    "GOOGLE_BUSINESS_LOCATION_ID",
  ]);
  return [
    {
      channel: "facebook",
      ready: facebookMissing.length === 0,
      missing: facebookMissing,
      note: facebookMissing.length ? "Add an approved Page access token and Meta app configuration." : "Facebook Page publishing is configured.",
    },
    {
      channel: "instagram",
      ready: instagramMissing.length === 0,
      missing: instagramMissing,
      note: instagramMissing.length ? "Connect the professional Instagram account linked to the Facebook Page." : "Instagram professional publishing is configured.",
    },
    {
      channel: "google_business",
      ready: googleMissing.length === 0,
      missing: googleMissing,
      note: googleMissing.length ? "Complete Business Profile API approval and OAuth configuration." : "Google Business Profile publishing is configured.",
    },
  ];
}

function assertPublicMediaUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Publishing requires a publicly reachable HTTPS image URL");
  }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { detail: text.slice(0, 500) }; }
    if (!response.ok) {
      const message = body?.error?.message || body?.error_description || body?.message || body?.detail || `HTTP ${response.status}`;
      throw new Error(String(message).slice(0, 500));
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function publishFacebook(input: MarketingPublishInput): Promise<MarketingPublishResult> {
  assertPublicMediaUrl(input.imageUrl);
  const version = process.env.META_GRAPH_API_VERSION!.trim();
  const pageId = process.env.META_PAGE_ID!.trim();
  const token = process.env.META_PAGE_ACCESS_TOKEN!.trim();
  const body = new URLSearchParams({
    url: input.imageUrl,
    caption: input.caption,
    published: "true",
    access_token: token,
  });
  const result = await fetchJson(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(pageId)}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const externalId = String(result.post_id || result.id || "");
  if (!externalId) throw new Error("Meta returned no Facebook post identifier");
  return { externalId, externalUrl: `https://www.facebook.com/${externalId}` };
}

async function publishInstagram(input: MarketingPublishInput): Promise<MarketingPublishResult> {
  assertPublicMediaUrl(input.imageUrl);
  const version = process.env.META_GRAPH_API_VERSION!.trim();
  const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID!.trim();
  const token = process.env.META_PAGE_ACCESS_TOKEN!.trim();
  const createBody = new URLSearchParams({
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: token,
  });
  const container = await fetchJson(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(accountId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody,
  });
  if (!container.id) throw new Error("Meta returned no Instagram media container");
  const publishBody = new URLSearchParams({ creation_id: String(container.id), access_token: token });
  const result = await fetchJson(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(accountId)}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody,
  });
  const externalId = String(result.id || "");
  if (!externalId) throw new Error("Meta returned no Instagram media identifier");
  return { externalId, metadata: { containerId: String(container.id) } };
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
    refresh_token: process.env.GOOGLE_BUSINESS_REFRESH_TOKEN!.trim(),
    grant_type: "refresh_token",
  });
  const result = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!result.access_token) throw new Error("Google OAuth returned no access token");
  return String(result.access_token);
}

async function publishGoogleBusiness(input: MarketingPublishInput): Promise<MarketingPublishResult> {
  assertPublicMediaUrl(input.imageUrl);
  const accessToken = await getGoogleAccessToken();
  const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID!.trim();
  const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID!.trim();
  const actionType = input.cta === "CALL" ? "CALL" : input.cta === "LEARN_MORE" ? "LEARN_MORE" : "BOOK";
  const callToAction = actionType === "CALL"
    ? { actionType }
    : { actionType, url: input.campaignUrl };
  const result = await fetchJson(
    `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/localPosts`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        languageCode: "en-US",
        summary: input.caption,
        topicType: "STANDARD",
        callToAction,
        media: [{ mediaFormat: "PHOTO", sourceUrl: input.imageUrl }],
      }),
    },
  );
  const externalId = String(result.name || result.searchUrl || "");
  if (!externalId) throw new Error("Google returned no local post identifier");
  return { externalId, externalUrl: result.searchUrl ? String(result.searchUrl) : undefined, metadata: { state: result.state } };
}

export async function publishMarketingChannel(input: MarketingPublishInput): Promise<MarketingPublishResult> {
  const readiness = getMarketingChannelReadiness().find((entry) => entry.channel === input.channel);
  if (!readiness?.ready) throw new Error(`${input.channel} is not configured: ${readiness?.missing.join(", ") || "missing configuration"}`);
  if (input.channel === "facebook") return publishFacebook(input);
  if (input.channel === "instagram") return publishInstagram(input);
  return publishGoogleBusiness(input);
}
