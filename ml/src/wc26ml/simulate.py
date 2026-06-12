"""48-team Monte Carlo tournament simulator (PLAN.md §4.3). Phase 3.

12 groups of 4 → top 2 + 8 best third-placed → R32 → R16 → QF → SF → F. FIFA third-place
allocation + bracket routing must be exhaustively unit-tested (highest-risk code in repo).
10k vectorized runs; fixes played matches, simulates the remainder. Writes simulation.json.
"""

from __future__ import annotations


def simulate(n_runs: int = 10_000):  # noqa: ANN201
    raise NotImplementedError("simulator lands in Phase 3 (PLAN.md §7)")
