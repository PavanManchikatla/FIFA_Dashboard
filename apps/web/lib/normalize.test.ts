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
