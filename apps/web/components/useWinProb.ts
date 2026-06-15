'use client';

import { useEffect, useState } from 'react';
import type { HeartbeatPoint, WinProb } from '@/lib/winprob';
import { POLL_ACTIVE_MS, POLL_IDLE_MS } from '@/lib/schedule';

export type WinProbResponse = {
  matchId: string;
  home: string;
  away: string;
  status: 'scheduled' | 'live' | 'finished';
  minute: number;
  scoreHome: number;
  scoreAway: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaSource: 'model' | 'default';
  current: WinProb;
  heartbeat: HeartbeatPoint[];
  stale: boolean;
};

// Polls /api/winprob for a match — fast while the match is live (so the curve updates within a
// poll cycle, the Phase-4 "done when"), slow otherwise. The browser only reads this endpoint.
export function useWinProb(matchId: string) {
  const [data, setData] = useState<WinProbResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aborter: AbortController | null = null;

    const tick = async () => {
      aborter?.abort();
      const ctrl = new AbortController();
      aborter = ctrl;
      try {
        const res = await fetch(`/api/winprob?matchId=${encodeURIComponent(matchId)}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`winprob ${res.status}`);
        const json = (await res.json()) as WinProbResponse;
        if (!active) return;
        setData(json);
        setError(null);
        timer = setTimeout(tick, json.status === 'live' ? POLL_ACTIVE_MS : POLL_IDLE_MS);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || !active) return;
        setError((err as Error).message);
        timer = setTimeout(tick, POLL_ACTIVE_MS);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
      aborter?.abort();
    };
  }, [matchId]);

  return { data, error };
}
