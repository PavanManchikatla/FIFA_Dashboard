'use client';

import Link from 'next/link';
import type { Match, Stadium } from '@/lib/types';
import { venueQuip } from '@/lib/commentary';

function matchLine(match: Match | null): { text: string; live: boolean } {
  if (!match) return { text: 'NO FIXTURE SCHEDULED', live: false };
  if (match.status === 'live') {
    return {
      text: `LIVE · ${match.home} ${match.homeScore ?? 0}–${match.awayScore ?? 0} ${match.away} · ${match.minute ?? 0}′`,
      live: true,
    };
  }
  if (match.status === 'finished') {
    return { text: `FT · ${match.home} ${match.homeScore ?? 0}–${match.awayScore ?? 0} ${match.away}`, live: false };
  }
  const ko = new Date(match.kickoffUtc).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
  return { text: `${ko} UTC · ${match.home} vs ${match.away}${match.group ? ` · GROUP ${match.group}` : ''}`, live: false };
}

export function VenueCard({
  stadium,
  match,
  onClose,
}: {
  stadium: Stadium;
  match: Match | null;
  onClose: () => void;
}) {
  const line = matchLine(match);
  return (
    <aside
      aria-live="polite"
      className="holo-panel absolute bottom-4 left-4 z-[6] w-80 max-w-[calc(100%-2rem)] px-[18px] py-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="absolute right-[10px] top-2 border-none bg-transparent text-[15px] text-ink-dim"
      >
        ✕
      </button>
      <div className="font-mono text-[11px] tracking-[0.2em] text-ink-dim">{'// VENUE FEED'}</div>
      <div className="holo-text-gradient pr-6 pt-2 font-display text-[16px] font-medium uppercase tracking-[0.08em]">
        {stadium.name}
      </div>
      <div className="mt-[3px] text-[13px] text-ink-dim">
        {stadium.city}, {stadium.country}
      </div>
      <div className="mt-3 border-t border-line pt-[10px] font-mono text-[13px]">
        <span className={line.live ? 'text-amber [text-shadow:0_0_8px_rgba(255,177,59,0.6)]' : ''}>{line.text}</span>
      </div>
      <div className="mt-[10px] text-[14px] leading-[1.5] text-ink-dim">{venueQuip(stadium.id)}</div>
      {match && (
        <Link
          href={`/match/${encodeURIComponent(match.id)}`}
          className="mt-3 inline-block font-mono text-[12px] uppercase tracking-[0.12em] text-cyan hover:text-mint"
        >
          View match feed →
        </Link>
      )}
    </aside>
  );
}
