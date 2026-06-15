'use client';

import Link from 'next/link';
import { useWinProb } from './useWinProb';
import { WinProbChart } from './WinProbChart';
import { PanicGauge } from './PanicGauge';
import { panicIndex, traumaWeight } from '@/lib/winprob';

function StatusBadge({ status, minute }: { status: string; minute: number }) {
  if (status === 'live') {
    return <span className="rounded-full border border-amber/60 px-3 py-[2px] font-mono text-[11px] uppercase tracking-widest text-amber [text-shadow:0_0_8px_rgba(255,177,59,0.6)]">live · {minute}&apos;</span>;
  }
  if (status === 'finished') {
    return <span className="rounded-full border border-line px-3 py-[2px] font-mono text-[11px] uppercase tracking-widest text-ink-dim">full time</span>;
  }
  return <span className="rounded-full border border-line px-3 py-[2px] font-mono text-[11px] uppercase tracking-widest text-ink-dim">upcoming</span>;
}

function pct(p: number) {
  const v = p * 100;
  return v < 1 ? '<1%' : `${v.toFixed(0)}%`;
}

export function MatchView({ matchId, titleOdds }: { matchId: string; titleOdds: Record<string, number> }) {
  const { data, error } = useWinProb(matchId);

  if (error && !data) {
    return <p className="font-mono text-sm text-magenta">Couldn&apos;t load this match ({error}).</p>;
  }
  if (!data) {
    return <p className="font-mono text-sm text-ink-dim">loading match…</p>;
  }

  const { home, away, scoreHome, scoreAway, minute, status, current, heartbeat } = data;
  const showScore = status !== 'scheduled';
  const homePanic = panicIndex({ minute, myScore: scoreHome, oppScore: scoreAway, titleOdds: titleOdds[home] ?? 0, trauma: traumaWeight(home) });
  const awayPanic = panicIndex({ minute, myScore: scoreAway, oppScore: scoreHome, titleOdds: titleOdds[away] ?? 0, trauma: traumaWeight(away) });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={status} minute={minute} />
        <Link href="/map" className="holo-btn px-4 py-2 font-display text-[12px] uppercase tracking-[0.1em]">
          ← Holo map
        </Link>
      </div>

      {/* Scoreline */}
      <div className="holo-panel grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6 text-center">
        <div className="holo-text-gradient font-display text-[clamp(16px,3vw,26px)] font-bold uppercase tracking-[0.06em]">
          {home}
        </div>
        <div className="font-display text-[clamp(24px,5vw,40px)] font-bold tabular-nums text-ink">
          {showScore ? `${scoreHome} – ${scoreAway}` : 'vs'}
        </div>
        <div className="holo-text-gradient font-display text-[clamp(16px,3vw,26px)] font-bold uppercase tracking-[0.06em]">
          {away}
        </div>
      </div>

      {/* Current win probability */}
      <div className="holo-panel p-4">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          chance of winning {data.lambdaSource === 'default' ? '(rough estimate — limited data for this match)' : ''}
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-full border border-line">
          <div className="flex items-center justify-center bg-cyan/40 text-[11px] text-ink" style={{ width: `${current.pHome * 100}%` }}>
            {current.pHome >= 0.12 ? pct(current.pHome) : ''}
          </div>
          <div className="flex items-center justify-center bg-gold/30 text-[11px] text-ink" style={{ width: `${current.pDraw * 100}%` }}>
            {current.pDraw >= 0.12 ? pct(current.pDraw) : ''}
          </div>
          <div className="flex items-center justify-center bg-magenta/40 text-[11px] text-ink" style={{ width: `${current.pAway * 100}%` }}>
            {current.pAway >= 0.12 ? pct(current.pAway) : ''}
          </div>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-dim">
          <span className="text-cyan">{home} {pct(current.pHome)}</span>
          <span className="text-gold">draw {pct(current.pDraw)}</span>
          <span className="text-magenta">{away} {pct(current.pAway)}</span>
        </div>
      </div>

      {/* Heartbeat */}
      <div className="holo-panel p-4">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-widest text-ink-dim">
          heartbeat — how the win chance moved
        </div>
        <WinProbChart points={heartbeat} homeGoals={data.heartbeat.length ? heartbeatGoalMins(heartbeat, 'home') : []} awayGoals={heartbeatGoalMins(heartbeat, 'away')} />
      </div>

      {/* Panic gauges */}
      <div className="grid grid-cols-2 gap-3">
        <PanicGauge team={home} panic={homePanic} />
        <PanicGauge team={away} panic={awayPanic} />
      </div>

      <p className="text-center font-mono text-[11px] text-ink-dim">
        live estimate from each team&apos;s scoring rate and the clock · not a guarantee
      </p>
    </div>
  );
}

// Derive goal minutes from the heartbeat (where the score steps up) for the chart markers.
function heartbeatGoalMins(points: { minute: number; scoreHome: number; scoreAway: number }[], side: 'home' | 'away'): number[] {
  const key = side === 'home' ? 'scoreHome' : 'scoreAway';
  const mins: number[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i][key] > points[i - 1][key]) mins.push(points[i].minute);
  }
  return mins;
}
