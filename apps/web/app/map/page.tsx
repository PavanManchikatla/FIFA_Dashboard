import HoloMapClient from '@/components/HoloMapClient';
import { getInsights } from '@/lib/oracle';
import { renderInsight } from '@/lib/commentary';

// Holo hybrid map (PLAN.md experience #2): real basemap under a holographic MapLibre
// style, live stadium beacons, multi-provider tile failover broker. Oracle insights (rendered
// server-side from the committed artifacts) feed the ticker.
export default function MapPage() {
  const insightLines = getInsights().map((i) => renderInsight(i.templateId, i.params));
  return <HoloMapClient insightLines={insightLines} />;
}
