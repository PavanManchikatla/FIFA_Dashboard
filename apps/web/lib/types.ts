// Shared domain types. The Match shape is the normalization target for every source
// adapter (PLAN.md §2: lib/normalize.ts → Match shape).

export type MatchStatus = 'scheduled' | 'live' | 'finished';

/** Canonical match shape every source adapter normalizes into. */
export type Match = {
  id: string;
  /** Host stadium id (see lib/stadiums.ts). May be null for fixtures TBD. */
  stadiumId: string | null;
  home: string;
  away: string;
  /** Flag image URLs (from the teams endpoint); null if unknown. */
  homeFlag: string | null;
  awayFlag: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  /** ISO-8601 UTC kickoff. */
  kickoffUtc: string;
  /** Minutes elapsed when live (e.g. 64). null otherwise. */
  minute: number | null;
  /** Goal minutes parsed from the scorers fields — reconstructs the in-match heartbeat. */
  homeGoalMinutes: number[];
  awayGoalMinutes: number[];
  group: string | null;
  /** Source-of-truth provenance + freshness, for honest UI labelling. */
  source: string;
  /** True when served from last-good cache after a fetch failure. */
  stale: boolean;
};

export type Stadium = {
  id: string;
  name: string;
  city: string;
  country: 'USA' | 'Mexico' | 'Canada';
  lat: number;
  lon: number;
};

/** What /api/live returns and HoloMap consumes. */
export type LiveSnapshot = {
  generatedAt: string;
  stale: boolean;
  source: string;
  matches: Match[];
};
