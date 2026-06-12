import { NextResponse } from 'next/server';
import { hasActiveWindow, readSnapshot, refreshSnapshot } from '@/lib/live';

// The ONLY caller of external score APIs (PLAN.md §2). Vercel Cron hits this every
// minute; it exits instantly unless a match is live or within 30 min of kickoff.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();

  // Cheap gate: if the last snapshot shows nothing active, skip the hard poll. On a
  // cold cache we refresh once to learn the schedule.
  const cached = await readSnapshot();
  if (cached && !hasActiveWindow(cached, now)) {
    return NextResponse.json({ polled: false, reason: 'no active window', matches: cached.matches.length });
  }

  const snapshot = await refreshSnapshot(now);
  return NextResponse.json({
    polled: true,
    stale: snapshot.stale,
    matches: snapshot.matches.length,
    live: snapshot.matches.filter((m) => m.status === 'live').length,
  });
}
