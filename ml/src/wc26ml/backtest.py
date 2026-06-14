"""Walk-forward backtest (PLAN.md §4.5) — the non-negotiable acceptance gate.

For each of WC 2010/2014/2018/2022: train on everything before the tournament, predict it,
and score log-loss + Brier against two baselines (uniform, Elo-only logistic). Acceptance:
the blended model beats the Elo-only baseline on log-loss in >=3 of 4 tournaments. Scores +
a calibration table are reported (and published into meta.json by publish.py).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from .ingest import load_matches
from .elo import run_elo
from .features import build_features
from .goals_model import DixonColes, blend, dc_proba_frame, fit_gbm, gbm_proba

WC_YEARS = (2010, 2014, 2018, 2022)
OUT_IDX = {"H": 0, "D": 1, "A": 2}
EPS = 1e-12


def log_loss(y_idx: np.ndarray, p: np.ndarray) -> float:
    p = np.clip(p, EPS, 1.0)
    return float(-np.mean(np.log(p[np.arange(len(y_idx)), y_idx])))


def brier(y_idx: np.ndarray, p: np.ndarray) -> float:
    onehot = np.zeros_like(p)
    onehot[np.arange(len(y_idx)), y_idx] = 1.0
    return float(np.mean(np.sum((p - onehot) ** 2, axis=1)))


def _elo_only(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Multinomial logistic on elo_diff alone — the Elo-only baseline."""
    clf = LogisticRegression(max_iter=1000)
    clf.fit(train[["elo_diff"]].to_numpy(), train["outcome"].to_numpy())
    proba = clf.predict_proba(test[["elo_diff"]].to_numpy())
    cls = list(clf.classes_)
    return proba[:, [cls.index(o) for o in ("H", "D", "A")]]


def _tune_weight(p_pois: np.ndarray, p_gbm: np.ndarray, y_idx: np.ndarray) -> float:
    best_w, best_ll = 0.5, np.inf
    for w in np.linspace(0.0, 1.0, 21):
        ll = log_loss(y_idx, blend(p_pois, p_gbm, w))
        if ll < best_ll:
            best_ll, best_w = ll, float(w)
    return best_w


def run_backtest(verbose: bool = True) -> dict:
    matches = load_matches()
    elo_aug, _ = run_elo(matches)
    feats = build_features(elo_aug)

    rows = []
    calib_p, calib_y = [], []  # home-win reliability across all tournaments
    for year in WC_YEARS:
        is_wc = (feats["tournament"] == "FIFA World Cup") & (feats["date"].dt.year == year)
        test = feats[is_wc]
        cutoff = test["date"].min()
        train = feats[feats["date"] < cutoff]
        y_idx = test["outcome"].map(OUT_IDX).to_numpy()

        # Models
        dc = DixonColes.fit(train, ref_date=cutoff)
        gbm = fit_gbm(train)

        # Tune blend weight on the last 2 years of training data.
        val = train[train["date"] >= cutoff - pd.Timedelta(days=730)]
        w = _tune_weight(dc_proba_frame(dc, val), gbm_proba(gbm, val),
                         val["outcome"].map(OUT_IDX).to_numpy())

        p_pois = dc_proba_frame(dc, test)
        p_gbm = gbm_proba(gbm, test)
        p_blend = blend(p_pois, p_gbm, w)
        p_uniform = np.full_like(p_blend, 1 / 3)
        p_elo = _elo_only(train, test)

        rows.append({
            "year": year, "n": len(test), "w": round(w, 2),
            "ll_uniform": log_loss(y_idx, p_uniform),
            "ll_elo": log_loss(y_idx, p_elo),
            "ll_blend": log_loss(y_idx, p_blend),
            "brier_elo": brier(y_idx, p_elo),
            "brier_blend": brier(y_idx, p_blend),
            "beats_elo": log_loss(y_idx, p_blend) < log_loss(y_idx, p_elo),
        })
        calib_p.append(p_blend[:, 0])
        calib_y.append((y_idx == 0).astype(float))

    results = pd.DataFrame(rows)
    wins = int(results["beats_elo"].sum())
    accepted = wins >= 3

    calib = _calibration_table(np.concatenate(calib_p), np.concatenate(calib_y))

    if verbose:
        print("\n=== Walk-forward backtest (log-loss; lower is better) ===")
        print(results.to_string(index=False))
        print(f"\nBlended beats Elo-only in {wins}/4 tournaments → "
              f"{'ACCEPTED ✅' if accepted else 'REJECTED ❌'} (need ≥3)")
        print("\n=== Calibration (blended P(home win)) ===")
        print(calib.to_string(index=False))

    return {
        "perTournament": results.to_dict(orient="records"),
        "blendBeatsEloCount": wins,
        "accepted": bool(accepted),
        "meanLogLoss": {
            "uniform": float(results["ll_uniform"].mean()),
            "eloOnly": float(results["ll_elo"].mean()),
            "blended": float(results["ll_blend"].mean()),
        },
        "calibration": calib.to_dict(orient="records"),
    }


def _calibration_table(p: np.ndarray, y: np.ndarray, bins: int = 5) -> pd.DataFrame:
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    rows = []
    for b in range(bins):
        mask = idx == b
        if mask.sum() == 0:
            continue
        rows.append({
            "bucket": f"{edges[b]:.1f}-{edges[b + 1]:.1f}",
            "n": int(mask.sum()),
            "predicted": round(float(p[mask].mean()), 3),
            "actual": round(float(y[mask].mean()), 3),
        })
    return pd.DataFrame(rows)


def main() -> None:
    res = run_backtest(verbose=True)
    raise SystemExit(0 if res["accepted"] else 1)


if __name__ == "__main__":
    main()
