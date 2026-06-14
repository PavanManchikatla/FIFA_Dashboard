import { z } from 'zod';

// Frozen JSON contracts (PLAN.md §5). Changing these requires updating the Python
// publishers (ml/src/wc26ml/publish.py) and PLAN.md in the same commit (CLAUDE.md).
// The ML pipeline (Phase 2+) writes these to public/oracle/; these schemas validate
// them at read time. Defined now so the contract is fixed before producers exist.

export const MatchProbSchema = z.object({
  matchId: z.string(),
  home: z.string(),
  away: z.string(),
  kickoffUtc: z.string(),
  pHome: z.number(),
  pDraw: z.number(),
  pAway: z.number(),
  pAdvanceHome: z.number().optional(),
  likelyScore: z.tuple([z.number(), z.number()]),
  modelVersion: z.string(),
});
export type MatchProb = z.infer<typeof MatchProbSchema>;

export const TeamSimSchema = z.object({
  team: z.string(),
  pGroup: z.number(),
  pR32: z.number(),
  pR16: z.number(),
  pQF: z.number(),
  pSF: z.number(),
  pFinal: z.number(),
  pChampion: z.number(),
  dChampion24h: z.number(),
});
export type TeamSim = z.infer<typeof TeamSimSchema>;

export const InsightSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  teams: z.array(z.string()),
  templateId: z.string(),
  params: z.record(z.union([z.string(), z.number()])),
  generatedAt: z.string(),
});
export type Insight = z.infer<typeof InsightSchema>;

// ratings.json (PLAN.md §4.1). Not in the §5 frozen contract but produced by publish.py.
export const RatingSchema = z.object({
  team: z.string(),
  elo: z.number(),
  rank: z.number(),
  delta_7d: z.number(),
});
export type Rating = z.infer<typeof RatingSchema>;

export const MetaSchema = z.object({
  runAt: z.string(),
  modelVersion: z.string(),
  backtest: z.record(z.unknown()).optional(),
});
export type Meta = z.infer<typeof MetaSchema>;

/** Honesty rule (CLAUDE.md): displayed probabilities are clamped to 1–99%. */
export function clampProb(p: number): number {
  return Math.min(0.99, Math.max(0.01, p));
}
