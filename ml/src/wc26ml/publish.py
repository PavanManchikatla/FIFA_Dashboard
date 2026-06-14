"""Write JSON artifacts to public/oracle/ (PLAN.md §5, §6). Phase 2+.

Emits ratings.json, match_probs.json, meta.json (with the backtest model card).
simulation.json + insights.json are produced in Phase 3. Shapes are FROZEN (PLAN.md §5)
and mirrored by the zod schemas in apps/web/lib/oracle.ts — change all three (here, the
schemas, PLAN.md) together (CLAUDE.md).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from .backtest import run_backtest
from .elo import run_elo, ratings_table
from .features import build_features, build_fixture_features, latest_team_state
from .goals_model import DixonColes, blend, dc_proba_frame, fit_gbm, gbm_proba
from .ingest import load_matches, load_wc26_fixtures

ORACLE_DIR = Path(__file__).resolve().parents[3] / "public" / "oracle"
MODEL_VERSION = "elo+dc+gbm-0.1.0"

# Honesty rule (CLAUDE.md): displayed probabilities clamp to 1–99%. We clamp at the source
# too so no published number implies false certainty.
def _clamp(p: float) -> float:
    return round(min(0.99, max(0.01, float(p))), 4)


def _tune_weight(p_pois, p_gbm, y_idx) -> float:
    import numpy as np
    from .backtest import log_loss
    best_w, best = 0.5, float("inf")
    for w in np.linspace(0, 1, 21):
        ll = log_loss(y_idx, blend(p_pois, p_gbm, w))
        if ll < best:
            best, best_w = ll, float(w)
    return best_w


def build_ratings(matches: pd.DataFrame) -> list[dict]:
    _, ratings_now = run_elo(matches)
    cutoff = matches["date"].max() - pd.Timedelta(days=7)
    _, ratings_prev = run_elo(matches[matches["date"] <= cutoff])
    table = ratings_table(ratings_now)
    out = []
    for row in table.itertuples(index=False):
        prev = ratings_prev.get(row.team, 1500.0)
        out.append({
            "team": row.team, "elo": round(float(row.elo), 1), "rank": int(row.rank),
            "delta_7d": round(float(row.elo) - prev, 1),
        })
    return out


def build_match_probs(matches: pd.DataFrame) -> list[dict]:
    from .backtest import OUT_IDX
    elo_aug, ratings = run_elo(matches)
    feats = build_features(elo_aug)
    dc = DixonColes.fit(feats, ref_date=feats["date"].max())
    gbm = fit_gbm(feats)

    # Tune the blend weight on in-distribution (World Cup) validation — matches the
    # backtest methodology so published probs use the same blend.
    val = feats[(feats["tournament"] == "FIFA World Cup") &
                (feats["date"] >= feats["date"].max() - pd.Timedelta(days=365 * 16))]
    if len(val) < 64:
        val = feats[feats["date"] >= feats["date"].max() - pd.Timedelta(days=730)]
    w = _tune_weight(dc_proba_frame(dc, val), gbm_proba(gbm, val),
                     val["outcome"].map(OUT_IDX).to_numpy())

    fixtures = load_wc26_fixtures()
    state = latest_team_state(matches)
    fx = build_fixture_features(fixtures, ratings, state, ref_date=matches["date"].max())

    p = blend(dc_proba_frame(dc, fx), gbm_proba(gbm, fx), w)
    out = []
    for i, row in enumerate(fixtures.itertuples(index=False)):
        ph, pdraw, pa = p[i]
        hs, as_ = dc.likely_score(row.home_team, row.away_team, bool(row.neutral))
        out.append({
            "matchId": f"wc26-2026-{i + 1:03d}",
            "home": row.home_team, "away": row.away_team,
            "kickoffUtc": pd.Timestamp(row.date).strftime("%Y-%m-%dT00:00:00Z"),
            "pHome": _clamp(ph), "pDraw": _clamp(pdraw), "pAway": _clamp(pa),
            "likelyScore": [int(hs), int(as_)],
            "modelVersion": MODEL_VERSION,
        })
    return out, w


def write_json(name: str, data) -> None:
    ORACLE_DIR.mkdir(parents=True, exist_ok=True)
    (ORACLE_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  wrote public/oracle/{name}")


def main(run_backtest_for_card: bool = True) -> None:
    matches = load_matches()
    run_at = pd.Timestamp(matches["date"].max()).strftime("%Y-%m-%dT00:00:00Z")

    print("Publishing oracle artifacts …")
    write_json("ratings.json", build_ratings(matches))
    probs, w = build_match_probs(matches)
    write_json("match_probs.json", probs)

    backtest = run_backtest(verbose=False) if run_backtest_for_card else None
    meta = {
        "runAt": run_at,
        "modelVersion": MODEL_VERSION,
        "blendWeightPoisson": round(w, 2),
        "matchProbCount": len(probs),
        "backtest": backtest,
        "note": "Group-stage match probs from Elo + Dixon-Coles + GBM blend. "
                "Knockout paths + champion odds come from the simulator (Phase 3).",
        "knownLimitations": [
            "Elo uses the frozen ln(|gd|+1) MOV term, which is 0 for draws → drawn matches "
            "do not move ratings. Documented; revisit with a model improvement (see elo.py).",
            "Match kickoff times are date-only from the source; precise UTC times TBD.",
        ],
    }
    write_json("meta.json", meta)
    print(f"Done. modelVersion={MODEL_VERSION}, {len(probs)} match probs, "
          f"backtest accepted={backtest['accepted'] if backtest else 'skipped'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish oracle JSON artifacts")
    parser.add_argument("--no-backtest", action="store_true", help="skip the model-card backtest")
    args = parser.parse_args()
    main(run_backtest_for_card=not args.no_backtest)
