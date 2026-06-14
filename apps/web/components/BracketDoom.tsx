import type { TeamSim } from '@/lib/oracle';

// "Bracket of Doom" — a survival heatmap: each team's probability of REACHING each knockout
// round, R32 → Champion. Honest + data-driven (the exact pairings vary per simulated run, so
// a per-round survival funnel is truer than a single fabricated bracket).

const COLUMNS: { key: keyof TeamSim; label: string }[] = [
  { key: 'pGroup', label: 'R32' },
  { key: 'pR16', label: 'R16' },
  { key: 'pQF', label: 'QF' },
  { key: 'pSF', label: 'SF' },
  { key: 'pFinal', label: 'Final' },
  { key: 'pChampion', label: '🏆' },
];

function cellStyle(p: number): React.CSSProperties {
  // Fade from transparent → cyan→violet as probability rises.
  const a = Math.max(0.04, Math.min(0.9, p));
  return { backgroundColor: `rgba(84, 169, 255, ${a})` };
}

function fmt(p: number): string {
  const pct = p * 100;
  if (pct < 1) return '';
  return pct >= 10 ? `${pct.toFixed(0)}` : `${pct.toFixed(0)}`;
}

export function BracketDoom({ teams }: { teams: TeamSim[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-center font-mono text-[12px]">
        <thead>
          <tr className="text-ink-dim">
            <th className="w-32 text-left font-normal" />
            {COLUMNS.map((c) => (
              <th key={c.label} className="px-1 font-normal uppercase tracking-wider">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.team}>
              <td className="truncate pr-2 text-left text-[13px] text-ink" title={t.team}>
                {t.team}
              </td>
              {COLUMNS.map((c) => {
                const p = t[c.key] as number;
                return (
                  <td
                    key={c.label}
                    className="rounded-[3px] px-1 py-[5px] text-ink"
                    style={cellStyle(p)}
                  >
                    {fmt(p)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
