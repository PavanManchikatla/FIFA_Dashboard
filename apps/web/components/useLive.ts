'use client';

import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '@/lib/types';
import { POLL_ACTIVE_MS, POLL_IDLE_MS, hasActiveWindow } from '@/lib/schedule';

// Polls /api/live with a DYNAMIC cadence (DEPLOY.md Step 3a): fast (~30s) when a match is
// live or near kickoff, slow (~5min) when idle — so we don't hammer the server/upstream
// outside live windows. The frontend only ever reads this endpoint, never an external API.
export function useLive() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let aborter: AbortController | null = null;

    const schedule = (delay: number) => {
      if (active) timer = setTimeout(tick, delay);
    };

    const tick = async () => {
      aborter?.abort();
      const ctrl = new AbortController();
      aborter = ctrl;
      try {
        const res = await fetch('/api/live', { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`live ${res.status}`);
        const data = (await res.json()) as LiveSnapshot;
        if (!active) return;
        setSnapshot(data);
        setError(null);
        schedule(hasActiveWindow(data, Date.now()) ? POLL_ACTIVE_MS : POLL_IDLE_MS);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || !active) return;
        setError((err as Error).message);
        // Recover quickly on transient errors rather than waiting out the idle cadence.
        schedule(POLL_ACTIVE_MS);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timer);
      aborter?.abort();
    };
  }, []);

  return { snapshot, error };
}
