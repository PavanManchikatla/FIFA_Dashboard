import Link from 'next/link';
import { getInsights, getMeta, getSimulation } from '@/lib/oracle';
import { renderInsight } from '@/lib/commentary';
import { ProbBar } from '@/components/ProbBar';
import { BracketDoom } from '@/components/BracketDoom';
import { GroupHeat } from '@/components/GroupHeat';
import { ModelCard } from '@/components/ModelCard';

// The Oracle (PLAN.md experience #3): champion-odds bars, group heat tables, Bracket of Doom,
// model card. Server-rendered from the committed ML artifacts via lib/oracle accessors.
export const metadata = { title: 'The Oracle // WC26' };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-[15px] font-medium uppercase tracking-[0.14em] text-cyan">
      {children}
    </h2>
  );
}

export default function OraclePage() {
  const sim = getSimulation();
  const meta = getMeta();
  const insights = getInsights();

  const top = sim.teams.slice(0, 16);
  const leader = top[0]?.pChampion ?? 1;
  const runDate = new Date(sim.runAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <main className="relative h-screen overflow-y-auto">
      <div className="holo-fx fixed" />
      <div className="relative z-[5] mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="holo-text-gradient font-display text-[clamp(22px,4vw,36px)] font-bold uppercase tracking-[0.12em] [filter:drop-shadow(0_0_18px_rgba(84,169,255,0.45))]">
              The Oracle <span className="text-gold [-webkit-text-fill-color:#FFC94D]">{'// WC26'}</span>
            </h1>
            <p className="mt-1 font-mono text-[12px] text-ink-dim">
              We played the whole tournament {sim.nRuns.toLocaleString()} times to see who wins · updated {runDate}
            </p>
          </div>
          <Link href="/map" className="holo-btn px-4 py-2 font-display text-[13px] uppercase tracking-[0.1em]">
            ← Holo map
          </Link>
        </header>

        {/* Insights */}
        {insights.length > 0 && (
          <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-2">
            {insights.map((ins) => (
              <div key={ins.id} className="holo-panel px-4 py-3 text-[13px] leading-relaxed text-ink">
                <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-ink-dim">
                  {ins.kind.replace(/_/g, ' ')}
                </span>
                {renderInsight(ins.templateId, ins.params)}
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Champion odds */}
          <section>
            <SectionTitle>Who wins it all?</SectionTitle>
            <div className="holo-panel space-y-[10px] p-4">
              {top.map((t) => (
                <ProbBar key={t.team} label={t.team} value={t.pChampion} max={leader} delta={t.dChampion24h} />
              ))}
              <p className="pt-1 font-mono text-[10px] text-ink-dim">
                chance of lifting the trophy · ▲▼ = change since yesterday
              </p>
            </div>
          </section>

          {/* Bracket of Doom */}
          <section>
            <SectionTitle>Bracket of Doom — how far each team gets</SectionTitle>
            <div className="holo-panel p-4">
              <BracketDoom teams={sim.teams.slice(0, 12)} />
              <p className="pt-2 font-mono text-[10px] text-ink-dim">
                chance of reaching each round (%) · darker = more likely
              </p>
            </div>
          </section>
        </div>

        {/* Group heat */}
        <section className="mt-8">
          <SectionTitle>Groups — who makes it out</SectionTitle>
          <GroupHeat groups={sim.groups} />
        </section>

        {/* Model card */}
        <section className="mt-8">
          <ModelCard meta={meta} />
        </section>

        <footer className="mt-10 pb-6 text-center font-mono text-[11px] text-ink-dim">
          probabilities are model estimates, not predictions · demo data clearly labelled · $0 infrastructure
        </footer>
      </div>
    </main>
  );
}
