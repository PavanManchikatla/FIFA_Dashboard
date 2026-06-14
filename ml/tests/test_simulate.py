"""Exhaustive bracket-rule tests for the simulator (CLAUDE.md: highest-risk code).

Uses fully deterministic inputs so every structural invariant is exactly checkable:
 - "home always wins 1-0" scoreline dist → known group standings,
 - "lower team index always advances" knockout matrix → known bracket outcomes.
"""

import numpy as np
import pytest

from wc26ml.simulate import (
    BRACKET_SEED_ORDER, GRID, GROUP_LETTERS, ROUND_NAMES,
    run_group_stage, run_knockout, select_best_thirds, simulate, standings_key,
)

N_TEAMS = 48


def _groups_consecutive() -> dict[str, list[int]]:
    # Group A=[0,1,2,3], B=[4,5,6,7], … L=[44..47].
    return {letter: [4 * gi + k for k in range(4)] for gi, letter in enumerate(GROUP_LETTERS)}


def _home_wins_dists() -> dict[str, np.ndarray]:
    # All scoreline mass on 1-0 to the home (first-listed) team of each fixture.
    dist = np.zeros(GRID * GRID)
    dist[1 * GRID + 0] = 1.0  # hs=1, as=0
    return {letter: np.tile(dist, (6, 1)) for letter in GROUP_LETTERS}


def _lower_index_advances() -> np.ndarray:
    # advance_prob[a,b] = 1.0 iff a < b → the lower index always wins.
    m = np.zeros((N_TEAMS, N_TEAMS))
    for a in range(N_TEAMS):
        for b in range(N_TEAMS):
            m[a, b] = 1.0 if a < b else 0.0
    return m


# ---- deterministic ranking key ----
def test_standings_key_priority():
    # points dominate goal difference dominate goals for
    assert standings_key(np.array([3]), np.array([0]), np.array([0])) > standings_key(np.array([2]), np.array([9]), np.array([9]))
    assert standings_key(np.array([3]), np.array([2]), np.array([0])) > standings_key(np.array([3]), np.array([1]), np.array([9]))
    assert standings_key(np.array([3]), np.array([1]), np.array([5])) > standings_key(np.array([3]), np.array([1]), np.array([4]))


# ---- bracket constant integrity ----
def test_bracket_seed_order_is_a_permutation():
    assert sorted(BRACKET_SEED_ORDER.tolist()) == list(range(32))


def test_no_r32_match_pairs_a_group_with_its_own_runner_up():
    # seed cols: 0-11 winners(group g), 12-23 runners(group g-12). A same-group winner-vs-
    # runner clash would be cols (g, g+12) adjacent. Assert none of the 16 pairs are that.
    pairs = BRACKET_SEED_ORDER.reshape(16, 2)
    for a, b in pairs:
        lo, hi = sorted((int(a), int(b)))
        assert not (lo < 12 and hi == lo + 12), f"same-group winner/runner clash at {(lo, hi)}"


# ---- group stage ----
def test_group_stage_orders_by_dominance():
    gs = run_group_stage(_groups_consecutive(), _home_wins_dists(), n_runs=5, rng=np.random.default_rng(0))
    # Home-always-wins → within each group the first-listed team wins all, etc.
    assert (gs["winners"][:, 0] == 0).all()   # group A winner = team 0
    assert (gs["runners"][:, 0] == 1).all()
    assert (gs["thirds"][:, 0] == 2).all()
    assert (gs["winners"][:, 11] == 44).all()  # group L winner = team 44


def test_select_best_thirds_picks_highest_keys():
    thirds = np.tile(np.arange(12), (3, 1))               # team ids 0..11 as the 12 thirds
    keys = np.tile(np.arange(12, dtype=float), (3, 1))    # group 11 has the best key
    best = select_best_thirds(thirds, keys)
    assert best.shape == (3, 8)
    # best 8 keys are groups 11..4 → those team ids, in descending-key order
    assert best[0].tolist() == [11, 10, 9, 8, 7, 6, 5, 4]


# ---- knockout ----
def test_knockout_reaches_have_correct_sizes_and_lowest_index_wins():
    positions = np.tile(np.arange(32), (4, 1))  # 32 distinct teams in seed order
    reached = run_knockout(positions, _lower_index_advances(), np.random.default_rng(1))
    sizes = {"R32": 32, "R16": 16, "QF": 8, "SF": 4, "Final": 2, "Champion": 1}
    for name, k in sizes.items():
        assert reached[name].shape == (4, k)
    # team 0 is the lowest index present → wins everything
    assert (reached["Champion"] == 0).all()


# ---- end-to-end ----
def test_simulate_is_consistent_and_monotonic():
    res = simulate(_groups_consecutive(), _home_wins_dists(), _lower_index_advances(),
                   n_teams=N_TEAMS, n_runs=50, seed=7)
    rc = res["reached_counts"]
    # Each round's counts sum to (n_runs * teams-in-round).
    assert rc["R32"].sum() == 50 * 32
    assert rc["Champion"].sum() == 50
    # Deterministic: team 0 wins every run.
    assert rc["Champion"][0] == 50
    # Survival is monotonic per team: reaching a later round implies reaching earlier ones.
    for name_a, name_b in zip(ROUND_NAMES, ROUND_NAMES[1:]):
        assert (rc[name_a] >= rc[name_b]).all()
    # Per-group placement counts sum to n_runs for every (group, place).
    pc = res["place_counts"]
    assert (pc.sum(axis=1) == 50).all()


def test_simulate_probabilities_sum_to_one_over_champions():
    res = simulate(_groups_consecutive(), _home_wins_dists(), _lower_index_advances(),
                   n_teams=N_TEAMS, n_runs=100, seed=3)
    assert res["reached_counts"]["Champion"].sum() == 100  # exactly one champion per run


@pytest.mark.parametrize("n_runs", [1, 10, 100])
def test_simulate_runs_at_various_sizes(n_runs):
    res = simulate(_groups_consecutive(), _home_wins_dists(), _lower_index_advances(),
                   n_teams=N_TEAMS, n_runs=n_runs, seed=0)
    assert res["reached_counts"]["Champion"].sum() == n_runs
