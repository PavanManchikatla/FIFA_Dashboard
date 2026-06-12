"""Download + clean datasets (PLAN.md §4, §3). Phase 2.

Sources: martj42/international_results (CC0), openfootball/worldcup.json. Writes processed
parquet under ml/data/ (committed); raw downloads stay gitignored. Team names go through
team_names.canonical().
"""

from __future__ import annotations


def main() -> None:
    raise NotImplementedError("ingest lands in Phase 2 (PLAN.md §7)")


if __name__ == "__main__":
    main()
