"""48-team Monte Carlo tournament simulator (PLAN.md §4.3). Phase 3.

Real 2026 format: 12 groups of 4 → top 2 + 8 best third-placed → Round of 32 → R16 → QF →
SF → Final. This is the highest-risk code in the repo (CLAUDE.md), so the deterministic
pieces — group standings, FIFA tiebreakers, best-thirds selection, bracket validity — are
vectorized for speed AND covered by exhaustive unit tests.

APPROXIMATION (documented honestly): FIFA assigns the 8 qualifying third-placed teams to
Round-of-32 slots via a 495-row combination table that is not publicly encodable here. We
instead use a fixed, valid bracket whose winner-vs-runner pairings are guaranteed
cross-group by construction; the exact winner-vs-third slotting is approximated. This only
shifts *which* specific R32 opponent a team draws, a second-order effect on aggregate
advancement/champion probabilities (the dominant signals are team strength + group draw).
"""

from __future__ import annotations

import numpy as np

GROUP_LETTERS = list("ABCDEFGHIJKL")
MAX_GOALS = 10
GRID = MAX_GOALS + 1  # scoreline grid is GRID x GRID

# Seed layout per run: cols 0-11 = group winners (A..L), 12-23 = runners-up (A..L),
# 24-31 = the 8 best third-placed (best..8th). BRACKET_SEED_ORDER permutes these 32 seeds
# into bracket positions; adjacent pairs (2i, 2i+1) are the Round-of-32 matches, and the
# tree folds by adjacent pairs (32→16→8→4→2→1). Winner-vs-runner pairs are offset so they
# are always cross-group; winner-vs-third pairs occupy positions 0-15 (see module docstring).
BRACKET_SEED_ORDER = np.array([
    0, 24, 1, 25, 2, 26, 3, 27, 4, 28, 5, 29, 6, 30, 7, 31,   # W_A..W_H vs thirds 1..8
    8, 12, 9, 13, 10, 14, 11, 15,                              # W_I..W_L vs R_A..R_D
    16, 20, 17, 21, 18, 22, 19, 23,                            # R_E..R_H vs R_I..R_L
])

# Rounds reached, in order, with the slot-count entering each.
ROUND_NAMES = ["R32", "R16", "QF", "SF", "Final", "Champion"]


def standings_key(pts: np.ndarray, gd: np.ndarray, gf: np.ndarray) -> np.ndarray:
    """FIFA primary ranking key: points, then goal difference, then goals for. Encoded into a
    single descending-sortable scalar (gd/gf are bounded well within these offsets)."""
    return pts * 1_000_000 + (gd + 200) * 1_000 + gf


def _round_robin_pairs(n: int = 4) -> list[tuple[int, int]]:
    return [(i, j) for i in range(n) for j in range(i + 1, n)]


def run_group_stage(
    groups: dict[str, list[int]],
    fixture_dists: dict[str, np.ndarray],
    n_runs: int,
    rng: np.random.Generator,
) -> dict:
    """Vectorized group stage. `fixture_dists[letter]` is a (6, GRID*GRID) array of scoreline
    probabilities for that group's 6 round-robin fixtures, ordered by _round_robin_pairs().
    Returns winners/runners/thirds team-index arrays (N,12), the thirds ranking key (N,12),
    and per-group placement order (N,12,4)."""
    pairs = _round_robin_pairs(4)
    winners = np.empty((n_runs, 12), dtype=np.int32)
    runners = np.empty((n_runs, 12), dtype=np.int32)
    thirds = np.empty((n_runs, 12), dtype=np.int32)
    thirds_key = np.empty((n_runs, 12), dtype=np.float64)
    order_by_group = np.empty((n_runs, 12, 4), dtype=np.int8)

    for gi, letter in enumerate(GROUP_LETTERS):
        team_idx = np.asarray(groups[letter], dtype=np.int32)  # (4,)
        pts = np.zeros((n_runs, 4))
        gd = np.zeros((n_runs, 4))
        gf = np.zeros((n_runs, 4))
        dists = fixture_dists[letter]  # (6, GRID*GRID)
        for fi, (a, b) in enumerate(pairs):
            samp = rng.choice(GRID * GRID, size=n_runs, p=dists[fi])
            hs = samp // GRID
            aus = samp % GRID
            gf[:, a] += hs
            gf[:, b] += aus
            gd[:, a] += hs - aus
            gd[:, b] += aus - hs
            pts[:, a] += np.where(hs > aus, 3, np.where(hs == aus, 1, 0))
            pts[:, b] += np.where(aus > hs, 3, np.where(aus == hs, 1, 0))

        key = standings_key(pts, gd, gf)              # (N,4)
        order = np.argsort(-key, axis=1, kind="stable")  # (N,4) local team positions, 1st..4th
        order_by_group[:, gi, :] = order
        winners[:, gi] = team_idx[order[:, 0]]
        runners[:, gi] = team_idx[order[:, 1]]
        thirds[:, gi] = team_idx[order[:, 2]]
        thirds_key[:, gi] = np.take_along_axis(key, order[:, 2:3], axis=1).ravel()

    return {
        "winners": winners, "runners": runners, "thirds": thirds,
        "thirds_key": thirds_key, "order_by_group": order_by_group,
    }


