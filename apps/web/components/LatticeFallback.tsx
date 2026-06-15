'use client';

import { useMemo } from 'react';
import { STADIUMS } from '@/lib/stadiums';
import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from '@/lib/geo';
import { useLive } from './useLive';

// Pure-CSS fallback for the holo lattice (no WebGL): the 16 venues placed geographically as
// glowing beacons over a perspective grid. Shown when WebGL is unavailable or drops its
// context (low-end / headless GPUs), so the landing never degrades to a black void.
export function LatticeFallback() {
  const { snapshot } = useLive();
  const liveIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of snapshot?.matches ?? []) if (m.status === 'live' && m.stadiumId) set.add(m.stadiumId);
    return set;
  }, [snapshot]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* perspective grid */}
      <div
        className="absolute inset-x-0 bottom-0 top-1/3 opacity-40"
        style={{
          background:
            'linear-gradient(rgb(var(--c-cyan) / 0.12) 1px, transparent 1px) 0 0/44px 44px,' +
            'linear-gradient(90deg, rgb(var(--c-cyan) / 0.12) 1px, transparent 1px) 0 0/44px 44px',
          transform: 'perspective(520px) rotateX(58deg)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(to top, #000 30%, transparent)',
        }}
      />
      {/* venue beacons, placed by lat/lon */}
      <div className="absolute inset-x-[8%] inset-y-[14%]">
        {STADIUMS.map((s) => {
          const left = ((s.lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100;
          const top = (1 - (s.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100;
          const live = liveIds.has(s.id);
          return (
            <div
              key={s.id}
              className={`beacon absolute${live ? ' live' : ''}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-hidden
            />
          );
        })}
      </div>
    </div>
  );
}
