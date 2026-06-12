"""Custom Elo rating engine (PLAN.md §4.1). Phase 2.

Constants are fixed here now; the update loop is implemented in Phase 2 against the
martj42 dataset. Init 1500; K by importance; WC-Elo margin-of-victory multiplier.
"""

from __future__ import annotations

import math

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
