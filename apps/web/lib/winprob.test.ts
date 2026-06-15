import { describe, expect, it } from 'vitest';
import { buildHeartbeat, panicIndex, winProbAtState } from './winprob';

const sums1 = (w: { pHome: number; pDraw: number; pAway: number }) =>
  expect(w.pHome + w.pDraw + w.pAway).toBeCloseTo(1, 6);

describe('winProbAtState', () => {
  it('always returns a distribution', () => {
    sums1(winProbAtState({ lambdaHome: 1.4, lambdaAway: 1.1, minute: 0, scoreHome: 0, scoreAway: 0 }));
    sums1(winProbAtState({ lambdaHome: 2, lambdaAway: 0.5, minute: 75, scoreHome: 1, scoreAway: 1 }));
  });

  it('at kickoff, the stronger attack is favoured', () => {
    const w = winProbAtState({ lambdaHome: 2.0, lambdaAway: 0.8, minute: 0, scoreHome: 0, scoreAway: 0 });
    expect(w.pHome).toBeGreaterThan(w.pAway);
  });

  it('at full time the current score decides', () => {
    const lead = winProbAtState({ lambdaHome: 1, lambdaAway: 1, minute: 90, scoreHome: 2, scoreAway: 1 });
    expect(lead.pHome).toBeCloseTo(1, 6);
    const draw = winProbAtState({ lambdaHome: 1, lambdaAway: 1, minute: 90, scoreHome: 1, scoreAway: 1 });
    expect(draw.pDraw).toBeCloseTo(1, 6);
  });

  it('a late lead is strong but not certain', () => {
    const w = winProbAtState({ lambdaHome: 1.3, lambdaAway: 1.3, minute: 80, scoreHome: 1, scoreAway: 0 });
    expect(w.pHome).toBeGreaterThan(0.8);
    expect(w.pHome).toBeLessThan(1);
  });

  it('a red card boosts the opponent', () => {
    const base = winProbAtState({ lambdaHome: 1.3, lambdaAway: 1.3, minute: 30, scoreHome: 0, scoreAway: 0 });
    const homeRed = winProbAtState({ lambdaHome: 1.3, lambdaAway: 1.3, minute: 30, scoreHome: 0, scoreAway: 0, redHome: 1 });
    expect(homeRed.pAway).toBeGreaterThan(base.pAway);
  });
});

describe('buildHeartbeat', () => {
  it('rebuilds the score timeline from goal minutes and starts level', () => {
    const hb = buildHeartbeat({
      lambdaHome: 1.5, lambdaAway: 1.0, homeGoalMinutes: [23, 67], awayGoalMinutes: [55], currentMinute: 90,
    });
    expect(hb[0]).toMatchObject({ minute: 0, scoreHome: 0, scoreAway: 0 });
    expect(hb.at(-1)).toMatchObject({ minute: 90, scoreHome: 2, scoreAway: 1 });
    // Just after the 23' goal, home leads 1-0.
    const at24 = hb.find((p) => p.minute === 24)!;
    expect(at24).toMatchObject({ scoreHome: 1, scoreAway: 0 });
    hb.forEach(sums1);
  });

  it('stops at the current minute', () => {
    const hb = buildHeartbeat({ lambdaHome: 1, lambdaAway: 1, homeGoalMinutes: [], awayGoalMinutes: [], currentMinute: 40 });
    expect(hb.at(-1)!.minute).toBe(40);
  });
});

describe('panicIndex', () => {
  it('is high when a favourite is losing late with trauma', () => {
    const p = panicIndex({ minute: 85, myScore: 0, oppScore: 1, titleOdds: 0.3, trauma: 0.9 });
    expect(p).toBeGreaterThan(5);
  });

  it('is low when comfortably winning early', () => {
    const p = panicIndex({ minute: 10, myScore: 2, oppScore: 0, titleOdds: 0.3, trauma: 0.9 });
    expect(p).toBeLessThan(2);
  });

  it('rises with deficit and stays within 0–10', () => {
    const one = panicIndex({ minute: 70, myScore: 1, oppScore: 2, titleOdds: 0.1, trauma: 0.3 });
    const three = panicIndex({ minute: 70, myScore: 0, oppScore: 3, titleOdds: 0.1, trauma: 0.3 });
    expect(three).toBeGreaterThan(one);
    for (const p of [one, three]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(10);
    }
  });
});
