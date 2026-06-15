import { NextResponse } from 'next/server';
import { getLive } from '@/lib/live';
import { getMatchProbs } from '@/lib/oracle';
import { buildHeartbeat, winProbAtState } from '@/lib/winprob';
import type { Match } from '@/lib/types';

// Analytic live in-match win probability (PLAN.md §4.4). Reads the live match state from the
// cache and the pre-match Dixon-Coles intensities from the published match_probs, then
// computes the current P(H/D/A) and the full heartbeat curve. The browser polls this; nothing
// external is called here.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fallback intensities when a fixture isn't in match_probs (e.g. a knockout not yet drawn).
const DEFAULT_LAMBDA = { home: 1.3, away: 1.1 };

function lambdaFor(match: Match): { lambdaHome: number; lambdaAway: number; source: 'model' | 'default' } {
  const probs = getMatchProbs();
  const exact = probs.find((p) => p.home === match.home && p.away === match.away);
  if (exact?.lambdaHome != null && exact.lambdaAway != null) {
    return { lambdaHome: exact.lambdaHome, lambdaAway: exact.lambdaAway, source: 'model' };
  }
  const reversed = probs.find((p) => p.home === match.away && p.away === match.home);
  if (reversed?.lambdaHome != null && reversed.lambdaAway != null) {
    return { lambdaHome: reversed.lambdaAway, lambdaAway: reversed.lambdaHome, source: 'model' };
  }
  return { lambdaHome: DEFAULT_LAMBDA.home, lambdaAway: DEFAULT_LAMBDA.away, source: 'default' };
}

export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get('matchId');
  if (!matchId) {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 });
  }

  const snapshot = await getLive();
  const match = snapshot.matches.find((m) => m.id === matchId);
  if (!match) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }

  const { lambdaHome, lambdaAway, source } = lambdaFor(match);
  const scoreHome = match.homeScore ?? 0;
  const scoreAway = match.awayScore ?? 0;
  const minute = match.status === 'finished' ? 90 : match.minute ?? 0;

  const current = winProbAtState({ lambdaHome, lambdaAway, minute, scoreHome, scoreAway });
  const heartbeat = buildHeartbeat({
    lambdaHome,
    lambdaAway,
    homeGoalMinutes: match.homeGoalMinutes,
    awayGoalMinutes: match.awayGoalMinutes,
    currentMinute: minute,
  });

  return NextResponse.json(
    {
      matchId,
      home: match.home,
      away: match.away,
      status: match.status,
      minute,
      scoreHome,
      scoreAway,
      lambdaHome,
      lambdaAway,
      lambdaSource: source,
      current,
      heartbeat,
      stale: snapshot.stale,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=45' } },
  );
}
