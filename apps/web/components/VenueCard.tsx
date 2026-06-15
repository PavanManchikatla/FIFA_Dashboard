'use client';

import Link from 'next/link';
import type { Match, Stadium } from '@/lib/types';
import { venueQuip } from '@/lib/commentary';

function Flag({ url, alt }: { url: string | null; alt: string }) {
  if (!url) return <span className="text-[18px]" aria-hidden>🏳️</span>;
  // eslint-disable-next-line @next/next/no-img-element -- external flag CDN, no optimization needed
  return <img src={url} alt={alt} className="h-[18px] w-[26px] rounded-[2px] object-cover" onError={(e) => ((e.currentTarget.style.display = 'none'))} />;
}

function statusLine(match: Match | null): { text: string; live: boolean } {
  if (!match) return { text: 'NO FIXTURE SCHEDULED', live: false };
  if (match.status === 'live') return { text: `LIVE · ${match.minute ?? 0}′`, live: true };
  if (match.status === 'finished') return { text: 'FULL TIME', live: false };
  const ko = new Date(match.kickoffUtc).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });
  return { text: `${ko} UTC${match.group ? ` · GROUP ${match.group}` : ''}`, live: false };
}

export function VenueCard({
  stadium,
  match,
  odds,
  onClose,
}: {
  stadium: Stadium;
  match: Match | null;
  odds?: [number, number, number];
  onClose: () => void;
}) {
  const line = statusLine(match);
  const showScore = match && match.status !== 'scheduled';
  const pct = (p: number) => (p * 100 < 1 ? '<1' : Math.round(p * 100));

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
      <div className="font-mono text-[11px] tracking-[0.2em] text-ink-dim">{stadium.name.toUpperCase()}</div>
      <div className="mt-[2px] text-[12px] text-ink-dim">
        {stadium.city}, {stadium.country}
      </div>

      {match ? (
        <>
          {/* Teams with flags */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Flag url={match.homeFlag} alt={match.home} />
              <span className="truncate text-[14px] font-semibold text-ink">{match.home}</span>
            </div>
            <span className="shrink-0 font-display text-[18px] font-bold tabular-nums text-ink">
              {showScore ? `${match.homeScore ?? 0}–${match.awayScore ?? 0}` : 'vs'}
            </span>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate text-[14px] font-semibold text-ink">{match.away}</span>
              <Flag url={match.awayFlag} alt={match.away} />
            </div>
          </div>

          <div className={`mt-2 font-mono text-[12px] ${line.live ? 'text-amber' : 'text-ink-dim'}`}>
            {line.text}
          </div>

          {/* Pre-match head-to-head odds bar */}
          {odds && (
            <div className="mt-3">
              <div className="flex h-[7px] w-full overflow-hidden rounded-full border border-line">
                <div className="bg-cyan/60" style={{ width: `${odds[0] * 100}%` }} />
                <div className="bg-gold/40" style={{ width: `${odds[1] * 100}%` }} />
                <div className="bg-magenta/60" style={{ width: `${odds[2] * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-dim">
                <span className="text-cyan">{pct(odds[0])}%</span>
                <span className="text-gold">draw {pct(odds[1])}%</span>
                <span className="text-magenta">{pct(odds[2])}%</span>
              </div>
            </div>
          )}

          <Link
            href={`/match/${encodeURIComponent(match.id)}`}
            className="mt-3 inline-block font-mono text-[12px] uppercase tracking-[0.12em] text-cyan hover:text-mint"
          >
            View match feed →
          </Link>
        </>
      ) : (
        <div className="mt-3 text-[13px] leading-[1.5] text-ink-dim">{venueQuip(stadium.id)}</div>
      )}
    </aside>
  );
}
