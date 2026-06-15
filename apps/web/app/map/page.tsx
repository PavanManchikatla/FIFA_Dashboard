import HoloMapClient from '@/components/HoloMapClient';
import { getInsights, getMatchProbs } from '@/lib/oracle';
import { renderInsight } from '@/lib/commentary';

// Holo hybrid map (PLAN.md experience #2): real basemap under a holographic MapLibre style,
// live stadium beacons, tile-failover broker. Oracle insights feed the ticker; pre-match odds
// (slim map, keeps the client bundle small) power the venue popup's head-to-head bar.
export default function MapPage() {
  const insightLines = getInsights().map((i) => renderInsight(i.templateId, i.params));

  const oddsByPair: Record<string, [number, number, number]> = {};
  for (const m of getMatchProbs()) {
    oddsByPair[`${m.home}|${m.away}`] = [m.pHome, m.pDraw, m.pAway];
  }

  return <HoloMapClient insightLines={insightLines} oddsByPair={oddsByPair} />;
}
