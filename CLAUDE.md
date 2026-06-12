# CLAUDE.md — WC26 Continental Chaos Board

Read PLAN.md first. It is the source of truth for architecture, data contracts, and phases.
Work phase by phase; do not start a later phase before the current one's "Done when" passes.

## Project rules

- **$0 infrastructure is a hard constraint.** No paid APIs, no inference servers, no GPUs.
  ML runs offline in GitHub Actions and publishes static JSON to `public/oracle/`.
- **The frontend never calls external APIs.** All external data flows through
  `apps/web/app/api/cron/poll` → Redis, or through the ML pipeline → `public/oracle/`.
- **JSON contracts in PLAN.md §5 are frozen.** Changing them requires updating the zod
  schemas in `apps/web/lib/oracle.ts`, the Python publishers in `ml/src/wc26ml/publish.py`,
  and PLAN.md in the same commit.
- **Honesty in the UI**: every probability shown links to the model card; demo/mock data is
  always labeled; displayed probabilities are clamped to 1–99%.
- The comedy voice lives ONLY in `apps/web/lib/commentary.ts` templates (TypeScript).
  Python emits facts (`insights.json` params), never jokes.

## Stack

- Web: Next.js 15 (App Router), TypeScript strict, react-map-gl/maplibre,
  react-three-fiber + drei + postprocessing (bloom), Tailwind. Deployed on Vercel.
- Cache: Upstash Redis (free tier, 10k commands/day — budget every new key).
- ML: Python 3.11, pandas, numpy, scipy, scikit-learn, xgboost (optional), pytest.
- Visual spec: `prototypes/*.html` — match their look when porting (colors, fonts,
  scanlines, beacon behavior). Fonts: Orbitron / Rajdhani / Share Tech Mono.
  Palette: bg #030B10, cyan #40E5D1, azure #54A9FF, mint #5CFFB1, amber #FFB13B (live).

## Commands

- Web: `cd apps/web && npm run dev | npm run lint | npm run typecheck | npm test`
- ML: `cd ml && uv run pytest`, `uv run python -m wc26ml.backtest`,
  `uv run python -m wc26ml.publish`
- Never commit secrets. Keys live in `.env.local` (web) and GitHub Actions secrets (ml).
  Tile keys (Stadia/MapTiler) are domain-restricted and may ship client-side; everything
  else stays server-side.

## Testing expectations

- Simulator bracket routing (groups → third-place allocation → R32 paths) must have
  exhaustive unit tests before being trusted; this is the highest-risk code in the repo.
- `normalize.ts` adapters need fixture-based tests (one recorded raw payload per source).
- Backtest acceptance (PLAN.md §4.5) gates any model change: a PR that worsens log-loss
  on the walk-forward suite does not merge.

## Source data gotchas

- worldcup26.ir is community-run: tolerate timeouts, keep last-good cache with a stale
  flag, never let a fetch failure crash the poll route.
- martj42 dataset: team names need canonicalization (e.g. "USA"/"United States");
  maintain `ml/src/wc26ml/team_names.py` as the single mapping.
- API-Football: 100 req/day hard cap — increment a Redis counter before every call and
  refuse politely at 95.
