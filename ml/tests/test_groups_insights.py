import pandas as pd

from wc26ml.ingest import derive_groups
from wc26ml.insights import derive_insights


def _two_group_fixtures() -> pd.DataFrame:
    # Two cliques of 4 (round-robin), no cross-group edges → two components.
    def rr(teams):
        return [(teams[i], teams[j]) for i in range(4) for j in range(i + 1, 4)]
    g1 = rr(["Argentina", "Brazil", "Chile", "Bolivia"])
    g2 = rr(["France", "Germany", "Spain", "Italy"])
    rows = [{"home_team": h, "away_team": a, "neutral": True} for h, a in g1 + g2]
    return pd.DataFrame(rows)


def test_derive_groups_finds_components_of_four():
    groups = derive_groups(_two_group_fixtures())
    assert len(groups) == 2
    assert all(len(v) == 4 for v in groups.values())
    # Letters assigned by alphabetically-first team → A starts with Argentina.
    assert groups["A"][0] == "Argentina"
    assert "France" in groups["B"]


def test_derive_insights_emits_expected_kinds():
    simulation = {
        "teams": [
            {"team": "Argentina", "pChampion": 0.25, "pAdvance": 0.99, "dChampion24h": 0.03,
             "pGroup": 0.99, "pR32": 0.99, "pR16": 0.8, "pQF": 0.6, "pSF": 0.4, "pFinal": 0.3},
            {"team": "Nepal", "pChampion": 0.02, "pAdvance": 0.3, "dChampion24h": -0.01,
             "pGroup": 0.3, "pR32": 0.3, "pR16": 0.1, "pQF": 0.05, "pSF": 0.02, "pFinal": 0.02},
        ],
        "groups": {
            "A": [{"team": "Argentina", "pAdvance": 0.99}, {"team": "B2", "pAdvance": 0.5},
                  {"team": "B3", "pAdvance": 0.4}, {"team": "B4", "pAdvance": 0.11}],
            "B": [{"team": "X", "pAdvance": 0.5}, {"team": "Y", "pAdvance": 0.5},
                  {"team": "Z", "pAdvance": 0.5}, {"team": "W", "pAdvance": 0.5}],  # max entropy
        },
        "modelVersion": "test",
    }
    ratings = [{"team": "Argentina", "rank": 1}, {"team": "Nepal", "rank": 21}]
    out = derive_insights(simulation, ratings, "2026-06-14T00:00:00Z")
    ids = {i["id"] for i in out}
    assert "title_favorite" in ids
    assert "title_odds_move" in ids       # Argentina moved +0.03
    assert "group_of_death" in ids
    assert "dark_horse" in ids            # Nepal, rank 21, pChampion>0
    # group of death is the highest-entropy group (B, all equal)
    god = next(i for i in out if i["id"] == "group_of_death")
    assert god["params"]["group"] == "B"
    # contract: every insight has the required fields
    for i in out:
        assert {"id", "kind", "severity", "teams", "templateId", "params", "generatedAt"} <= i.keys()
