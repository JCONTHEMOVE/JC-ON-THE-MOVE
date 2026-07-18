export type MarketplaceQuotePreview = {
  matched: boolean;
  reason?: string;
  coordinates?: { lat: number; lng: number } | null;
  quote: {
    zone: {
      id: string | number;
      code: string;
      name: string;
    } | null;
    rate: {
      id?: string | number;
      zoneId?: string | number;
      serviceCode: string;
      serviceLabel: string;
      crewSize: number;
      hourlyRate: number;
      minimumHours: number;
      discountAfterHours: number | null;
      discountedHourlyRate: number | null;
      active?: boolean;
    } | null;
    labor: number;
    booking?: {
      crewSize: number;
      requestedHours: number;
      billableHours: number;
      workScope: "load_only" | "unload_only" | "load_unload";
      laborTotal: number;
      zoneMultiplier: number;
      longBookingDiscountPct: number;
    } | null;
    travel: number;
    subtotal: number;
    minEstimate: number;
    maxEstimate: number;
  };
  candidates?: unknown[];
};

function dollars(value: number) {
  const n = Number(value);
  return Number.isFinite(n) ? `$${Math.round(n).toLocaleString()}` : "$0";
}

export function marketplaceEstimateLabel(preview: MarketplaceQuotePreview) {
  return `${dollars(preview.quote.minEstimate)} - ${dollars(preview.quote.maxEstimate)}`;
}

export function marketplacePreviewZoneName(preview: MarketplaceQuotePreview) {
  return preview.matched ? preview.quote.zone?.name || "Matched zone" : "Out-of-zone quote review";
}

export function marketplacePreviewCrewSize(preview: MarketplaceQuotePreview, fallbackCrewSize = 2) {
  const n = Number(preview.quote.booking?.crewSize ?? preview.quote.rate?.crewSize ?? fallbackCrewSize);
  return Number.isFinite(n) && n > 0 ? n : fallbackCrewSize;
}

export function marketplacePreviewBillableHours(preview: MarketplaceQuotePreview, requestedHours = 0) {
  const requested = Number(requestedHours);
  const minimum = Number(preview.quote.booking?.billableHours ?? preview.quote.rate?.minimumHours ?? requested);
  const billable = Math.max(
    Number.isFinite(requested) ? requested : 0,
    Number.isFinite(minimum) ? minimum : 0,
  );
  return billable > 0 ? billable : 0;
}
