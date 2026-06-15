import { ImageResponse } from 'next/og';
import { getSimulation } from '@/lib/oracle';

// Shareable OG card of the daily sim (PLAN.md §7 Phase 5). Generated from the committed
// simulation.json — $0, no external calls.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'WC26 Oracle — champion odds';

export default function OracleOgImage() {
  const sim = getSimulation();
  const top = sim.teams.slice(0, 5);
  const leader = top[0]?.pChampion || 1; // guard against an empty/placeholder artifact

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'radial-gradient(1000px 700px at 80% -10%, #0e2a3a, #030B10 60%)',
          color: '#D8FFF8',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: '#5E8B86' }}>
          THE ORACLE · WC26 · {sim.nRuns.toLocaleString()} SIMULATED TOURNAMENTS
        </div>
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, marginTop: 8, color: '#40E5D1' }}>
          Champion odds
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, gap: 16 }}>
          {top.map((t, i) => {
            const pct = Math.round(t.pChampion * 100);
            const width = Math.max(6, (t.pChampion / leader) * 760);
            const color = ['#40E5D1', '#54A9FF', '#8B6CFF', '#FF5CA8', '#FFC94D'][i];
            return (
              <div key={t.team} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', width: 320, fontSize: 38, fontWeight: 600 }}>{t.team}</div>
                <div style={{ display: 'flex', width, height: 30, background: color, borderRadius: 16 }} />
                <div style={{ display: 'flex', fontSize: 34, color, fontWeight: 700 }}>
                  {pct < 1 ? '<1' : pct}%
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', fontSize: 24, color: '#5E8B86' }}>
          Continental Chaos Board · we replayed the World Cup 10,000 times · free to run
        </div>
      </div>
    ),
    size,
  );
}
