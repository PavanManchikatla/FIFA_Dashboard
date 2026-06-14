"""Pre-match model: Dixon-Coles bivariate Poisson + GBM blend (PLAN.md §4.2). Phase 2.

Two models combined:
  1. Dixon-Coles: per-team attack/defence + home effect, time-decay weighted MLE → full
     scoreline distribution → P(H/D/A) and most-likely score.
  2. HistGradientBoosting classifier on Elo/form/rest features → P(H/D/A).
Blend: p = w·poisson + (1-w)·gbm, with w chosen on a validation slice by log-loss.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln
from sklearn.ensemble import HistGradientBoostingClassifier

from .features import FEATURE_COLUMNS, feature_matrix

HALF_LIFE_DAYS = 730.0  # ~2 years
MAX_GOALS = 10
OUTCOMES = ("H", "D", "A")


def _decay_weights(dates: pd.Series, ref_date: pd.Timestamp) -> np.ndarray:
    age = (ref_date - dates).dt.days.to_numpy(dtype=float)
    return np.power(0.5, age / HALF_LIFE_DAYS)


def _dc_tau(x, y, lam, mu, rho):
    """Dixon-Coles low-score dependence correction (vectorized over matches)."""
    tau = np.ones_like(lam, dtype=float)
    m00 = (x == 0) & (y == 0)
    m01 = (x == 0) & (y == 1)
    m10 = (x == 1) & (y == 0)
    m11 = (x == 1) & (y == 1)
    tau = np.where(m00, 1.0 - lam * mu * rho, tau)
    tau = np.where(m01, 1.0 + lam * rho, tau)
    tau = np.where(m10, 1.0 + mu * rho, tau)
    tau = np.where(m11, 1.0 - rho, tau)
    return tau


@dataclass
class DixonColes:
    teams: list[str]
    attack: np.ndarray
    defence: np.ndarray
    home_adv: float
    rho: float

    _index: dict[str, int] | None = None

    def __post_init__(self) -> None:
        self._index = {t: i for i, t in enumerate(self.teams)}

    # ---- fit ----
    @classmethod
    def fit(cls, matches: pd.DataFrame, ref_date: pd.Timestamp, weight_floor: float = 1e-3) -> "DixonColes":
        w_all = _decay_weights(matches["date"], ref_date)
        keep = w_all >= weight_floor
        m = matches.loc[keep]
        w = w_all[keep]

        teams = sorted(set(m["home_team"]) | set(m["away_team"]))
        idx = {t: i for i, t in enumerate(teams)}
        n = len(teams)

        hi = m["home_team"].map(idx).to_numpy()
        ai = m["away_team"].map(idx).to_numpy()
        x = m["home_score"].to_numpy(dtype=float)
        y = m["away_score"].to_numpy(dtype=float)
        is_home = (~m["neutral"].astype(bool)).to_numpy(dtype=float)
        # Constant log-factorial terms (dropped from optimisation, irrelevant to argmax).

        def neg_loglik(params: np.ndarray) -> float:
            atk = params[:n]
            dfc = params[n:2 * n]
            gamma = params[2 * n]
            rho = params[2 * n + 1]
            lam = np.exp(atk[hi] - dfc[ai] + gamma * is_home)
            mu = np.exp(atk[ai] - dfc[hi])
            tau = _dc_tau(x, y, lam, mu, rho)
            tau = np.clip(tau, 1e-10, None)
            ll = np.log(tau) + x * np.log(lam) - lam + y * np.log(mu) - mu
            pen = 1.0 * (atk.mean() ** 2 + dfc.mean() ** 2)  # identifiability anchor
            return -np.sum(w * ll) + pen

        p0 = np.concatenate([np.zeros(n), np.zeros(n), [0.25, -0.05]])
        bounds = [(-3, 3)] * (2 * n) + [(-1, 1), (-0.2, 0.2)]
        res = minimize(neg_loglik, p0, method="L-BFGS-B", bounds=bounds,
                       options={"maxiter": 200, "maxfun": 20000})
        p = res.x
        return cls(teams=teams, attack=p[:n], defence=p[n:2 * n], home_adv=float(p[2 * n]),
                   rho=float(p[2 * n + 1]))

    # ---- predict ----
    def _strength(self, team: str) -> tuple[float, float]:
        i = self._index.get(team)  # type: ignore[union-attr]
        if i is None:
            return 0.0, 0.0  # unseen team → league-average
        return float(self.attack[i]), float(self.defence[i])

    def score_matrix(self, home: str, away: str, neutral: bool) -> np.ndarray:
        ah, dh = self._strength(home)
        aa, da = self._strength(away)
        lam = np.exp(ah - da + (0.0 if neutral else self.home_adv))
        mu = np.exp(aa - dh)
        gk = np.arange(MAX_GOALS + 1)
        # Independent Poisson pmfs then DC-correct the four low-score cells.
        log_px = gk * np.log(lam) - lam - gammaln(gk + 1)
        log_py = gk * np.log(mu) - mu - gammaln(gk + 1)
        mat = np.exp(log_px)[:, None] * np.exp(log_py)[None, :]
        for (xx, yy) in [(0, 0), (0, 1), (1, 0), (1, 1)]:
            mat[xx, yy] *= _dc_tau(np.array([xx]), np.array([yy]),
                                   np.array([lam]), np.array([mu]), self.rho)[0]
        return mat / mat.sum()

    def predict_proba(self, home: str, away: str, neutral: bool) -> tuple[float, float, float]:
        mat = self.score_matrix(home, away, neutral)
        ph = float(np.tril(mat, -1).sum())  # home goals > away goals
        pa = float(np.triu(mat, 1).sum())
        pd_ = float(np.trace(mat))
        return ph, pd_, pa

    def likely_score(self, home: str, away: str, neutral: bool) -> tuple[int, int]:
        mat = self.score_matrix(home, away, neutral)
        i, j = np.unravel_index(int(np.argmax(mat)), mat.shape)
        return int(i), int(j)


# ---- GBM ----
def fit_gbm(train: pd.DataFrame) -> HistGradientBoostingClassifier:
    clf = HistGradientBoostingClassifier(
        max_iter=300, learning_rate=0.05, max_depth=4, l2_regularization=1.0,
        validation_fraction=0.1, random_state=0,
    )
    clf.fit(feature_matrix(train), train["outcome"].to_numpy())
    return clf


def gbm_proba(clf: HistGradientBoostingClassifier, df: pd.DataFrame) -> np.ndarray:
    """Return P in (H, D, A) column order regardless of the classifier's class order."""
    proba = clf.predict_proba(feature_matrix(df))
    cls = list(clf.classes_)
    cols = [cls.index(o) for o in OUTCOMES]
    return proba[:, cols]


def dc_proba_frame(model: DixonColes, df: pd.DataFrame) -> np.ndarray:
    out = np.empty((len(df), 3))
    for k, row in enumerate(df.itertuples(index=False)):
        out[k] = model.predict_proba(row.home_team, row.away_team, bool(row.neutral))
    return out


def blend(p_poisson: np.ndarray, p_gbm: np.ndarray, w: float) -> np.ndarray:
    p = w * p_poisson + (1.0 - w) * p_gbm
    return p / p.sum(axis=1, keepdims=True)
