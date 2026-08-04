import { pool } from "../db";

export type JobRateCard = {
  laborRatePerMoverHour: number;
  truckFlat: number;
  trailerFlat: number;
  jcmovesPerDollar: number;
};

export type JobQuotePreview = {
  labor: number;
  truck: number;
  trailer: number;
  total: number;
  projectedCustomerJcMoves: number;
  projectedCrewPoolJcMoves: number;
  rateCard: JobRateCard;
};

const FALLBACK_RATE_CARD: JobRateCard = {
  // $87.50 per mover-hour yields the agreed $175/hour two-mover crew.
  laborRatePerMoverHour: 87.5,
  truckFlat: 300,
  trailerFlat: 175,
  jcmovesPerDollar: 15,
};

function finite(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function getJobRateCard(): Promise<JobRateCard> {
  const [{ rows: pricingRows }, { rows: rewardRows }] = await Promise.all([
    pool.query(`SELECT setting_key, setting_value FROM spin_config WHERE setting_key IN ('pricing_rate_per_mover_hour', 'pricing_truck_small_flat', 'pricing_trailer_flat')`),
    pool.query(`SELECT token_amount FROM reward_settings WHERE setting_key = 'earn_rate_per_dollar' AND is_active = TRUE LIMIT 1`),
  ]);
  const pricing = Object.fromEntries(pricingRows.map((row) => [row.setting_key, row.setting_value]));
  return {
    laborRatePerMoverHour: finite(pricing.pricing_rate_per_mover_hour, FALLBACK_RATE_CARD.laborRatePerMoverHour),
    truckFlat: finite(pricing.pricing_truck_small_flat, FALLBACK_RATE_CARD.truckFlat),
    trailerFlat: finite(pricing.pricing_trailer_flat, FALLBACK_RATE_CARD.trailerFlat),
    jcmovesPerDollar: finite(rewardRows[0]?.token_amount, FALLBACK_RATE_CARD.jcmovesPerDollar),
  };
}

export async function calculateJobQuotePreview(input: {
  crewSize?: number | null;
  confirmedHours?: number | null;
  truckConfig?: string | null;
  trailerRequested?: boolean | null;
}): Promise<JobQuotePreview> {
  const rateCard = await getJobRateCard();
  return calculateJobQuoteFromRateCard(rateCard, input);
}

export function calculateJobQuoteFromRateCard(rateCard: JobRateCard, input: {
  crewSize?: number | null;
  confirmedHours?: number | null;
  truckConfig?: string | null;
  trailerRequested?: boolean | null;
}): JobQuotePreview {
  const crewSize = Math.max(1, Math.min(12, Math.round(Number(input.crewSize || 0) || 2)));
  const confirmedHours = Math.max(1, Math.min(24, Number(input.confirmedHours || 0) || 2));
  const truckConfig = String(input.truckConfig || "no_truck");
  const truck = truckConfig === "company_truck" ? rateCard.truckFlat : 0;
  const trailer = input.trailerRequested || truckConfig === "trailer_only" ? rateCard.trailerFlat : 0;
  const labor = crewSize * confirmedHours * rateCard.laborRatePerMoverHour;
  const total = Math.round((labor + truck + trailer) * 100) / 100;
  const projectedTokens = Math.round(total * rateCard.jcmovesPerDollar);
  return {
    labor,
    truck,
    trailer,
    total,
    projectedCustomerJcMoves: projectedTokens,
    projectedCrewPoolJcMoves: projectedTokens,
    rateCard,
  };
}
