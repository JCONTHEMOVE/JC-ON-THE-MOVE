// Task #172 — Dispatch service types & state machine.
//
// dispatch_state is persisted separately from lead.status so downstream
// systems (invoicing, rewards, crew UI) that key off status don't have
// to learn the new vocabulary all at once.

export type DispatchState =
  | "pending"    // just created, ready to be offered
  | "offering"   // an offer is outstanding to a single crew member
  | "assigned"   // admin manual override — crew pinned without an offer loop
  | "accepted"   // crew accepted the offer; execution not yet started
  | "en_route"   // crew moving to site
  | "on_site"    // crew on site
  | "completed"  // job finished
  | "failed";    // exhausted all candidates / manual kill

export const TERMINAL_STATES: DispatchState[] = ["completed", "failed"];
// States in which an offer loop should NOT restart.
export const NON_DISPATCHABLE_STATES: DispatchState[] =
  ["assigned", "accepted", "en_route", "on_site", "completed"];

export interface DispatchCandidate {
  crewId: string;
  isDriver: boolean;
  score: number;
  distanceMi: number;
  locationFresh: boolean;
  jobsToday: number;
  reasons: string[];
}

export interface DispatchJob {
  id: string;
  serviceType: string;
  lat: number | null;
  lng: number | null;
  urgency: "low" | "normal" | "high";
  totalPrice: number;
  crewSize: number;
  crewMembers: string[];
  status: string;
  dispatchState: DispatchState;
  dispatchOfferedTo: string | null;
  dispatchOfferExpiresAt: Date | null;
}

export interface DispatchResult {
  ok: boolean;
  state: DispatchState;
  offeredTo?: string;
  reason?: string;
}

// Configurable timings (ms). Exposed for tests / admin overrides later.
export const OFFER_TTL_MS = 20_000;
export const OFFER_LOCK_TTL_MS = 25_000; // slightly longer than OFFER_TTL so timeout handler owns the clear
