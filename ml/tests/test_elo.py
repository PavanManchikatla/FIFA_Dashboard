import math

from wc26ml.elo import INITIAL_ELO, K_FACTOR, expected_score, mov_multiplier


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
