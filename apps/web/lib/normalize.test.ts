import { describe, expect, it } from 'vitest';
import { normalizeWc26ir, stadiumIdByName } from './normalize';
import { WC26IR_FIXTURE, type Wc26irData } from '@/mocks/wc26irRaw';

// Fixture-based adapter test (CLAUDE.md): one recorded raw payload per source. The fixture
// is faithful to the verified v1.0.5 contract (docs/wc26ir-REAL-SHAPES.md).

// A fixed "now" well after the demo kickoffs so window-derived live is off by default.
const NOW = Date.parse('2026-07-01T00:00:00Z');

describe('normalizeWc26ir', () => {
  const matches = normalizeWc26ir(WC26IR_FIXTURE, { now: NOW });

  it('maps every game to a Match', () => {
    expect(matches).toHaveLength(WC26IR_FIXTURE.games.length);
  });

  it('joins team ids → names from the teams endpoint', () => {
    const game1 = matches.find((m) => m.id === 'wc26ir:1')!;
    expect(game1.home).toBe('Mexico');
    expect(game1.away).toBe('Croatia');
  });

  it('resolves stadium by id → name_en → our stadium id (with coords)', () => {
    expect(matches.find((m) => m.id === 'wc26ir:1')!.stadiumId).toBe('azteca');
    expect(matches.find((m) => m.id === 'wc26ir:4')!.stadiumId).toBe('metlife');
  });

  it('uses our fixtures table for kickoff, not the API local_date', () => {
    expect(matches.find((m) => m.id === 'wc26ir:1')!.kickoffUtc).toBe('2026-06-11T19:00:00Z');
  });

  it('maps finished:true → finished, keeps its score', () => {
    const g4 = matches.find((m) => m.id === 'wc26ir:4')!;
    expect(g4.status).toBe('finished');
    expect(g4.homeScore).toBe(2);
    expect(g4.awayScore).toBe(2);
  });

  it('nulls scores for scheduled matches (0–0 fixtures are not real scores)', () => {
    const g1 = matches.find((m) => m.id === 'wc26ir:1')!;
    expect(g1.status).toBe('scheduled');
    expect(g1.homeScore).toBeNull();
  });

  it('stadiumIdByName resolves known names and rejects unknown', () => {
    expect(stadiumIdByName('SoFi Stadium')).toBe('sofi');
    expect(stadiumIdByName('Unknown Ground')).toBeNull();
  });

  it('propagates the stale flag', () => {
    const stale = normalizeWc26ir(WC26IR_FIXTURE, { stale: true, now: NOW });
    expect(stale.every((m) => m.stale)).toBe(true);
  });
});

describe('live derivation (docs/wc26ir-REAL-SHAPES.md §5)', () => {
  it('treats an explicit status:live (optional field) as live', () => {
    const data: Wc26irData = {
      ...WC26IR_FIXTURE,
      games: [{ ...WC26IR_FIXTURE.games[0], status: 'live', minute: 64, home_score: 1 }],
    };
    const m = normalizeWc26ir(data, { now: NOW })[0];
    expect(m.status).toBe('live');
    expect(m.minute).toBe(64);
    expect(m.homeScore).toBe(1);
  });

  it('derives live from the kickoff window when within ~150 min of a real kickoff', () => {
    const within = Date.parse('2026-06-11T20:00:00Z'); // 60 min after game 1 kickoff
    const m = normalizeWc26ir(WC26IR_FIXTURE, { now: within }).find((x) => x.id === 'wc26ir:1')!;
    expect(m.status).toBe('live');
  });

  it('does not derive live for a date-only fallback kickoff (no fixtures entry)', () => {
    const data: Wc26irData = {
      ...WC26IR_FIXTURE,
      games: [{ ...WC26IR_FIXTURE.games[0], id: '999' }], // no fixtures kickoff
    };
    // Even "during" June 11 it cannot time the match → scheduled, not live.
    const m = normalizeWc26ir(data, { now: Date.parse('2026-06-11T12:00:00Z') })[0];
    expect(m.status).toBe('scheduled');
  });
});
