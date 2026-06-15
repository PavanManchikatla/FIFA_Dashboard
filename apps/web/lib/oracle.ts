import { z } from 'zod';

// Frozen JSON contracts (PLAN.md §5). Changing these requires updating the Python
// publishers (ml/src/wc26ml/publish.py) and PLAN.md in the same commit (CLAUDE.md).
// The ML pipeline (Phase 2+) writes these to apps/web/oracle-data/; these schemas validate
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
  // Dixon-Coles expected goals — drive the live analytic win prob (PLAN.md §4.4). Optional
  // so older artifacts still validate.
  lambdaHome: z.number().optional(),
  lambdaAway: z.number().optional(),
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

export const MetaSchema = z
  .object({
    runAt: z.string(),
    modelVersion: z.string(),
    backtest: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();
export type Meta = z.infer<typeof MetaSchema>;

// simulation.json (PLAN.md §4.3): per-team round probabilities + per-group placement dist.
export const GroupRowSchema = z.object({
  team: z.string(),
  p1: z.number(),
  p2: z.number(),
  p3: z.number(),
  p4: z.number(),
  pAdvance: z.number(),
});
export type GroupRow = z.infer<typeof GroupRowSchema>;

export const SimulationSchema = z.object({
  runAt: z.string(),
  modelVersion: z.string(),
  nRuns: z.number(),
  teams: z.array(TeamSimSchema),
  groups: z.record(z.array(GroupRowSchema)),
});
export type Simulation = z.infer<typeof SimulationSchema>;

/** Honesty rule (CLAUDE.md): displayed probabilities are clamped to 1–99%. */
export function clampProb(p: number): number {
  return Math.min(0.99, Math.max(0.01, p));
}

// ---- typed accessors over the committed ML artifacts (PLAN.md §2) ----------------
// Static imports: resolved at build time, so a daily commit of fresh JSON → redeploy →
// fresh page (PLAN.md §6). The artifacts live inside apps/web (oracle-data/) so the Vercel
// build — rooted at apps/web — can import them without reaching outside the root directory.
import simulationJson from '../oracle-data/simulation.json';
import insightsJson from '../oracle-data/insights.json';
import matchProbsJson from '../oracle-data/match_probs.json';
import ratingsJson from '../oracle-data/ratings.json';
import metaJson from '../oracle-data/meta.json';

export const getSimulation = (): Simulation => SimulationSchema.parse(simulationJson);
export const getInsights = (): Insight[] => z.array(InsightSchema).parse(insightsJson);
export const getMatchProbs = (): MatchProb[] => z.array(MatchProbSchema).parse(matchProbsJson);
export const getRatings = (): Rating[] => z.array(RatingSchema).parse(ratingsJson);
export const getMeta = (): Meta => MetaSchema.parse(metaJson);