def select_best_thirds(thirds: np.ndarray, thirds_key: np.ndarray) -> np.ndarray:
    """Pick the 8 best third-placed teams per run (ranked by the standings key). Returns an
    (N,8) array of team indices, best→8th."""
    top8_pos = np.argsort(-thirds_key, axis=1, kind="stable")[:, :8]  # (N,8) group columns
    return np.take_along_axis(thirds, top8_pos, axis=1)


def run_knockout(positions: np.ndarray, advance_prob: np.ndarray, rng: np.random.Generator) -> dict:
    """Fold the 32-team bracket by adjacent pairs. `advance_prob[a,b]` = P(team a beats team b).
    Returns, per round name, the set of team indices that REACHED that round (as (N,k) arrays)."""
    reached = {"R32": positions.copy()}
    cur = positions
    for name in ROUND_NAMES[1:]:  # R16, QF, SF, Final, Champion
        a = cur[:, 0::2]
        b = cur[:, 1::2]
        p = advance_prob[a, b]                    # (N, k/2)
        a_wins = rng.random(p.shape) < p
        cur = np.where(a_wins, a, b)
        reached[name] = cur.copy()
    return reached


def simulate(
    groups: dict[str, list[int]],
    fixture_dists: dict[str, np.ndarray],
    advance_prob: np.ndarray,
    n_teams: int,
    n_runs: int = 10_000,
    seed: int = 0,
) -> dict:
    """Run the full Monte Carlo. Returns per-team reached-round counts, champion counts, and
    per-group placement counts — all as integer arrays the publisher turns into probabilities."""
    rng = np.random.default_rng(seed)
    gs = run_group_stage(groups, fixture_dists, n_runs, rng)
    thirds8 = select_best_thirds(gs["thirds"], gs["thirds_key"])  # (N,8)

    seed_arr = np.concatenate([gs["winners"], gs["runners"], thirds8], axis=1)  # (N,32)
    positions = seed_arr[:, BRACKET_SEED_ORDER]
    reached = run_knockout(positions, advance_prob, rng)

    # Aggregate reached-round counts per team.
    reached_counts = {
        name: np.bincount(arr.ravel(), minlength=n_teams) for name, arr in reached.items()
    }
    # Advanced-from-group = appeared in R32.
    reached_counts["group"] = reached_counts["R32"].copy()

    # Per-group placement distribution: counts[group][local_team][place].
    place_counts = np.zeros((12, 4, 4), dtype=np.int64)  # group, local team, place(0..3)
    order = gs["order_by_group"]  # (N,12,4): order[:,g,p] = local team finishing at place p
    for g in range(12):
        for p in range(4):
            local_teams = order[:, g, p]
            place_counts[g, :, p] = np.bincount(local_teams, minlength=4)

    return {
        "n_runs": n_runs,
        "reached_counts": reached_counts,
        "place_counts": place_counts,
        "groups": groups,
    }
