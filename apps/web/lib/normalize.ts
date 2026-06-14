import type { Match, MatchStatus } from './types';
import { STADIUMS } from './stadiums';
import { kickoffForMatch } from './fixtures';
import type { Wc26irData, Wc26irGame, Wc26irStadium, Wc26irTeam } from '@/mocks/wc26irRaw';

// All sources → the canonical Match shape (PLAN.md §2). The wc26ir adapter joins three
// endpoints because matches reference teams/stadiums by ID only (docs/wc26ir-REAL-SHAPES.md).

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const STADIUM_BY_NAME = new Map(STADIUMS.map((s) => [norm(s.name), s.id]));

/** Map a stadium display name (wc26ir name_en) to our stadium id, or null if unknown. */
export function stadiumIdByName(name: string): string | null {
  return STADIUM_BY_NAME.get(norm(name)) ?? null;
}

// A match is considered live for ~150 minutes after kickoff (90' + stoppage + half-time
// buffer), unless flagged finished. Only used when we have a real (fixtures) kickoff.
const LIVE_WINDOW_MS = 150 * 60 * 1000;

/** Best-effort ISO from wc26ir's human `local_date` ("June 11, 2026"); date-only, no time. */
function localDateToIso(localDate: string): string {
  const t = Date.parse(`${localDate} UTC`);
  if (!Number.isNaN(t)) return new Date(t).toISOString();
  const t2 = Date.parse(localDate);
  return Number.isNaN(t2) ? localDate : new Date(t2).toISOString();
}

/**
 * Derive live state (docs/wc26ir-REAL-SHAPES.md §5): prefer explicit live fields if the API
 * provides them (gated on presence), else fall back to the kickoff window — but only when we
 * have a real kickoff (from fixtures), since the date-only fallback can't time a match.
 */
function deriveStatus(
  g: Wc26irGame,
  kickoffMs: number | null,
  hasRealKickoff: boolean,
  now: number,
): MatchStatus {
  if (g.finished) return 'finished';
  if (g.status === 'live') return 'live';
  if (typeof g.minute === 'number') return 'live';
  if (hasRealKickoff && kickoffMs != null && now >= kickoffMs && now < kickoffMs + LIVE_WINDOW_MS) {
    return 'live';
  }
  return 'scheduled';
}

export function normalizeWc26ir(
  data: Wc26irData,
  opts: { stale?: boolean; now?: number } = {},
): Match[] {
  const now = opts.now ?? Date.now();
  const teamById = new Map<string, Wc26irTeam>(data.teams.map((t) => [t.id, t]));
  const stadiumById = new Map<string, Wc26irStadium>(data.stadiums.map((s) => [s.id, s]));

  return data.games.map((g) => {
    const homeTeam = teamById.get(g.home_team_id);
    const awayTeam = teamById.get(g.away_team_id);

    // Resolve our stadium (with coords) via the wc26ir stadium's name_en.
    const rawStadium = stadiumById.get(g.stadium_id);
    const stadiumId = rawStadium ? stadiumIdByName(rawStadium.name_en) : null;

    const fixtureKickoff = kickoffForMatch(g.id);
    const hasRealKickoff = fixtureKickoff != null;
    const kickoffUtc = fixtureKickoff ?? localDateToIso(g.local_date);
    const kickoffMs = Date.parse(kickoffUtc);

    const status = deriveStatus(g, Number.isNaN(kickoffMs) ? null : kickoffMs, hasRealKickoff, now);

    return {
      id: `wc26ir:${g.id}`,
      stadiumId,
      home: homeTeam?.name_en ?? g.home_team_id,
      away: awayTeam?.name_en ?? g.away_team_id,
      // Scores are numbers; 0–0 for not-yet-played fixtures is expected (the UI shows
      // scores only for live/finished matches).
      homeScore: status === 'scheduled' ? null : g.home_score,
      awayScore: status === 'scheduled' ? null : g.away_score,
      status,
      kickoffUtc,
      minute: typeof g.minute === 'number' ? g.minute : null,
      group: g.group,
      source: 'worldcup26.ir',
      stale: opts.stale ?? false,
    };
  });
}
