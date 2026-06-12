"""Derive insight objects from sim output (PLAN.md §4.6). Phase 3.

Each insight = {id, kind, severity, teams[], text_template_id, params, generated_at}.
Python emits FACTS only; the comedy voice lives in apps/web/lib/commentary.ts.
Catalog: title_odds_move, upset_alert, group_of_death, path_difficulty, pens_doom,
heat_factor, panic_index, calibration_pulse.
"""

from __future__ import annotations


def derive_insights():  # noqa: ANN201
    raise NotImplementedError("insights land in Phase 3 (PLAN.md §7)")
