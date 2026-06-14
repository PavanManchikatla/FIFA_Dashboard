// Static schedule source (docs/wc26ir-REAL-SHAPES.md §3). wc26ir's `local_date` is a
// human string with no time/UTC, so kickoff times CANNOT come from the API. We keep our
// own authoritative UTC kickoffs here, keyed by wc26ir match id, and treat wc26ir as the
// score/state source only. Beacon coords likewise stay in lib/stadiums.ts (the API has
// no lat/lon).
//
// TODO(real schedule): these four are demo placeholders matching the mock. Before going
// live, populate all 104 match ids with real UTC kickoffs (from the official fixture list).
// Matches with no entry here fall back to a coarse date-only kickoff and cannot derive a
// reliable "live" state — see lib/normalize.ts.

export const FIXTURE_KICKOFFS: Record<string, string> = {
  '1': '2026-06-11T19:00:00Z',
  '2': '2026-06-11T23:00:00Z',
  '3': '2026-06-12T00:00:00Z',
  '4': '2026-06-11T16:00:00Z',
};

export function kickoffForMatch(matchId: string): string | undefined {
  return FIXTURE_KICKOFFS[matchId];
}
