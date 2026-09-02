export const IRONWOOD_LOCAL_ZONE_CODE = "IRONWOOD_LOCAL";
export const IRONWOOD_LOCAL_ZONE_LABEL = "Ironwood / Bessemer local service zone";

const LOCAL_ZIPS = new Set(["49911", "49938"]);

function normalizedAddress(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\bmichigan\b/g, "mi")
    .replace(/\s+/g, " ");
}

/**
 * Deterministic server-safe recognition for the two approved local markets.
 * Full street addresses match because the city/state or ZIP remains present.
 */
export function recognizedIronwoodLocalAddress(value: unknown) {
  const address = normalizedAddress(value);
  if (!address) return false;
  const zip = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  if (zip && LOCAL_ZIPS.has(zip)) return true;
  return /\b(?:ironwood|bessemer)\s*,?\s*mi\b/.test(address);
}

export function allAddressesRecognizedIronwoodLocal(values: unknown[]) {
  const addresses = values.map((value) => String(value || "").trim()).filter((value) => value.length >= 4);
  return addresses.length > 0 && addresses.every(recognizedIronwoodLocalAddress);
}

export function isIronwoodLocalCoordinate(lng: number, lat: number) {
  return lng >= -90.38 && lng <= -89.93 && lat >= 46.32 && lat <= 46.62;
}
