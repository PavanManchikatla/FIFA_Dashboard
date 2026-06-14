"""Derive insight objects from simulation output (PLAN.md §4.6). Phase 3.

Each insight = {id, kind, severity, teams[], templateId, params, generatedAt} (PLAN.md §5).
Python emits FACTS only (params); the comedy voice lives in apps/web/lib/commentary.ts,
keyed by templateId. Catalog implemented here: title_favorite, title_odds_move,
group_of_death, dark_horse.
"""

from __future__ import annotations

import math


def _entropy(ps: list[float]) -> float:
    total = sum(ps) or 1.0
    h = 0.0
    for p in ps:
        q = p / total
        if q > 0:
            h -= q * math.log(q)
    return h


def derive_insights(simulation: dict, ratings: list[dict], generated_at: str) -> list[dict]:
    teams = simulation["teams"]  # sorted by pChampion desc
    groups = simulation["groups"]
    rank_by_team = {r["team"]: r["rank"] for r in ratings}
    out: list[dict] = []

    # title_favorite — highest champion probability.
    if teams:
        fav = teams[0]
        out.append({
            "id": "title_favorite", "kind": "title_odds", "severity": 1,
            "teams": [fav["team"]], "templateId": "title_favorite",
            "params": {"team": fav["team"], "pct": round(fav["pChampion"] * 100, 1)},
            "generatedAt": generated_at,
        })

    # title_odds_move — biggest daily swing in champion probability.
    movers = [t for t in teams if abs(t["dChampion24h"]) > 0.0005]
    if movers:
        m = max(movers, key=lambda t: abs(t["dChampion24h"]))
        up = m["dChampion24h"] > 0
        out.append({
            "id": "title_odds_move", "kind": "title_odds_move",
            "severity": 2 if abs(m["dChampion24h"]) > 0.01 else 1,
            "teams": [m["team"]], "templateId": "title_odds_move",
            "params": {"team": m["team"], "deltaPct": round(m["dChampion24h"] * 100, 2),
                       "direction": "up" if up else "down"},
            "generatedAt": generated_at,
        })

    # group_of_death — group whose advancement is most uncertain (highest entropy).
    death = max(
        groups.items(),
        key=lambda kv: _entropy([t["pAdvance"] for t in kv[1]]),
        default=None,
    )
    if death:
        letter, rows = death
        out.append({
            "id": "group_of_death", "kind": "group_of_death", "severity": 3,
            "teams": [r["team"] for r in rows], "templateId": "group_of_death",
            "params": {"group": letter,
                       "teams": ", ".join(r["team"] for r in rows)},
            "generatedAt": generated_at,
        })

    # dark_horse — best champion odds among teams ranked outside the Elo top 10.
    longshots = [t for t in teams if rank_by_team.get(t["team"], 999) > 10 and t["pChampion"] > 0]
    if longshots:
        dh = longshots[0]  # teams already sorted by pChampion desc
        out.append({
            "id": "dark_horse", "kind": "dark_horse", "severity": 2,
            "teams": [dh["team"]], "templateId": "dark_horse",
            "params": {"team": dh["team"], "pct": round(dh["pChampion"] * 100, 1),
                       "rank": rank_by_team.get(dh["team"], 0)},
            "generatedAt": generated_at,
        })

    return out
