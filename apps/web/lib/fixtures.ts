// OPTIONAL UTC kickoff overrides, keyed by wc26ir match id.
//
// The real API does provide a kickoff (`local_date` = "MM/DD/YYYY HH:MM"), so normalize.ts
// parses that by default. But its timezone is ambiguous, so this table lets us override any
// match with an authoritative UTC kickoff once we curate the official schedule. Live state
// does NOT depend on this — it comes from the API's `time_elapsed` field.
//
// Empty by default: local_date is used. Add entries only to correct specific kickoffs.
export const FIXTURE_KICKOFFS: Record<string, string> = {};

export function kickoffForMatch(matchId: string): string | undefined {
  return FIXTURE_KICKOFFS[matchId];
}
