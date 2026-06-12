import { NextResponse } from 'next/server';
import { getLive } from '@/lib/live';

// Frontend reads live data here — never from external APIs directly (PLAN.md §2).
// Cache-first; refreshes once on a cold cache so the first page load has data.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = await getLive();
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
