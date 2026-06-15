import type { Match, MatchStatus } from './types';
import { STADIUMS } from './stadiums';
import { kickoffForMatch } from './fixtures';
import type { Wc26irData, Wc26irGame, Wc26irStadium, Wc26irTeam } from '@/mocks/wc26irRaw';

// All sources → the canonical Match shape (PLAN.md §2). The wc26ir adapter joins the
// games + teams + stadiums endpoints. Reconciled against the REAL v1.0.5 payloads
// (docs/wc26ir-REAL-SHAPES.md): every scalar is a string, `finished` is "TRUE"/"FALSE",
// state lives in `time_elapsed`, team names are embedded, stadiums are by id only.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const OUR_STADIUMS = STADIUMS.map((s) => ({ id: s.id, key: norm(s.name) }));
const STADIUM_BY_NAME = new Map(OUR_STADIUMS.map((s) => [s.key, s.id]));

/**
 * Resolve a stadium display name (wc26ir `name_en`) to our stadium id. Exact match first,
 * then a substring match so sponsor prefixes still resolve (e.g. the real
 * "GEHA Field at Arrowhead Stadium" → our "Arrowhead Stadium"). null if unknown.
 */
export function stadiumIdByName(name: string): string | null {
  const k = norm(name);
  const exact = STADIUM_BY_NAME.get(k);
  if (exact) return exact;
  for (const s of OUR_STADIUMS) {
    if (k.includes(s.key) || s.key.includes(k)) return s.id;
  }
  return null;
}

const parseScore = (s: string): number => {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
};

// time_elapsed values that mean "not yet kicked off". Anything else non-finished is in-play
// (covers "live", "HT", "ET", "PEN", "45+2", "90", … — we don't want to silently drop those).
const NOT_STARTED = new Set(['', 'notstarted', 'not started', 'scheduled', 'tbd', 'upcoming']);

/** Map wc26ir state → our status, trusting `finished` then `time_elapsed`. */
function deriveStatus(g: Wc26irGame): MatchStatus {
  const te = (g.time_elapsed ?? '').toLowerCase().trim();
  if (g.finished === 'TRUE' || te === 'finished' || te === 'ft') return 'finished';
  if (NOT_STARTED.has(te)) return 'scheduled';
  return 'live';
}

/** A live `time_elapsed` may be a minute string ("67") once the API populates it. */
function parseMinute(timeElapsed: string): number | null {
  const m = /^(\d+)/.exec(timeElapsed?.trim() ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Extract goal minutes from a wc26ir scorers field. It's a messy stringified set with smart
 * quotes, e.g. `{"J. Quiñones 9'","R. Jiménez 67'"}` or the literal string "null". We just
 * pull every `<minute>'` token (handling "45+2'" → 45), sorted — enough to rebuild the
 * score timeline for the heartbeat chart.
 */
function parseGoalMinutes(scorers: string | undefined): number[] {
  if (!scorers || scorers === 'null') return [];
  const out: number[] = [];
  for (const m of scorers.matchAll(/(\d+)(?:\+\d+)?\s*'/g)) {
    const min = Number(m[1]);
    if (!Number.isNaN(min)) out.push(min);
  }
  return out.sort((a, b) => a - b);
}

// wc26ir `local_date` is "MM/DD/YYYY HH:MM" with an ambiguous TZ. We have no authoritative
// UTC schedule, so parse it best-effort as UTC for *display* only (live state comes from
// time_elapsed, not this). lib/fixtures.ts can override with a real UTC kickoff when curated.
function localDateToIso(localDate: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(localDate?.trim() ?? '');
  if (m) {
    const [, mm, dd, yyyy, hh, min] = m;
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`;
  }
  const t = Date.parse(localDate);
  return Number.isNaN(t) ? localDate : new Date(t).toISOString();
}

export function normalizeWc26ir(data: Wc26irData, opts: { stale?: boolean } = {}): Match[] {
  const teamById = new Map<string, Wc26irTeam>(data.teams.map((t) => [t.id, t]));
  const stadiumById = new Map<string, Wc26irStadium>(data.stadiums.map((s) => [s.id, s]));

  return data.games.map((g) => {
    // Prefer the embedded per-game name (correct for decided knockouts too), fall back to
    // the teams endpoint, then the raw id.
    const home = g.home_team_name_en || teamById.get(g.home_team_id)?.name_en || g.home_team_id;
    const away = g.away_team_name_en || teamById.get(g.away_team_id)?.name_en || g.away_team_id;

    const rawStadium = stadiumById.get(g.stadium_id);
    const stadiumId = rawStadium ? stadiumIdByName(rawStadium.name_en) : null;

    const status = deriveStatus(g);
    const kickoffUtc = kickoffForMatch(g.id) ?? localDateToIso(g.local_date);

    return {
      id: `wc26ir:${g.id}`,
      stadiumId,
      home,
      away,
      // Scores are strings upstream; show them only once a match is live/finished.
      homeScore: status === 'scheduled' ? null : parseScore(g.home_score),
      awayScore: status === 'scheduled' ? null : parseScore(g.away_score),
      status,
      kickoffUtc,
      minute: status === 'live' ? parseMinute(g.time_elapsed) : null,
      homeGoalMinutes: parseGoalMinutes(g.home_scorers),
      awayGoalMinutes: parseGoalMinutes(g.away_scorers),
      group: g.group,
      source: 'worldcup26.ir',
      stale: opts.stale ?? false,
    };
  });
}
