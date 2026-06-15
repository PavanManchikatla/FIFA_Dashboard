'use client';

import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '@/lib/types';
import { POLL_ACTIVE_MS, POLL_IDLE_MS, hasActiveWindow } from '@/lib/schedule';

// Live snapshot via SSE with automatic fallback to CDN-cached polling (PLAN.md §7 Phase 5).
// Prefers the push stream; if SSE errors before any message (unsupported / blocked / serverless
// limits), it permanently falls back to polling — the robust $0 default. Drop-in for useLive.
export function useLiveStream() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let gotMessage = false;

    const startPolling = () => {
      if (polling) return;
      polling = true;
      const tick = async () => {
        try {
          const res = await fetch('/api/live', { cache: 'no-store' });
          if (!res.ok) throw new Error(`live ${res.status}`);
          const data = (await res.json()) as LiveSnapshot;
          if (!active) return;
          setSnapshot(data);
          setError(null);
          const fast = data.stale || data.matches.length === 0 || hasActiveWindow(data, Date.now());
          pollTimer = setTimeout(tick, fast ? POLL_ACTIVE_MS : POLL_IDLE_MS);
        } catch (err) {
          if (!active) return;
          setError((err as Error).message);
          pollTimer = setTimeout(tick, POLL_ACTIVE_MS);
        }
      };
      tick();
    };

    // SSE holds a serverless function per client, which doesn't fit Vercel Hobby — so polling
    // (CDN-cached, scalable) is the default. Opt into SSE only where the runtime sustains
    // connections cheaply, via NEXT_PUBLIC_ENABLE_SSE=1.
    if (process.env.NEXT_PUBLIC_ENABLE_SSE !== '1' || typeof EventSource === 'undefined') {
      startPolling();
      return () => {
        active = false;
        clearTimeout(pollTimer);
      };
    }

    try {
      es = new EventSource('/api/live/stream');
      es.onmessage = (ev) => {
        if (!active) return;
        try {
          setSnapshot(JSON.parse(ev.data) as LiveSnapshot);
          setError(null);
          gotMessage = true;
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        // If we never received a message, SSE isn't usable here → fall back for good.
        // If we had messages, this is just the bounded stream closing; EventSource reconnects.
        if (!gotMessage) {
          es?.close();
          es = null;
          startPolling();
        }
      };
    } catch {
      startPolling();
    }

    return () => {
      active = false;
      es?.close();
      clearTimeout(pollTimer);
    };
  }, []);

  return { snapshot, error };
}
