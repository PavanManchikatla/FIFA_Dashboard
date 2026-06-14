import type { Meta } from '@/lib/oracle';

// Honest model card (CLAUDE.md): backtest scores, calibration, and what the model can't know.

type Backtest = {
  accepted?: boolean;
  blendBeatsEloCount?: number;
  meanLogLoss?: { uniform: number; eloOnly: number; blended: number };
  calibration?: { bucket: string; n: number; predicted: number; actual: number }[];
};

export function ModelCard({ meta }: { meta: Meta }) {
  const bt = (meta.backtest ?? {}) as Backtest;
  const ll = bt.meanLogLoss;
  const limitations = ((meta as Record<string, unknown>).knownLimitations as string[]) ?? [];

  return (
    <div className="holo-panel space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-[15px] font-medium uppercase tracking-[0.12em] text-cyan">
          Model card
        </h3>
        {bt.accepted != null && (
          <span
            className={`rounded-full border px-3 py-[2px] font-mono text-[11px] uppercase tracking-wider ${
              bt.accepted ? 'border-mint/50 text-mint' : 'border-magenta/50 text-magenta'
            }`}
          >
            backtest {bt.accepted ? 'accepted' : 'pending'}
            {bt.blendBeatsEloCount != null ? ` · beats Elo ${bt.blendBeatsEloCount}/4` : ''}
          </span>
        )}
        <span className="font-mono text-[11px] text-ink-dim">{meta.modelVersion}</span>
      </div>

      {ll && (
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
            walk-forward log-loss (lower is better)
          </div>
          <div className="flex gap-4 font-mono text-[13px]">
            <span className="text-ink-dim">uniform {ll.uniform.toFixed(3)}</span>
            <span className="text-ink-dim">elo-only {ll.eloOnly.toFixed(3)}</span>
            <span className="text-mint">blended {ll.blended.toFixed(3)}</span>
          </div>
        </div>
      )}

      {bt.calibration && bt.calibration.length > 0 && (
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
            calibration — predicted vs actual P(home win)
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px]">
            {bt.calibration.map((c) => (
              <span key={c.bucket} className="rounded border border-line px-2 py-1 text-ink-dim">
                {c.bucket}: <span className="text-cyan">{(c.predicted * 100).toFixed(0)}</span>/
                <span className="text-azure">{(c.actual * 100).toFixed(0)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-dim">
          what this model can&apos;t know
        </div>
        <p className="text-[13px] leading-relaxed text-ink-dim">
          Red cards, injuries, weather, motivation, and the sheer chaos of knockout football.
          Probabilities are clamped to 1–99% on single matches; nothing here is a guarantee.
        </p>
        {limitations.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-ink-dim/90">
            {limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
