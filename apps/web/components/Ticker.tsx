'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Match } from '@/lib/types';
import { buildTickerLines } from '@/lib/commentary';

const PX_PER_SEC = 70; // constant scroll speed regardless of content length

// Template-powered marquee. Facts in (live matches + Oracle insights), jokes out (commentary
// templates). Duration is derived from the rendered width so the speed stays constant — a fixed
// CSS duration made a long slate whip by very fast.
export function Ticker({ matches, insightLines = [] }: { matches: Match[]; insightLines?: string[] }) {
  const text = useMemo(() => {
    const lines = [...insightLines, ...buildTickerLines(matches)];
    return lines.join('   ///   ') + '   ///   ';
  }, [matches, insightLines]);

  const spanRef = useRef<HTMLSpanElement>(null);
  const [duration, setDuration] = useState(40);

  useEffect(() => {
    const measure = () => {
      const w = spanRef.current?.scrollWidth ?? 0;
      // scrollWidth includes the padding-left:100% lead-in; constant px/s → consistent feel.
      setDuration(Math.max(20, Math.round(w / PX_PER_SEC)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  return (
    <div className="relative overflow-hidden whitespace-nowrap bg-bg/70 py-[9px] font-mono text-[13px] text-ink-dim backdrop-blur before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-holo-accent before:opacity-50 before:content-['']">
      <span ref={spanRef} className="ticker-roll" style={{ animationDuration: `${duration}s` }}>
        {text}
      </span>
    </div>
  );
}
