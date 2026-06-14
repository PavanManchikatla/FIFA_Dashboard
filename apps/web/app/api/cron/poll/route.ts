import { NextResponse } from 'next/server';
import { refreshSnapshot } from '@/lib/live';

// Daily housekeeping (DEPLOY.md Step 3a). Hobby cron is daily-only, so this no longer drives
// live updates — live refresh happens cache-aside inside /api/live during live windows.
// This run just warms the cache / refreshes fixtures once a day so the first viewer is fast.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Protect against public abuse: when CRON_SECRET is set (Vercel), require the matching
  // bearer Vercel Cron sends. Unset (local dev) → open.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const snapshot = await refreshSnapshot();
  return NextResponse.json({
    warmed: true,
    stale: snapshot.stale,
    matches: snapshot.matches.length,
    live: snapshot.matches.filter((m) => m.status === 'live').length,
  });
}
