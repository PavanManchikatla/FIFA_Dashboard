"""Pre-match model: Dixon-Coles bivariate Poisson + GBM blend (PLAN.md §4.2). Phase 2.

Outputs full scoreline distribution → P(win/draw/loss), most-likely score, over/under.
Knockout: P(advance) = P(win 90') + P(draw)*P(win ET/pens), pens 50/50 ± small Elo tilt.
"""

from __future__ import annotations


def fit():  # noqa: ANN201
    raise NotImplementedError("goals model lands in Phase 2 (PLAN.md §7)")
