import math

import pandas as pd

from wc26ml.elo import INITIAL_ELO, K_FACTOR, expected_score, mov_multiplier, run_elo


def test_initial_and_kfactors():
    assert INITIAL_ELO == 1500.0
    assert K_FACTOR["world_cup"] == 60
    assert K_FACTOR["friendly"] == 20


def test_expected_score_symmetric_at_equal_rating():
    assert expected_score(1500, 1500) == 0.5
    assert expected_score(1700, 1500) > 0.5


def test_mov_multiplier_grows_with_margin():
    assert mov_multiplier(1, 0) < mov_multiplier(3, 0)
    # dampened by a large elo gap (blowout-protection)
    assert mov_multiplier(3, 0) > mov_multiplier(3, 500)
    assert not math.isnan(mov_multiplier(2, 100))


def test_draws_do_not_update_ratings_known_limitation():
    """KNOWN LIMITATION (locked, not a passing feature): the frozen ln(|gd|+1) MOV term is
    0 at a draw, so a drawn match produces no Elo change. Documented in elo.mov_multiplier /
    meta.json. If we adopt the goal-index fix, flip this assertion."""
    assert mov_multiplier(0, 0) == 0.0
    df = pd.DataFrame([{
        "date": pd.Timestamp("2020-01-01"), "home_team": "Strong", "away_team": "Weak",
        "home_score": 1, "away_score": 1, "importance": "friendly", "neutral": True,
        "outcome": "D",
    }])
    _, ratings = run_elo(df)
    # Both stay at the initial rating because the draw didn't move anything.
    assert ratings["Strong"] == INITIAL_ELO
    assert ratings["Weak"] == INITIAL_ELO
