"""Feature builder (PLAN.md §4.2). Phase 2.

Adds leak-free features to the Elo-augmented match table for the gradient-boosting model:
recent form (rolling goal diff), rest days, neutral flag, and an ordinal importance. Elo
columns (home_elo_pre/away_elo_pre/elo_diff) come from elo.run_elo upstream.

All rolling/temporal features use only PAST matches (shift before rolling) so a match never
sees its own result or anything after it.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .elo import HOME_ADVANTAGE, INITIAL_ELO

FORM_WINDOW = 10
REST_CAP_DAYS = 30.0

IMPORTANCE_ORDINAL = {"friendly": 0, "qualifier": 1, "continental": 2, "world_cup": 3}

# Columns fed to the GBM (home-perspective). Kept here so train/predict stay in sync.
FEATURE_COLUMNS = [
    "elo_diff",
    "home_elo_pre",
    "away_elo_pre",
    "form_diff",
    "rest_diff",
    "neutral",
    "importance_ord",
]


def _team_perspective_rows(matches: pd.DataFrame) -> pd.DataFrame:
    """Two rows per match (home view + away view) for per-team rolling stats."""
    idx = matches.index.to_numpy()
    home = pd.DataFrame({
        "mid": idx, "team": matches["home_team"].to_numpy(), "date": matches["date"].to_numpy(),
        "gd": (matches["home_score"] - matches["away_score"]).to_numpy(), "side": "home",
    })
    away = pd.DataFrame({
        "mid": idx, "team": matches["away_team"].to_numpy(), "date": matches["date"].to_numpy(),
        "gd": (matches["away_score"] - matches["home_score"]).to_numpy(), "side": "away",
    })
    return pd.concat([home, away], ignore_index=True)


def build_features(matches: pd.DataFrame) -> pd.DataFrame:
    """Return `matches` plus the FEATURE_COLUMNS (and keeps date/teams/outcome/importance)."""
    df = matches.copy()

    long = _team_perspective_rows(df).sort_values(["team", "date"]).reset_index(drop=True)
    g = long.groupby("team", sort=False)
    # Rolling mean of PAST goal diffs (shift(1) excludes the current match). transform
    # guarantees the result is index-aligned back to `long` (no reordering surprises).
    long["form"] = g["gd"].transform(
        lambda s: s.shift(1).rolling(FORM_WINDOW, min_periods=1).mean()
    ).fillna(0.0)
    # Days since the team's previous match, capped (groupby.diff preserves index alignment).
    rest = g["date"].diff().dt.days.astype("float")
    long["rest"] = rest.fillna(REST_CAP_DAYS).clip(upper=REST_CAP_DAYS)

    home_rows = long[long["side"] == "home"].set_index("mid")
    away_rows = long[long["side"] == "away"].set_index("mid")

    df["home_form"] = home_rows["form"].reindex(df.index).to_numpy()
    df["away_form"] = away_rows["form"].reindex(df.index).to_numpy()
    df["home_rest"] = home_rows["rest"].reindex(df.index).to_numpy()
    df["away_rest"] = away_rows["rest"].reindex(df.index).to_numpy()

    df["form_diff"] = df["home_form"] - df["away_form"]
    df["rest_diff"] = df["home_rest"] - df["away_rest"]
    df["neutral"] = df["neutral"].astype(int)
    df["importance_ord"] = df["importance"].map(IMPORTANCE_ORDINAL).fillna(1).astype(int)
    return df


def feature_matrix(df: pd.DataFrame) -> np.ndarray:
    return df[FEATURE_COLUMNS].to_numpy(dtype=float)


def latest_team_state(matches: pd.DataFrame) -> pd.DataFrame:
    """Per-team current form (last FORM_WINDOW goal diffs) and last match date — for
    building features of UPCOMING fixtures (no result yet)."""
    long = _team_perspective_rows(matches).sort_values(["team", "date"])
    g = long.groupby("team", sort=False)
    form = g["gd"].apply(lambda s: s.tail(FORM_WINDOW).mean())
    last = g["date"].max()
    return pd.DataFrame({"form": form, "last_date": last})


def build_fixture_features(
    fixtures: pd.DataFrame, ratings: dict[str, float], state: pd.DataFrame, ref_date: pd.Timestamp,
) -> pd.DataFrame:
    """Assemble FEATURE_COLUMNS for upcoming fixtures from current ratings + team state."""
    df = fixtures.copy()
    form = state["form"].to_dict()
    last = state["last_date"].to_dict()

    def elo(t: str) -> float:
        return ratings.get(t, INITIAL_ELO)

    df["home_elo_pre"] = df["home_team"].map(elo)
    df["away_elo_pre"] = df["away_team"].map(elo)
    ha = np.where(df["neutral"].astype(bool), 0.0, HOME_ADVANTAGE)
    df["elo_diff"] = df["home_elo_pre"] + ha - df["away_elo_pre"]

    df["home_form"] = df["home_team"].map(form).fillna(0.0)
    df["away_form"] = df["away_team"].map(form).fillna(0.0)
    df["form_diff"] = df["home_form"] - df["away_form"]

    def rest(team_series: pd.Series) -> np.ndarray:
        days = team_series.map(last).apply(
            lambda d: (ref_date - d).days if pd.notna(d) else REST_CAP_DAYS)
        return days.clip(upper=REST_CAP_DAYS).to_numpy(dtype=float)

    df["rest_diff"] = rest(df["home_team"]) - rest(df["away_team"])
    df["neutral"] = df["neutral"].astype(int)
    df["importance_ord"] = IMPORTANCE_ORDINAL["world_cup"]
    return df
