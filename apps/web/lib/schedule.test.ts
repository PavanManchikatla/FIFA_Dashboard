import { describe, expect, it } from 'vitest';
import { KICKOFF_WINDOW_MS, hasActiveWindow, isActive, snapshotAgeMs } from './schedule';
import type { LiveSnapshot, Match } from './types';

const NOW = Date.parse('2026-06-11T19:00:00Z');

function match(over: Partial<Match>): Match {
  return {
    id: 'm', stadiumId: 'azteca', home: 'A', away: 'B', homeScore: null, awayScore: null,
    status: 'scheduled', kickoffUtc: '2026-06-11T19:00:00Z', minute: null,
    homeGoalMinutes: [], awayGoalMinutes: [], group: null,
    source: 'test', stale: false, ...over,
  };
}

describe('isActive', () => {
  it('is true for live matches', () => {
    expect(isActive(match({ status: 'live' }), NOW)).toBe(true);
  });

  it('is true for a match within the kickoff window', () => {
    const ko = new Date(NOW + KICKOFF_WINDOW_MS - 60_000).toISOString();
    expect(isActive(match({ kickoffUtc: ko }), NOW)).toBe(true);
  });

  it('is false for a match beyond the window or already finished', () => {
    const far = new Date(NOW + KICKOFF_WINDOW_MS + 60_000).toISOString();
    expect(isActive(match({ kickoffUtc: far }), NOW)).toBe(false);
    expect(isActive(match({ status: 'finished' }), NOW)).toBe(false);
  });
});

describe('hasActiveWindow', () => {
  const snap = (matches: Match[]): LiveSnapshot => ({
    generatedAt: '2026-06-11T19:00:00Z', stale: false, source: 'test', matches,
  });

  it('detects any active match', () => {
    expect(hasActiveWindow(snap([match({ status: 'finished' }), match({ status: 'live' })]), NOW)).toBe(true);
  });
  it('is false when nothing is active or snapshot is null', () => {
    expect(hasActiveWindow(snap([match({ status: 'finished' })]), NOW)).toBe(false);
    expect(hasActiveWindow(null, NOW)).toBe(false);
  });
});

describe('isActive boundaries', () => {
  it('is active exactly at kickoff and at the window edge, not past it', () => {
    expect(isActive(match({ kickoffUtc: new Date(NOW).toISOString() }), NOW)).toBe(true);
    expect(isActive(match({ kickoffUtc: new Date(NOW + KICKOFF_WINDOW_MS).toISOString() }), NOW)).toBe(true);
    expect(isActive(match({ kickoffUtc: new Date(NOW + KICKOFF_WINDOW_MS + 1).toISOString() }), NOW)).toBe(false);
  });

  it('is not active for a kickoff already in the past (but not yet flagged live)', () => {
    expect(isActive(match({ kickoffUtc: new Date(NOW - 1).toISOString() }), NOW)).toBe(false);
  });

  it('does not throw / is false for an unparseable kickoff', () => {
    expect(isActive(match({ kickoffUtc: 'not-a-date' }), NOW)).toBe(false);
  });
});

describe('snapshotAgeMs', () => {
  it('measures age and treats null/bad as Infinity', () => {
    const s: LiveSnapshot = { generatedAt: new Date(NOW - 5000).toISOString(), stale: false, source: 't', matches: [] };
    expect(snapshotAgeMs(s, NOW)).toBe(5000);
    expect(snapshotAgeMs(null, NOW)).toBe(Infinity);
  });
});
