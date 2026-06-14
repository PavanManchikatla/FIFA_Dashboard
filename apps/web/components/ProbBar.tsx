// Holographic probability bar (server component — presentational only).

function fmtPct(value: number): string {
  const pct = value * 100;
  if (pct > 0 && pct < 1) return '<1%';
  if (pct > 99 && pct < 100) return '>99%';
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function ProbBar({
  label,
  value,
  max = 1,
  delta,
}: {
  label: string;
  value: number;
  max?: number;
  delta?: number;
}) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const showDelta = typeof delta === 'number' && Math.abs(delta) >= 0.001;
  const up = (delta ?? 0) > 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-[13px] text-ink" title={label}>
        {label}
      </div>
      <div className="relative h-[10px] flex-1 overflow-hidden rounded-full border border-line bg-[rgba(2,9,13,0.6)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-holo-accent [box-shadow:0_0_10px_rgba(84,169,255,0.5)]"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-12 shrink-0 text-right font-mono text-[13px] text-cyan">{fmtPct(value)}</div>
      <div className="w-12 shrink-0 text-right font-mono text-[11px]">
        {showDelta ? (
          <span className={up ? 'text-mint' : 'text-magenta'}>
            {up ? '▲' : '▼'}
            {Math.abs(delta! * 100).toFixed(1)}
          </span>
        ) : (
          <span className="text-ink-dim">—</span>
        )}
      </div>
    </div>
  );
}
