"""Walk-forward backtest (PLAN.md §4.5) — non-negotiable gate.

Train on data before each of WC 2010/2014/2018/2022, predict that tournament. Report
log-loss, Brier, calibration table vs uniform and Elo-only baselines. Acceptance: blended
model beats Elo-only on log-loss in >=3 of 4 tournaments. Scores published into meta.json.
Phase 2.
"""

from __future__ import annotations


def main() -> None:
    raise NotImplementedError("backtest lands in Phase 2 (PLAN.md §7)")


if __name__ == "__main__":
    main()
