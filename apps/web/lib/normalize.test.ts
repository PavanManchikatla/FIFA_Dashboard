import { describe, expect, it } from 'vitest';
import { normalizeWc26ir, stadiumIdByName } from './normalize';
import { WC26IR_FIXTURE, type Wc26irData } from '@/mocks/wc26irRaw';

// Fixture-based adapter test (CLAUDE.md). The fixture mirrors the REAL v1.0.5 payloads
// observed live (string scalars, "TRUE"/"FALSE", time_elapsed, embedded names).

describe('normalizeWc26ir', () => {
  const matches = normalizeWc26ir(WC26IR_FIXTURE);
  const byId = (id: string) => matches.find((m) => m.id === id)!;

  it('maps every game to a Match', () => {
    expect(matches).toHaveLength(WC26IR_FIXTURE.games.length);
  });

  it('resolves embedded team names', () => {
    expect(byId('wc26ir:1').home).toBe('Mexico');
    expect(byId('wc26ir:1').away).toBe('South Africa');
  });

  it('parses string scores to numbers for finished/live, nulls scheduled', () => {
    expect(byId('wc26ir:1')).toMatchObject({ status: 'finished', homeScore: 2, awayScore: 0 });
    expect(byId('wc26ir:6')).toMatchObject({ status: 'live', homeScore: 1, awayScore: 0 });
    expect(byId('wc26ir:9')).toMatchObject({ status: 'scheduled', homeScore: null, awayScore: null });
  });

  it('drives status from time_elapsed / finished string', () => {
    expect(byId('wc26ir:1').status).toBe('finished'); // time_elapsed "finished"
    expect(byId('wc26ir:6').status).toBe('live'); // time_elapsed "live"
    expect(byId('wc26ir:9').status).toBe('scheduled'); // time_elapsed "notstarted"
  });

  it('joins stadium id → name_en → our stadium id (with coords)', () => {
    expect(byId('wc26ir:1').stadiumId).toBe('azteca');
    expect(byId('wc26ir:9').stadiumId).toBe('sofi');
  });

  it('resolves sponsor-prefixed stadium names via substring match', () => {
    // game 30 plays at the real "GEHA Field at Arrowhead Stadium"
    expect(byId('wc26ir:30').stadiumId).toBe('arrowhead');
    expect(stadiumIdByName('GEHA Field at Arrowhead Stadium')).toBe('arrowhead');
    expect(stadiumIdByName('Estadio Azteca')).toBe('azteca');
    expect(stadiumIdByName('Unknown Ground')).toBeNull();
  });

  it('parses local_date (MM/DD/YYYY HH:MM) to ISO for display', () => {
    expect(byId('wc26ir:1').kickoffUtc).toBe('2026-06-11T13:00:00Z');
  });

  it('propagates the stale flag', () => {
    const stale = normalizeWc26ir(WC26IR_FIXTURE, { stale: true });
    expect(stale.every((m) => m.stale)).toBe(true);
  });
});

// Minimal real-shape game builder for adversarial cases.
function mkGame(over: Partial<import('@/mocks/wc26irRaw').Wc26irGame>): import('@/mocks/wc26irRaw').Wc26irGame {
  return {
    _id: 'x', id: '1', home_team_id: '1', away_team_id: '2', home_score: '0', away_score: '0',
    home_scorers: 'null', away_scorers: 'null', group: 'A', matchday: '1',
    local_date: '06/11/2026 13:00', persian_date: '', stadium_id: '1', finished: 'FALSE',
    time_elapsed: 'notstarted', type: 'group', ...over,
  };
}
const wrap = (games: import('@/mocks/wc26irRaw').Wc26irGame[]): Wc26irData => ({
  games, teams: WC26IR_FIXTURE.teams, stadiums: WC26IR_FIXTURE.stadiums,
});

describe('normalize edge cases / robustness', () => {
  it('handles empty data without throwing', () => {
    expect(normalizeWc26ir({ games: [], teams: [], stadiums: [] })).toEqual([]);
  });

  it('falls back to the raw id when a team is unknown and unembedded', () => {
    const m = normalizeWc26ir(wrap([mkGame({ home_team_id: '999', away_team_id: '998' })]))[0];
    expect(m.home).toBe('999');
    expect(m.away).toBe('998');
  });

  it('yields null stadiumId for an unknown stadium', () => {
    const m = normalizeWc26ir(wrap([mkGame({ stadium_id: '404' })]))[0];
    expect(m.stadiumId).toBeNull();
  });

  it('treats HT / ET / numeric / 45+2 as live, not scheduled', () => {
    for (const te of ['HT', 'ET', 'PEN', '90', '45+2', 'live']) {
      const m = normalizeWc26ir(wrap([mkGame({ time_elapsed: te })]))[0];
      expect(m.status, `time_elapsed=${te}`).toBe('live');
    }
  });

  it('lets finished override a stale live time_elapsed', () => {
    const m = normalizeWc26ir(wrap([mkGame({ finished: 'TRUE', time_elapsed: 'live' })]))[0];
    expect(m.status).toBe('finished');
  });

  it('parses junk score strings to 0 rather than NaN', () => {
    const m = normalizeWc26ir(wrap([mkGame({ finished: 'TRUE', time_elapsed: 'finished', home_score: 'null', away_score: '' })]))[0];
    expect(m.homeScore).toBe(0);
    expect(m.awayScore).toBe(0);
  });

  it('does not throw on an unparseable local_date', () => {
    expect(() => normalizeWc26ir(wrap([mkGame({ local_date: 'sometime next week' })]))).not.toThrow();
  });
});

describe('live minute parsing', () => {
  it('reads a numeric time_elapsed as the minute and marks live', () => {
    const data: Wc26irData = {
      ...WC26IR_FIXTURE,
      games: [{ ...WC26IR_FIXTURE.games[1], time_elapsed: '67', home_score: '2' }],
    };
    const m = normalizeWc26ir(data)[0];
    expect(m.status).toBe('live');
    expect(m.minute).toBe(67);
    expect(m.homeScore).toBe(2);
  });

  it('has null minute when live without a numeric clock', () => {
    expect(normalizeWc26ir(WC26IR_FIXTURE).find((m) => m.id === 'wc26ir:6')!.minute).toBeNull();
  });
});
