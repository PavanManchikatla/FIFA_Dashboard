"""Write JSON artifacts to apps/web/oracle-data/ (PLAN.md §5, §6). Phase 2+.

Emits ratings.json, match_probs.json, meta.json (with the backtest model card).
simulation.json + insights.json are produced in Phase 3. Shapes are FROZEN (PLAN.md §5)
and mirrored by the zod schemas in apps/web/lib/oracle.ts — change all three (here, the
schemas, PLAN.md) together (CLAUDE.md).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .backtest import run_backtest
from .elo import run_elo, ratings_table
from .features import build_features, build_fixture_features, latest_team_state
from .goals_model import DixonColes, blend, dc_proba_frame, fit_gbm, gbm_proba
from .ingest import derive_groups, load_matches, load_wc26_fixtures
from .insights import derive_insights
from .simulate import GROUP_LETTERS, GRID, _round_robin_pairs, simulate

ORACLE_DIR = Path(__file__).resolve().parents[3] / "apps" / "web" / "oracle-data"
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
        lam, mu = dc.intensities(row.home_team, row.away_team, bool(row.neutral))
        out.append({
            "matchId": f"wc26-2026-{i + 1:03d}",
            "home": row.home_team, "away": row.away_team,
            "kickoffUtc": pd.Timestamp(row.date).strftime("%Y-%m-%dT00:00:00Z"),
            "pHome": _clamp(ph), "pDraw": _clamp(pdraw), "pAway": _clamp(pa),
            "likelyScore": [int(hs), int(as_)],
            # Dixon-Coles expected goals — drive the live in-match win prob (PLAN.md §4.4).
            "lambdaHome": round(lam, 3), "lambdaAway": round(mu, 3),
            "modelVersion": MODEL_VERSION,
        })
    return out, w


def _read_prev_champion_probs() -> dict[str, float]:
    path = ORACLE_DIR / "simulation.json"
    if not path.exists():
        return {}
    try:
        prev = json.loads(path.read_text())
        return {t["team"]: t["pChampion"] for t in prev.get("teams", [])}
    except Exception:
        return {}


def build_simulation(matches: pd.DataFrame, n_runs: int = 10_000) -> dict:
    """Run the 10k Monte Carlo tournament and aggregate to the simulation.json contract.
    The simulator uses the Dixon-Coles SCORELINE model (the GBM blend only yields W/D/L,
    insufficient for goal-based group tiebreakers) — documented in meta.json."""
    elo_aug, _ = run_elo(matches)
    feats = build_features(elo_aug)
    dc = DixonColes.fit(feats, ref_date=feats["date"].max())

    fixtures = load_wc26_fixtures()
    group_names = derive_groups(fixtures)  # letter → [4 team names], from fixture graph
    teams = sorted(set(fixtures["home_team"]) | set(fixtures["away_team"]))
    idx = {t: i for i, t in enumerate(teams)}
    n_teams = len(teams)
    groups: dict[str, list[int]] = {ltr: [idx[t] for t in names] for ltr, names in group_names.items()}

    # Look up each group fixture by its (unordered) team pair.
    fx_by_pair = {frozenset((r.home_team, r.away_team)): r for r in fixtures.itertuples(index=False)}

    # Per-group scoreline distributions oriented to local (a-goals, b-goals).
    fixture_dists: dict[str, np.ndarray] = {}
    for letter, names in group_names.items():
        dists = np.zeros((6, GRID * GRID))
        for fi, (a, b) in enumerate(_round_robin_pairs(4)):
            ta, tb = names[a], names[b]
            fx = fx_by_pair[frozenset((ta, tb))]
            neutral = bool(fx.neutral)
            if fx.home_team == ta:
                mat = dc.score_matrix(ta, tb, neutral)            # [ta goals, tb goals]
            else:
                mat = dc.score_matrix(tb, ta, neutral).T          # transpose → [ta, tb]
            dists[fi] = mat.ravel()
        fixture_dists[letter] = dists

    # Knockout advance matrix (neutral): P(i beats j) = P(win in 90') + P(draw)·0.5.
    advance = np.zeros((n_teams, n_teams))
    for i, ti in enumerate(teams):
        for j, tj in enumerate(teams):
            if i == j:
                continue
            ph, pdr, _pa = dc.predict_proba(ti, tj, neutral=True)
            advance[i, j] = ph + pdr * 0.5

    res = simulate(groups, fixture_dists, advance, n_teams=n_teams, n_runs=n_runs, seed=0)
    rc = res["reached_counts"]
    n = res["n_runs"]
    prev = _read_prev_champion_probs()

    def prob(counts, i):
        return round(float(counts[i]) / n, 4)

    team_sims = []
    for i, t in enumerate(teams):
        p_champ = prob(rc["Champion"], i)
        team_sims.append({
            "team": t,
            "pGroup": prob(rc["group"], i),
            "pR32": prob(rc["R32"], i),
            "pR16": prob(rc["R16"], i),
            "pQF": prob(rc["QF"], i),
            "pSF": prob(rc["SF"], i),
            "pFinal": prob(rc["Final"], i),
            "pChampion": p_champ,
            "dChampion24h": round(p_champ - prev.get(t, p_champ), 4),
        })
    team_sims.sort(key=lambda x: x["pChampion"], reverse=True)

    # Per-group placement distribution (for the group heat tables).
    pc = res["place_counts"]
    groups_out: dict[str, list[dict]] = {}
    for gi, letter in enumerate(GROUP_LETTERS):
        rows = []
        for local, t in enumerate(group_names[letter]):
            p1, p2, p3, p4 = (round(float(pc[gi, local, k]) / n, 4) for k in range(4))
            rows.append({"team": t, "p1": p1, "p2": p2, "p3": p3, "p4": p4,
                         "pAdvance": round(p1 + p2, 4)})
        rows.sort(key=lambda x: (x["p1"], x["pAdvance"]), reverse=True)
        groups_out[letter] = rows

    return {
        "runAt": pd.Timestamp(matches["date"].max()).strftime("%Y-%m-%dT00:00:00Z"),
        "modelVersion": MODEL_VERSION,
        "nRuns": n,
        "teams": team_sims,
        "groups": groups_out,
    }


def write_json(name: str, data) -> None:
    ORACLE_DIR.mkdir(parents=True, exist_ok=True)
    (ORACLE_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"  wrote apps/web/oracle-data/{name}")


def main(run_backtest_for_card: bool = True) -> None:
    matches = load_matches()
    run_at = pd.Timestamp(matches["date"].max()).strftime("%Y-%m-%dT00:00:00Z")

    print("Publishing oracle artifacts …")
    ratings = build_ratings(matches)
    write_json("ratings.json", ratings)
    probs, w = build_match_probs(matches)
    write_json("match_probs.json", probs)

    print("  simulating 10k tournaments …")
    simulation = build_simulation(matches)
    write_json("simulation.json", simulation)
    write_json("insights.json", derive_insights(simulation, ratings, simulation["runAt"]))

    backtest = run_backtest(verbose=False) if run_backtest_for_card else None
    meta = {
        "runAt": run_at,
        "modelVersion": MODEL_VERSION,
        "blendWeightPoisson": round(w, 2),
        "matchProbCount": len(probs),
        "backtest": backtest,
        "note": "Group-stage match probs from Elo + Dixon-Coles + GBM blend. "
                "Knockout paths + champion odds come from the simulator (Phase 3).",
        # Plain-language for the public model card (general audience). Technical detail lives
        # in elo.py / PLAN.md / CLAUDE.md, not here.
        "knownLimitations": [
            "Draws don't move our team ratings as much as they probably should — a known rough "
            "edge we plan to improve.",
            "Knockout matchups are an approximation of FIFA's exact bracket rules.",
            "Kick-off times are shown by date only for now.",
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
