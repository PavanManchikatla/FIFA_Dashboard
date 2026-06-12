"""Write JSON artifacts to public/oracle/ (PLAN.md §6). Phase 2+.

Emits ratings.json, match_probs.json, simulation.json, insights.json, meta.json.
Shapes are FROZEN (PLAN.md §5) and mirrored by the zod schemas in apps/web/lib/oracle.ts —
change all three (here, the schemas, PLAN.md) in the same commit (CLAUDE.md).
"""

from __future__ import annotations

from pathlib import Path

# Repo-root-relative output dir: ml/src/wc26ml/publish.py -> ../../../public/oracle
ORACLE_DIR = Path(__file__).resolve().parents[3] / "public" / "oracle"


def main() -> None:
    raise NotImplementedError("publish lands in Phase 2 (PLAN.md §7)")


if __name__ == "__main__":
    main()
