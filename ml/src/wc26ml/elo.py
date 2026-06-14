"""Custom Elo rating engine (PLAN.md §4.1). Phase 2.

Init 1500; chronological updates over the martj42 dataset. K by match importance, WC-Elo
margin-of-victory multiplier, +80 home advantage (neutral games get none). The engine also
records each match's PRE-match ratings so features/baselines are leak-free.
"""

from __future__ import annotations

import math
from collections import defaultdict

import pandas as pd

INITIAL_ELO = 1500.0
HOME_ADVANTAGE = 80.0

# K-factor by match importance (PLAN.md §4.1).
K_FACTOR = {
    "friendly": 20,
    "qualifier": 35,
    "continental": 45,
    "world_cup": 60,
}


def mov_multiplier(goal_diff: int, elo_diff: float) -> float:
    """WC-Elo margin-of-victory multiplier: ln(|gd|+1) * 2.2/(0.001*|elo_diff|+2.2)."""
    return math.log(abs(goal_diff) + 1) * (2.2 / (0.001 * abs(elo_diff) + 2.2))


def expected_score(elo_a: float, elo_b: float) -> float:
    """Logistic expectation that A beats B."""
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a) / 400.0))


class EloEngine:
    """Stateful Elo ratings, updated one match at a time in date order."""

    def __init__(self) -> None:
        self.ratings: dict[str, float] = defaultdict(lambda: INITIAL_ELO)

    def rating(self, team: str) -> float:
        return self.ratings[team]

    def update_one(
        self, home: str, away: str, home_score: int, away_score: int,
        importance: str, neutral: bool,
    ) -> tuple[float, float]:
        """Apply one result. Returns the PRE-match (home, away) ratings."""
        rh, ra = self.ratings[home], self.ratings[away]
        ha = 0.0 if neutral else HOME_ADVANTAGE

        exp_home = expected_score(rh + ha, ra)
        actual_home = 1.0 if home_score > away_score else 0.0 if home_score < away_score else 0.5
        k = K_FACTOR.get(importance, 30)
        mult = mov_multiplier(home_score - away_score, (rh + ha) - ra)
        change = k * mult * (actual_home - exp_home)

        self.ratings[home] = rh + change
        self.ratings[away] = ra - change
        return rh, ra


def run_elo(matches: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """
    Process matches chronologically. Returns:
      - the input frame plus `home_elo_pre`, `away_elo_pre`, `elo_diff` (HA-adjusted) columns,
      - the final ratings dict.
    `matches` must be date-sorted with home/away/scores/importance/neutral columns.
    """
    engine = EloEngine()
    home_pre = []
    away_pre = []
    elo_diff = []
    for row in matches.itertuples(index=False):
        rh, ra = engine.update_one(
            row.home_team, row.away_team, row.home_score, row.away_score,
            row.importance, bool(row.neutral),
        )
        ha = 0.0 if bool(row.neutral) else HOME_ADVANTAGE
        home_pre.append(rh)
        away_pre.append(ra)
        elo_diff.append((rh + ha) - ra)

    out = matches.copy()
    out["home_elo_pre"] = home_pre
    out["away_elo_pre"] = away_pre
    out["elo_diff"] = elo_diff
    return out, dict(engine.ratings)


def ratings_table(ratings: dict[str, float]) -> pd.DataFrame:
    """Ranked ratings frame: team, elo, rank."""
    df = (
        pd.DataFrame({"team": list(ratings.keys()), "elo": list(ratings.values())})
        .sort_values("elo", ascending=False)
        .reset_index(drop=True)
    )
    df["rank"] = df.index + 1
    return df
