'use client';

import { useMemo } from 'react';
import type { Match } from '@/lib/types';
import { buildTickerLines } from '@/lib/commentary';

// Template-powered marquee. Facts in (live matches), jokes out (commentary templates).
export function Ticker({ matches }: { matches: Match[] }) {
  const text = useMemo(() => {
    const lines = buildTickerLines(matches);
    return lines.join('   ///   ') + '   ///   ';
  }, [matches]);

  return (
    <div className="overflow-hidden whitespace-nowrap border-t border-line bg-bg py-[9px] font-mono text-[13px] text-ink-dim">
      <span className="ticker-roll">{text}</span>
    </div>
  );
}
