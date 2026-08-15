import { getAppUrl } from "../appUrl";

export type MarketingCampaignEditor = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

export function safeMarketingCampaignDestination(rawUrl: unknown, appUrl = getAppUrl()) {
  const fallback = `${appUrl.replace(/\/$/, "")}/book`;
  try {
    const destination = new URL(String(rawUrl || ""), appUrl);
    const appHost = new URL(appUrl).hostname.toLowerCase();
    const host = destination.hostname.toLowerCase();
    const allowed = host === appHost || host === "jconthemove.com" || host === "www.jconthemove.com";
    return allowed && ["http:", "https:"].includes(destination.protocol) ? destination.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function canEditMarketingCampaign(actorId: unknown, user: MarketingCampaignEditor) {
  const isAdmin = user.role === "admin"
    || user.role === "business_owner"
    || String(user.email || "").toLowerCase() === "upmichiganstatemovers@gmail.com";
  const isOwner = Boolean(actorId) && String(actorId) === String(user.id || "");
  return isOwner || isAdmin;
}

export function escapeMarketingCampaignHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildMarketingCampaignShareDocument(input: {
  title: string;
  description: string;
  shareUrl: string;
  imageUrl: string;
  imageAlt: string;
  destination: string;
}) {
  const destinationJson = JSON.stringify(input.destination).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeMarketingCampaignHtml(input.title)} | JC ON THE MOVE</title>
  <meta name="description" content="${escapeMarketingCampaignHtml(input.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="JC ON THE MOVE" />
  <meta property="og:title" content="${escapeMarketingCampaignHtml(input.title)}" />
  <meta property="og:description" content="${escapeMarketingCampaignHtml(input.description)}" />
  <meta property="og:url" content="${escapeMarketingCampaignHtml(input.shareUrl)}" />
  <meta property="og:image" content="${escapeMarketingCampaignHtml(input.imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeMarketingCampaignHtml(input.imageAlt)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeMarketingCampaignHtml(input.title)}" />
  <meta name="twitter:description" content="${escapeMarketingCampaignHtml(input.description)}" />
  <meta name="twitter:image" content="${escapeMarketingCampaignHtml(input.imageUrl)}" />
  <link rel="canonical" href="${escapeMarketingCampaignHtml(input.shareUrl)}" />
</head>
<body style="margin:0;background:#020617;color:#fff;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center;text-align:center">
  <main style="max-width:680px;padding:32px"><h1>JC ON THE MOVE</h1><p>Opening the tracked booking page…</p><p><a style="color:#93c5fd" href="${escapeMarketingCampaignHtml(input.destination)}">Continue to booking</a></p></main>
  <script>window.setTimeout(function(){window.location.replace(${destinationJson});},250);</script>
</body>
</html>`;
}
