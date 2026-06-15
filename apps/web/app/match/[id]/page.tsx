import { getSimulation } from '@/lib/oracle';
import { MatchView } from '@/components/MatchView';

// Match detail (PLAN.md): live score, in-match win-prob heartbeat, Panic Index gauges.
// Server component supplies each team's title odds (for the panic stakes); MatchView polls
// /api/winprob client-side so the curve updates within a poll cycle during a live match.
export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  // Match ids contain a colon (e.g. "wc26ir:1"); Next leaves the route segment URL-encoded,
  // so decode here to avoid MatchView double-encoding it for the /api/winprob query.
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const titleOdds: Record<string, number> = {};
  for (const t of getSimulation().teams) titleOdds[t.team] = t.pChampion;

  return (
    <main className="relative h-screen overflow-y-auto">
      <div className="holo-fx fixed" />
      <div className="relative z-[5] mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-6 holo-text-gradient font-display text-[clamp(18px,3vw,28px)] font-bold uppercase tracking-[0.12em] [filter:drop-shadow(0_0_16px_rgba(84,169,255,0.4))]">
          Match feed <span className="text-gold [-webkit-text-fill-color:#FFC94D]">{'// WC26'}</span>
        </h1>
        <MatchView matchId={id} titleOdds={titleOdds} />
      </div>
    </main>
  );
}
