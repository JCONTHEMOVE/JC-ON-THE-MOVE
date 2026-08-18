import type { CanonicalPricingSnapshot, QuoteStopCoordinate } from "@shared/canonicalPricing";
import { geocodeAddressDetails, type GeocodedAddress } from "../dispatch/geo";

export type QuoteStopEvidence = GeocodedAddress & { inputAddress: string };

export type QuoteRouteEvidence = {
  verified: boolean;
  provider: "google_directions" | "osrm" | "unavailable";
  addresses: string[];
  stopCoordinates: QuoteStopCoordinate[];
  stops: QuoteStopEvidence[];
  oneWayMiles: number | null;
  oneWayMinutes: number | null;
  reason: string | null;
};

function usableAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length >= 4 && !/^(address|location)\s+tbd$/i.test(trimmed);
}

function distinctAddresses(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!usableAddress(value)) continue;
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function sumGoogleRoute(data: any): { miles: number; minutes: number } | null {
  const legs = data?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) return null;
  const meters = legs.reduce((sum: number, leg: any) => sum + Number(leg?.distance?.value || 0), 0);
  const seconds = legs.reduce((sum: number, leg: any) => sum + Number(leg?.duration?.value || 0), 0);
  if (!(meters > 0) || !(seconds > 0)) return null;
  return { miles: meters / 1609.344, minutes: seconds / 60 };
}

async function googleRoute(
  points: QuoteStopCoordinate[],
  key: string,
): Promise<{ miles: number; minutes: number } | null> {
  const origin = `${points[0].lat},${points[0].lng}`;
  const destinationPoint = points[points.length - 1];
  const destination = `${destinationPoint.lat},${destinationPoint.lng}`;
  const waypoints = points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join("|");
  const params = new URLSearchParams({ origin, destination, key });
  if (waypoints) params.set("waypoints", waypoints);
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
    if (!response.ok) return null;
    return sumGoogleRoute(await response.json());
  } catch {
    return null;
  }
}

async function osrmRoute(points: QuoteStopCoordinate[]): Promise<{ miles: number; minutes: number } | null> {
  const coordinates = points.map((point) => `${point.lng},${point.lat}`).join(";");
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`,
      { headers: { "User-Agent": "JCOnTheMove-QuoteRouting/1.0" } },
    );
    if (!response.ok) return null;
    const data = await response.json() as any;
    const route = data?.routes?.[0];
    const meters = Number(route?.distance || 0);
    const seconds = Number(route?.duration || 0);
    if (!(meters > 0) || !(seconds > 0)) return null;
    return { miles: meters / 1609.344, minutes: seconds / 60 };
  } catch {
    return null;
  }
}

export async function resolveQuoteRouteEvidence(input: {
  addresses: unknown[];
  snapshot: CanonicalPricingSnapshot;
}): Promise<QuoteRouteEvidence> {
  const addresses = distinctAddresses(input.addresses);
  const policy = input.snapshot.geographicPolicy;
  if (!policy || addresses.length === 0) {
    return {
      verified: false,
      provider: "unavailable",
      addresses,
      stopCoordinates: [],
      stops: [],
      oneWayMiles: null,
      oneWayMinutes: null,
      reason: policy ? "No complete service address was available." : "The active pricing version has no geographic policy.",
    };
  }

  const geocoded = await Promise.all(addresses.map((address) => geocodeAddressDetails(address)));
  if (geocoded.some((coordinate) => coordinate == null)) {
    return {
      verified: false,
      provider: "unavailable",
      addresses,
      stopCoordinates: geocoded.filter((coordinate): coordinate is GeocodedAddress => coordinate != null),
      stops: geocoded.flatMap((coordinate, index) => coordinate ? [{ ...coordinate, inputAddress: addresses[index] }] : []),
      oneWayMiles: null,
      oneWayMinutes: null,
      reason: "One or more service stops could not be geocoded.",
    };
  }

  const stopCoordinates = geocoded as QuoteStopCoordinate[];
  const stops = (geocoded as GeocodedAddress[]).map((coordinate, index) => ({ ...coordinate, inputAddress: addresses[index] }));
  const points = [{ lat: policy.origin.lat, lng: policy.origin.lng }, ...stopCoordinates];
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  const google = googleKey ? await googleRoute(points, googleKey) : null;
  if (google) {
    return {
      verified: true,
      provider: "google_directions",
      addresses,
      stopCoordinates,
      stops,
      oneWayMiles: Math.round(google.miles * 10) / 10,
      oneWayMinutes: Math.ceil(google.minutes),
      reason: null,
    };
  }

  const osrm = await osrmRoute(points);
  if (osrm) {
    return {
      verified: true,
      provider: "osrm",
      addresses,
      stopCoordinates,
      stops,
      oneWayMiles: Math.round(osrm.miles * 10) / 10,
      oneWayMinutes: Math.ceil(osrm.minutes),
      reason: null,
    };
  }

  return {
    verified: false,
    provider: "unavailable",
    addresses,
    stopCoordinates,
    stops,
    oneWayMiles: null,
    oneWayMinutes: null,
    reason: "No routing provider returned a verified drive time.",
  };
}
