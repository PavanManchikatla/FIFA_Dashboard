# WC26 Continental Chaos Board

A live, funny, interactive 3D dashboard for the 2026 FIFA World Cup with a real ML
win-probability engine. Infrastructure cost target: **$0/month**.

See [PLAN.md](PLAN.md) for the architecture / data contracts / phased roadmap and
[CLAUDE.md](CLAUDE.md) for the working rules.

## Status

- ✅ **Phase 1 — Foundation**: monorepo scaffold, tile-broker + holo MapLibre style ported
  to `apps/web/lib`, `HoloMap` with live stadium beacons fed by `/api/live` (backed by the
  `wc26ir` poller), template-driven ticker. **Runs entirely on mock data** — no external
  services wired yet (see "Mocks" below).
- ⬜ Phase 2 — Oracle core (Python ML: ingest → elo → goals_model → backtest)
- ⬜ Phase 3 — Simulator + Oracle page
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
