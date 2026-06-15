import type { HeartbeatPoint } from '@/lib/winprob';

// The "heartbeat chart": stacked win-probability bands over match minutes (home / draw / away),
// with goal-event markers. Pure SVG, presentational.

const W = 360;
const H = 120;
const FULL = 90;

const x = (minute: number) => (Math.min(minute, FULL) / FULL) * W;

function band(points: HeartbeatPoint[], lower: (p: HeartbeatPoint) => number, upper: (p: HeartbeatPoint) => number): string {
  if (points.length === 0) return '';
  const top = points.map((p) => `${x(p.minute).toFixed(1)},${(H * (1 - upper(p))).toFixed(1)}`);
  const bottom = points
    .slice()
    .reverse()
    .map((p) => `${x(p.minute).toFixed(1)},${(H * (1 - lower(p))).toFixed(1)}`);
  return `M${top.join(' L')} L${bottom.join(' L')} Z`;
}

export function WinProbChart({
  points,
  homeGoals,
  awayGoals,
}: {
  points: HeartbeatPoint[];
  homeGoals: number[];
  awayGoals: number[];
}) {
  const homeBand = band(points, () => 0, (p) => p.pHome);
  const drawBand = band(points, (p) => p.pHome, (p) => p.pHome + p.pDraw);
  const awayBand = band(points, (p) => p.pHome + p.pDraw, () => 1);
  const homeLine = points.map((p) => `${x(p.minute).toFixed(1)},${(H * (1 - p.pHome)).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Win probability over time">
      <path d={homeBand} fill="rgba(64,229,209,0.35)" />
      <path d={drawBand} fill="rgba(255,201,77,0.28)" />
      <path d={awayBand} fill="rgba(255,92,168,0.3)" />
      {homeLine && <polyline points={homeLine} fill="none" stroke="#40E5D1" strokeWidth={1.5} />}
      {/* half-time line */}
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="rgba(216,255,248,0.15)" strokeDasharray="3 3" />
      {/* goal markers */}
      {homeGoals.map((m, i) => (
        <line key={`h${i}`} x1={x(m)} y1={0} x2={x(m)} y2={H} stroke="#40E5D1" strokeWidth={1} opacity={0.7} />
      ))}
      {awayGoals.map((m, i) => (
        <line key={`a${i}`} x1={x(m)} y1={0} x2={x(m)} y2={H} stroke="#FF5CA8" strokeWidth={1} opacity={0.7} />
      ))}
    </svg>
  );
}
