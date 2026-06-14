# WC26 Continental Chaos Board

A live, funny, interactive 3D dashboard for the 2026 FIFA World Cup with a real ML
win-probability engine. Infrastructure cost target: **$0/month**.

See [PLAN.md](PLAN.md) for the architecture / data contracts / phased roadmap and
[CLAUDE.md](CLAUDE.md) for the working rules.

## Status

- ✅ **Phase 1 — Foundation**: monorepo scaffold, tile-broker + holo MapLibre style, `HoloMap`
  with live beacons fed by `/api/live` (wc26ir → cache, cache-aside + CDN-edge cached),
  template ticker. Real wc26ir + Upstash wired; public deploy (Vercel) postponed to post-phases.
- ✅ **Phase 2 — Oracle core**: Python ML — ingest (martj42) → Elo → Dixon-Coles + GBM blend →
  walk-forward backtest (accepted, beats Elo-only 3/4). Publishes `ratings.json`,
  `match_probs.json`, `meta.json`.
- ✅ **Phase 3 — Simulator + Oracle page**: 48-team Monte Carlo (`simulate.py`, exhaustive
  bracket tests) → `simulation.json` + `insights.json`; `/oracle` page with champion-odds bars,
  group heat tables, Bracket-of-Doom survival heatmap, and the honest model card.
- ⬜ Phase 4 — Live layer (in-match win prob, heartbeat chart, panic index)
- ⬜ Phase 5 — Polish (HoloLattice, cross-fade, SSE, OG cards)

## Quick start (web)

```bash
cd apps/web
npm install
npm run dev          # http://localhost:3000  → landing;  /map → holo hybrid map
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`.

## Mocks (Phase 1, no external creds)

Nothing talks to a real service yet. The data path is real, the *sources* are stubbed:

- `lib/cache.ts` — uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set,
  otherwise falls back to an in-process Map so the app runs locally with zero config.
- `lib/sources/wc26ir.ts` — returns fixtures from `mocks/` unless `WC26IR_BASE_URL` is set.
  Set `MOCK_LIVE_GOALS=1` to make a mock match tick goals over time so you can watch a
  beacon flip to amber and the score update on the map.
- Tile rendering uses **OpenFreeMap** (keyless, no quota). Add Stadia/MapTiler keys via
  `NEXT_PUBLIC_STADIA_KEY` / `NEXT_PUBLIC_MAPTILER_KEY` to enable failover tiers.

Copy `apps/web/.env.example` to `apps/web/.env.local` to override any of the above.

## ML (Phase 2+, not yet implemented)

```bash
cd ml
uv run pytest
```
