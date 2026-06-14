import numpy as np
import pandas as pd

from wc26ml.elo import INITIAL_ELO, run_elo
from wc26ml.features import FEATURE_COLUMNS, build_features
from wc26ml.goals_model import DixonColes, blend


def _synthetic() -> pd.DataFrame:
    # A dominant team (Alpha) beats everyone; ratings should reflect that.
    rows = []
    teams = ["Alpha", "Bravo", "Charlie", "Delta"]
    date = pd.Timestamp("2015-01-01")
    for i in range(40):
        h, a = teams[i % 4], teams[(i + 1) % 4]
        hs, as_ = (3, 0) if h == "Alpha" else (0, 2) if a == "Alpha" else (1, 1)
        rows.append({
            "date": date + pd.Timedelta(days=7 * i), "home_team": h, "away_team": a,
            "home_score": hs, "away_score": as_, "tournament": "Friendly",
            "importance": "friendly", "neutral": False,
            "outcome": "H" if hs > as_ else "A" if hs < as_ else "D",
        })
    return pd.DataFrame(rows)


def test_run_elo_is_leakfree_and_ranks_dominant_team():
    df = _synthetic()
    aug, ratings = run_elo(df)
    # First match: both teams start at the initial rating (no leakage from the future).
    assert aug.iloc[0]["home_elo_pre"] == INITIAL_ELO
    assert aug.iloc[0]["away_elo_pre"] == INITIAL_ELO
    # Alpha keeps winning → highest rating.
    assert max(ratings, key=ratings.get) == "Alpha"


def test_build_features_has_columns_and_no_nans():
    aug, _ = run_elo(_synthetic())
    feats = build_features(aug)
    for col in FEATURE_COLUMNS:
        assert col in feats.columns
    assert not feats[FEATURE_COLUMNS].isna().any().any()
    # First-ever match has no prior form → 0.
    assert feats.iloc[0]["home_form"] == 0.0


def test_dixoncoles_probs_are_a_distribution():
    df = _synthetic()
    dc = DixonColes.fit(df, ref_date=df["date"].max())
    ph, pd_, pa = dc.predict_proba("Alpha", "Bravo", neutral=True)
    assert abs(ph + pd_ + pa - 1.0) < 1e-6
    assert ph > pa  # Alpha is much stronger
    hs, as_ = dc.likely_score("Alpha", "Bravo", neutral=True)
    assert hs >= as_


def test_blend_normalizes_rows():
    a = np.array([[0.6, 0.3, 0.1], [0.2, 0.2, 0.6]])
    b = np.array([[0.4, 0.4, 0.2], [0.3, 0.3, 0.4]])
    out = blend(a, b, 0.5)
    assert np.allclose(out.sum(axis=1), 1.0)
