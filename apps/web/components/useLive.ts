'use client';

import { useEffect, useRef, useState } from 'react';
import type { LiveSnapshot } from '@/lib/types';

// Polls /api/live on an interval. The frontend only ever reads this endpoint —
// never an external API (PLAN.md §2). 30s in production; faster when demoing mock
// goals so the beacon flip is visible within a poll cycle (Phase 1 done-when).
const DEFAULT_INTERVAL_MS = 30_000;

export function useLive(intervalMs: number = DEFAULT_INTERVAL_MS) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      aborter.current?.abort();
      const ctrl = new AbortController();
      aborter.current = ctrl;
      try {
        const res = await fetch('/api/live', { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`live ${res.status}`);
        const data = (await res.json()) as LiveSnapshot;
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active && (err as Error).name !== 'AbortError') {
          setError((err as Error).message);
        }
      }
    };

    poll();
    const timer = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
      aborter.current?.abort();
    };
  }, [intervalMs]);

  return { snapshot, error };
}
