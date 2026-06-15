'use client';

import { useMemo } from 'react';
import type { Match } from '@/lib/types';
import { buildTickerLines } from '@/lib/commentary';

// Template-powered marquee. Facts in (live matches + Oracle insights), jokes out
// (commentary templates).
export function Ticker({ matches, insightLines = [] }: { matches: Match[]; insightLines?: string[] }) {
  const text = useMemo(() => {
    const lines = [...insightLines, ...buildTickerLines(matches)];
    return lines.join('   ///   ') + '   ///   ';
  }, [matches, insightLines]);

  return (
    <div className="relative overflow-hidden whitespace-nowrap bg-bg/70 py-[9px] font-mono text-[13px] text-ink-dim backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-holo-accent before:opacity-50 before:content-['']">
      <span className="ticker-roll">{text}</span>
    </div>
  );
}
