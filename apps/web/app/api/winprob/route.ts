import { NextResponse } from 'next/server';

// Analytic live in-match win probability (PLAN.md §4.4). Implemented in Phase 4 —
// remaining-time Poisson with Dixon-Coles intensities. Stubbed for now.
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    { error: 'not_implemented', phase: 4, detail: 'live win-prob lands in Phase 4' },
    { status: 501 },
  );
}
