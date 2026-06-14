import pandas as pd

from wc26ml.ingest import clean, importance_of


def test_importance_mapping():
    assert importance_of("FIFA World Cup") == "world_cup"
    assert importance_of("FIFA World Cup qualification") == "qualifier"
    assert importance_of("UEFA Euro") == "continental"
    assert importance_of("Copa América") == "continental"
    assert importance_of("Friendly") == "friendly"
    # unlisted competitive tournament defaults to qualifier weight
    assert importance_of("Some Cup Final") == "qualifier"


def test_clean_canonicalizes_and_labels_outcome():
    raw = pd.DataFrame({
        "date": ["2022-01-02", "2021-06-01", "bad-date"],
        "home_team": ["USA", "Brazil", "France"],
        "away_team": ["Mexico", "Argentina", "Spain"],
        "home_score": [2, 1, None],
        "away_score": [0, 1, 3],
        "tournament": ["Friendly", "FIFA World Cup", "Friendly"],
        "city": ["x", "y", "z"], "country": ["a", "b", "c"],
        "neutral": ["FALSE", "TRUE", "FALSE"],
    })
    out = clean(raw)
    # bad-date / null-score row dropped; sorted ascending by date
    assert len(out) == 2
    assert list(out["date"]) == sorted(out["date"])
    assert out.iloc[0]["home_team"] == "Brazil"  # 2021 before 2022
    assert out.iloc[0]["outcome"] == "D"          # 1-1
    usa = out[out["home_team"] == "United States"].iloc[0]
    assert usa["outcome"] == "H" and usa["importance"] == "friendly"
    assert bool(out.iloc[0]["neutral"]) is True
