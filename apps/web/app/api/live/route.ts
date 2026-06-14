import { NextResponse } from 'next/server';
import { getLive } from '@/lib/live';

// Frontend reads live data here — never from external APIs directly (PLAN.md §2).
// Cache-first; refreshes once on a cold cache so the first page load has data.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getLive();
  // CDN edge cache so a traffic spike can't fan out to the function/Redis: the edge serves
  // most polls and the backend sees ~1 hit per window per region, independent of viewer
  // count. stale-while-revalidate keeps responses instant while refreshing. Live scores
  // tolerate this (the client polls every 30s). A degraded (stale-from-upstream) snapshot
  // gets a shorter window so the edge doesn't pin it.
  const cacheControl = snapshot.stale
    ? 'public, s-maxage=5, stale-while-revalidate=15'
    : 'public, s-maxage=15, stale-while-revalidate=45';
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': cacheControl } });
}
