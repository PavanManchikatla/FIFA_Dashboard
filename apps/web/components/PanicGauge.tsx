// Panic Index gauge (PLAN.md §4.6) — shakes harder the higher the panic. Presentational.

export function PanicGauge({ team, panic }: { team: string; panic: number }) {
  const level = Math.max(0, Math.min(10, panic));
  const pct = level * 10;
  // Shake amplitude scales with panic; calm (<2) doesn't move. Honors reduced-motion via CSS.
  const intensity = level >= 2 ? Math.min(2.5, level / 4) : 0;
  const color = level >= 7 ? '#FF5CA8' : level >= 4 ? '#FFB13B' : '#5CFFB1';

  return (
    <div className="holo-panel px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="truncate text-[13px] text-ink" title={team}>
          {team}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-dim">panic</span>
      </div>
      <div
        className="mt-2 font-display text-[28px] font-bold tabular-nums"
        style={{
          color,
          textShadow: `0 0 12px ${color}88`,
          animation: intensity > 0 ? `panic-shake ${0.5 - intensity * 0.12}s linear infinite` : undefined,
        }}
      >
        {level.toFixed(1)}
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full border border-line bg-[rgba(2,9,13,0.6)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}
