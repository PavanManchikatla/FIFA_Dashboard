import type { GroupRow } from '@/lib/oracle';

// Group heat tables: per group, each team's P(advance) as a heat bar (PLAN.md §3 Oracle page).

function heat(p: number): React.CSSProperties {
  const a = Math.max(0.05, Math.min(0.85, p));
  return { backgroundColor: `rgba(92, 255, 177, ${a})` }; // mint = likely to advance
}

function GroupTable({ letter, rows }: { letter: string; rows: GroupRow[] }) {
  return (
    <div className="holo-panel p-3">
      <div className="mb-2 font-display text-[13px] font-medium uppercase tracking-[0.12em] text-cyan">
        Group {letter}
      </div>
      <div className="space-y-[6px]">
        {rows.map((r) => (
          <div key={r.team} className="flex items-center gap-2">
            <div className="w-24 shrink-0 truncate text-[12px] text-ink" title={r.team}>
              {r.team}
            </div>
            <div className="relative h-[8px] flex-1 overflow-hidden rounded-full border border-line bg-[rgba(2,9,13,0.6)]">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${r.pAdvance * 100}%`, ...heat(r.pAdvance) }} />
            </div>
            <div className="w-9 shrink-0 text-right font-mono text-[11px] text-ink-dim">
              {Math.round(r.pAdvance * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupHeat({ groups }: { groups: Record<string, GroupRow[]> }) {
  const letters = Object.keys(groups).sort();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {letters.map((letter) => (
        <GroupTable key={letter} letter={letter} rows={groups[letter]} />
      ))}
    </div>
  );
}
