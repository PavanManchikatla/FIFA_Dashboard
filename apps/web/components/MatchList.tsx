'use client';

import type { Match } from '@/lib/types';

function MiniFlag({ url }: { url: string | null }) {
  if (!url) return <span className="inline-block w-[20px] text-center text-[12px]" aria-hidden>🏳️</span>;
  // eslint-disable-next-line @next/next/no-img-element -- external flag CDN
  return <img src={url} alt="" className="h-[13px] w-[20px] shrink-0 rounded-[2px] object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

function Row({ m, onSelect }: { m: Match; onSelect: (m: Match) => void }) {
  const right =
    m.status === 'live'
      ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}  ${m.minute ?? 0}′`
      : m.status === 'finished'
        ? `${m.homeScore ?? 0}–${m.awayScore ?? 0}`
        : timeLabel(m.kickoffUtc);
  return (
    <button
      type="button"
      onClick={() => onSelect(m)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-cyan/10"
    >
      <MiniFlag url={m.homeFlag} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
        {m.home} <span className="text-ink-dim">v</span> {m.away}
      </span>
      <MiniFlag url={m.awayFlag} />
      <span className={`shrink-0 font-mono text-[11px] ${m.status === 'live' ? 'text-amber' : 'text-ink-dim'}`}>
        {right}
      </span>
    </button>
  );
}

function Section({ title, matches, accent, onSelect }: { title: string; matches: Match[]; accent: string; onSelect: (m: Match) => void }) {
  if (matches.length === 0) return null;
  return (
    <div className="mb-3">
      <div className={`mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.2em] ${accent}`}>
        {title} · {matches.length}
      </div>
      {matches.map((m) => (
        <Row key={m.id} m={m} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function MatchList({ matches, onSelect, emptyNote }: { matches: Match[]; onSelect: (m: Match) => void; emptyNote?: string }) {
  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc));
  const finished = matches.filter((m) => m.status === 'finished');

  return (
    <div className="thin-scroll h-full overflow-y-auto pr-1">
      {matches.length === 0 ? (
        <p className="px-2 py-4 font-mono text-[12px] text-ink-dim">{emptyNote ?? 'no matches yet…'}</p>
      ) : (
        <>
          <Section title="Live now" matches={live} accent="text-amber" onSelect={onSelect} />
          <Section title="Upcoming" matches={upcoming} accent="text-cyan" onSelect={onSelect} />
          <Section title="Finished" matches={finished} accent="text-ink-dim" onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
