// Task #172 — Geocoding adapter. Prefers the existing Google Maps
// integration when GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY is
// configured (the same key server/routes/lawnCare.ts already uses for
// service-area geocoding). Falls back to Nominatim — which other parts
// of the codebase (server/routes.ts travel-surcharge calc) already use
// — so the dispatch module keeps working in dev without a paid key.

export interface Coords { lat: number; lng: number }
export interface GeocodedAddress extends Coords {
  formattedAddress: string | null;
  stateCode: string | null;
  locality: string | null;
  postalCode: string | null;
  provider: "google" | "nominatim";
}

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const detail = await geocodeAddressDetails(address);
  return detail ? { lat: detail.lat, lng: detail.lng } : null;
}

export async function geocodeAddressDetails(address: string): Promise<GeocodedAddress | null> {
  if (!address) return null;
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleKey) {
    const g = await geocodeGoogle(address, googleKey);
    if (g) return g;
  }
  return geocodeNominatim(address);
}

function componentValue(
  components: Array<{ long_name?: string; short_name?: string; types?: string[] }>,
  type: string,
  short = false,
): string | null {
  const component = components.find((item) => item.types?.includes(type));
  const value = short ? component?.short_name : component?.long_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function geocodeGoogle(address: string, key: string): Promise<GeocodedAddress | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = (await r.json()) as {
      status: string;
      results: Array<{
        formatted_address?: string;
        address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (data.status !== "OK" || !data.results?.length) return null;
    const place = data.results[0];
    const { lat, lng } = place.geometry.location;
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const components = place.address_components || [];
    return {
      lat,
      lng,
      formattedAddress: place.formatted_address || null,
      stateCode: componentValue(components, "administrative_area_level_1", true)?.toUpperCase() || null,
      locality: componentValue(components, "locality")
        || componentValue(components, "postal_town")
        || componentValue(components, "administrative_area_level_2"),
      postalCode: componentValue(components, "postal_code"),
      provider: "google",
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(address: string): Promise<GeocodedAddress | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "User-Agent": "JCMoves-Dispatch/1.0" } },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
      address?: { state_code?: string; city?: string; town?: string; village?: string; county?: string; postcode?: string };
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    const place = data[0];
    return {
      lat,
      lng,
      formattedAddress: place.display_name || null,
      stateCode: place.address?.state_code?.toUpperCase() || null,
      locality: place.address?.city || place.address?.town || place.address?.village || place.address?.county || null,
      postalCode: place.address?.postcode || null,
      provider: "nominatim",
    };
  } catch {
    return null;
  }
}
