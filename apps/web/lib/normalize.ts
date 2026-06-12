import type { Match, MatchStatus } from './types';
import { STADIUMS } from './stadiums';
import type { Wc26irRawGame, Wc26irRawPayload } from '@/mocks/wc26irRaw';

// All sources → the canonical Match shape (PLAN.md §2). One adapter per source; each
// needs a fixture-based test (CLAUDE.md testing expectations).

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const STADIUM_BY_NAME = new Map(STADIUMS.map((s) => [norm(s.name), s.id]));

/** Map a raw stadium display name to our stadium id, or null if unknown. */
export function stadiumIdByName(name: string): string | null {
  return STADIUM_BY_NAME.get(norm(name)) ?? null;
}

const STATUS: Record<Wc26irRawGame['status'], MatchStatus> = {
  scheduled: 'scheduled',
  inplay: 'live',
  finished: 'finished',
};

export function normalizeWc26ir(
  payload: Wc26irRawPayload,
  opts: { stale?: boolean } = {},
): Match[] {
  return payload.games.map((g) => ({
    id: `wc26ir:${g.id}`,
    stadiumId: stadiumIdByName(g.stadium),
    home: g.home.name,
    away: g.away.name,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: STATUS[g.status],
    kickoffUtc: g.utc_date,
    minute: g.minute,
    group: g.group,
    source: 'worldcup26.ir',
    stale: opts.stale ?? false,
  }));
}
