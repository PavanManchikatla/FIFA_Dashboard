import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MatchProbSchema, MetaSchema, RatingSchema, clampProb } from './oracle';

// Enforce the frozen JSON contract (PLAN.md §5) from the TS side: the artifacts that
// publish.py (Python) commits to apps/web/oracle-data must validate against the zod schemas.
// Keeps the Python producer and TS consumer in lock-step (CLAUDE.md).

const oracle = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../oracle-data/${name}`, import.meta.url)), 'utf8'));

describe('oracle-data artifacts match the frozen contract', () => {
  it('ratings.json is a non-empty ranked Rating[]', () => {
    const ratings = z.array(RatingSchema).parse(oracle('ratings.json'));
    expect(ratings.length).toBeGreaterThan(0);
    expect(ratings[0].rank).toBe(1);
  });

  it('match_probs.json is MatchProb[] with normalized, clamped probabilities', () => {
    const probs = z.array(MatchProbSchema).parse(oracle('match_probs.json'));
    expect(probs.length).toBeGreaterThan(0);
    for (const m of probs) {
      expect(m.pHome + m.pDraw + m.pAway).toBeGreaterThan(0.97);
      expect(m.pHome + m.pDraw + m.pAway).toBeLessThan(1.03);
      for (const p of [m.pHome, m.pDraw, m.pAway]) {
        expect(p).toBe(clampProb(p)); // already within 1–99%
      }
    }
  });

  it('meta.json validates and reports an accepted backtest', () => {
    const meta = MetaSchema.parse(oracle('meta.json'));
    expect(meta.modelVersion).toBeTruthy();
    expect((meta.backtest as { accepted?: boolean })?.accepted).toBe(true);
  });
});
