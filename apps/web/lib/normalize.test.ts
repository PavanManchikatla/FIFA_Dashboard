import { describe, expect, it } from 'vitest';
import { normalizeWc26ir, stadiumIdByName } from './normalize';
import { WC26IR_FIXTURE } from '@/mocks/wc26irRaw';

// Fixture-based adapter test (CLAUDE.md): one recorded raw payload per source.
describe('normalizeWc26ir', () => {
  const matches = normalizeWc26ir(WC26IR_FIXTURE);

  it('maps every raw game to a Match', () => {
    expect(matches).toHaveLength(WC26IR_FIXTURE.games.length);
  });

  it('resolves stadium display names to ids', () => {
    expect(stadiumIdByName('Estadio Azteca')).toBe('azteca');
    expect(stadiumIdByName('SoFi Stadium')).toBe('sofi');
    expect(stadiumIdByName('Unknown Ground')).toBeNull();
  });

  it('normalizes status, score, and provenance for the live match', () => {
    const azteca = matches.find((m) => m.stadiumId === 'azteca');
    expect(azteca).toMatchObject({
      status: 'live',
      home: 'Mexico',
      away: 'Croatia',
      homeScore: 1,
      awayScore: 0,
      minute: 64,
      group: 'A',
      source: 'worldcup26.ir',
      stale: false,
    });
  });

  it('maps inplay→live, scheduled→scheduled, finished→finished', () => {
    const byStatus = matches.map((m) => m.status).sort();
    expect(byStatus).toEqual(['finished', 'live', 'scheduled', 'scheduled']);
  });

  it('propagates the stale flag', () => {
    const stale = normalizeWc26ir(WC26IR_FIXTURE, { stale: true });
    expect(stale.every((m) => m.stale)).toBe(true);
  });
});
