// Analytic live in-match win probability (PLAN.md §4.4). No training data needed:
// remaining-time Poisson with the pre-match Dixon-Coles intensities (λ_home, λ_away),
// scaled by minutes left; the current score sets the state; a red card multiplies the
// opponent's λ by 1.35. Pure functions — fully unit-tested.

const FULL_TIME = 90;
const RED_CARD_BOOST = 1.35;
const MAX_FUTURE_GOALS = 8; // remaining goals beyond this are negligible

export type WinProb = { pHome: number; pDraw: number; pAway: number };

export type MatchState = {
  lambdaHome: number;
  lambdaAway: number;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  redHome?: number; // reds shown to the home team (boosts away λ)
  redAway?: number;
};

function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  // exp(k*ln λ − λ − ln k!)
  let logFact = 0;
  for (let i = 2; i <= k; i++) logFact += Math.log(i);
  return Math.exp(k * Math.log(lambda) - lambda - logFact);
}

/** P(home/draw/away) given the current state, integrating remaining-time Poisson goals. */
export function winProbAtState(s: MatchState): WinProb {
  const remaining = Math.max(0, (FULL_TIME - s.minute) / FULL_TIME);
  const effHome = s.lambdaHome * RED_CARD_BOOST ** (s.redAway ?? 0) * remaining;
  const effAway = s.lambdaAway * RED_CARD_BOOST ** (s.redHome ?? 0) * remaining;

  const pmfH = Array.from({ length: MAX_FUTURE_GOALS + 1 }, (_, x) => poissonPmf(x, effHome));
  const pmfA = Array.from({ length: MAX_FUTURE_GOALS + 1 }, (_, y) => poissonPmf(y, effAway));

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  for (let x = 0; x <= MAX_FUTURE_GOALS; x++) {
    for (let y = 0; y <= MAX_FUTURE_GOALS; y++) {
      const p = pmfH[x] * pmfA[y];
      const fh = s.scoreHome + x;
      const fa = s.scoreAway + y;
      if (fh > fa) pHome += p;
      else if (fh < fa) pAway += p;
      else pDraw += p;
    }
  }
  const total = pHome + pDraw + pAway || 1;
  return { pHome: pHome / total, pDraw: pDraw / total, pAway: pAway / total };
}

export type HeartbeatPoint = WinProb & { minute: number; scoreHome: number; scoreAway: number };

/**
 * Reconstruct the full in-game probability curve ("heartbeat") from the goal-minute timeline
 * — so a single live snapshot yields the whole curve, no per-minute storage needed.
 */
export function buildHeartbeat(args: {
  lambdaHome: number;
  lambdaAway: number;
  homeGoalMinutes: number[];
  awayGoalMinutes: number[];
  currentMinute: number;
  step?: number;
}): HeartbeatPoint[] {
  const step = args.step ?? 1;
  const end = Math.max(0, Math.min(FULL_TIME, args.currentMinute));
  const points: HeartbeatPoint[] = [];
  for (let m = 0; m <= end; m += step) {
    const scoreHome = args.homeGoalMinutes.filter((g) => g <= m).length;
    const scoreAway = args.awayGoalMinutes.filter((g) => g <= m).length;
    const wp = winProbAtState({ lambdaHome: args.lambdaHome, lambdaAway: args.lambdaAway, minute: m, scoreHome, scoreAway });
    points.push({ minute: m, scoreHome, scoreAway, ...wp });
  }
  return points;
}

// Per-team historical-trauma weight (0–1) — flavour for the Panic Index. Default 0.3.
const TRAUMA: Record<string, number> = {
  England: 0.9, // penalties
  Netherlands: 0.85, // three finals, no cup
  Mexico: 0.8, // the eternal Round-of-16 (now R32) curse
  Spain: 0.5,
  Germany: 0.4,
  Brazil: 0.7, // 7–1
  Argentina: 0.4,
};

export function traumaWeight(team: string): number {
  return TRAUMA[team] ?? 0.3;
}

/**
 * Panic Index (0–10) for a team in a live match (PLAN.md §4.6): rises with being behind, late
 * minutes, title stakes, and historical trauma. Drives the shaking gauge.
 */
export function panicIndex(args: {
  minute: number;
  myScore: number;
  oppScore: number;
  titleOdds: number; // that team's pChampion (0–1)
  trauma: number; // 0–1
}): number {
  const deficit = args.oppScore - args.myScore;
  // Being behind is bad even by one; drawing is uneasy; leading is mostly calm.
  const behind = deficit > 0 ? Math.min(1, 0.7 + 0.15 * deficit) : deficit === 0 ? 0.45 : 0.15;
  const time = Math.max(0, Math.min(1, args.minute / FULL_TIME));
  const timeAmp = 0.4 + 0.6 * time; // late minutes amplify the dread
  const stakes = Math.min(1, args.titleOdds * 3); // a ~33%+ favourite = full stakes
  // Core dread from scoreline×time, plus stakes/trauma that only bite when in danger.
  const raw = 0.8 * behind * timeAmp + (0.15 * stakes + 0.15 * args.trauma) * behind;
  return Math.round(Math.max(0, Math.min(1, raw)) * 100) / 10; // 0.0–10.0
}
