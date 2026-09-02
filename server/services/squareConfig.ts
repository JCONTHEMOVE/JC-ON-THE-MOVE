export type JcSquareEnvironment = "sandbox" | "production";

export function getSquareEnvironment(): JcSquareEnvironment {
  return process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function getSquareAccessToken(): string {
  const environment = getSquareEnvironment();
  const isolated = environment === "production"
    ? process.env.SQUARE_PRODUCTION_ACCESS_TOKEN
    : process.env.SQUARE_SANDBOX_ACCESS_TOKEN;
  return String(isolated || process.env.SQUARE_ACCESS_TOKEN || "").trim();
}

export function getSquareLocationId(): string | null {
  const environment = getSquareEnvironment();
  const isolated = environment === "production"
    ? process.env.SQUARE_PRODUCTION_LOCATION_ID
    : process.env.SQUARE_SANDBOX_LOCATION_ID;
  return String(isolated || process.env.SQUARE_LOCATION_ID || "").trim() || null;
}

export function getGiftCardBonusStartAt(): Date | null {
  const value = process.env.GIFT_CARD_BONUS_START_AT?.trim();
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getGiftCardBonusReadiness() {
  const requested = process.env.GIFT_CARD_BONUS_ENABLED === "true";
  const publicRequested = process.env.GIFT_CARD_BONUS_PUBLIC_MARKETING_ENABLED === "true";
  const startAt = getGiftCardBonusStartAt();
  const blockers: string[] = [];
  if (!requested) blockers.push("GIFT_CARD_BONUS_ENABLED must be true");
  if (!startAt) blockers.push("GIFT_CARD_BONUS_START_AT must be a valid timestamp");
  if (!getSquareAccessToken()) blockers.push("Square access token is required for the active environment");
  if (!getSquareLocationId()) blockers.push("Square location id is required for the active environment");
  if (!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim()) blockers.push("SQUARE_WEBHOOK_SIGNATURE_KEY is required");
  try {
    const webhookUrl = new URL(process.env.SQUARE_WEBHOOK_URL || "");
    if (webhookUrl.protocol !== "https:") throw new Error("not HTTPS");
  } catch {
    blockers.push("SQUARE_WEBHOOK_URL must be a valid HTTPS URL");
  }
  const enabled = blockers.length === 0;
  return {
    enabled,
    requested,
    publicRequested,
    publicEnabled: enabled && publicRequested,
    startAt: startAt?.toISOString() || null,
    blockers,
  };
}

export function squareConfigSummary() {
  const environment = getSquareEnvironment();
  return {
    environment,
    configured: Boolean(getSquareAccessToken()),
    locationConfigured: Boolean(getSquareLocationId()),
    isolatedCredentialConfigured: Boolean(environment === "production"
      ? process.env.SQUARE_PRODUCTION_ACCESS_TOKEN?.trim()
      : process.env.SQUARE_SANDBOX_ACCESS_TOKEN?.trim()),
  };
}
