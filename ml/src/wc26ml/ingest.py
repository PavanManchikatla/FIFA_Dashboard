"""Download + clean the martj42 international results dataset (PLAN.md §3, §4). Phase 2.

martj42/international_results: ~49k internationals since 1872, CC0. We compute our own Elo
and models from it. Raw download lands in ml/data/raw/ (gitignored); the cleaned, canonical
table is written to ml/data/processed/matches.parquet (committed) and is the single input to
elo/features/goals_model/backtest.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from .team_names import canonical

RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MATCHES_PARQUET = PROCESSED_DIR / "matches.parquet"

# Map tournament name → importance bucket for the Elo K-factor (elo.py K_FACTOR).
# Order matters: first matching substring wins.
_IMPORTANCE_RULES: list[tuple[str, str]] = [
    ("FIFA World Cup qualification", "qualifier"),
    ("FIFA World Cup", "world_cup"),
    ("Copa América", "continental"),
    ("UEFA Euro", "continental"),
    ("African Cup of Nations", "continental"),
    ("AFC Asian Cup", "continental"),
    ("Gold Cup", "continental"),
    ("UEFA Nations League", "continental"),
    ("Confederations Cup", "continental"),
    ("qualification", "qualifier"),
    ("Friendly", "friendly"),
]


def importance_of(tournament: str) -> str:
    for needle, bucket in _IMPORTANCE_RULES:
        if needle.lower() in tournament.lower():
            return bucket
    # Unlisted competitive tournaments default to qualifier-level weight.
    return "qualifier"


def download_raw() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / "results.csv"
    df = pd.read_csv(RESULTS_URL)
    df.to_csv(dest, index=False)
    return dest


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date", "home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)

    df["home_team"] = df["home_team"].map(canonical)
    df["away_team"] = df["away_team"].map(canonical)
    df["neutral"] = df["neutral"].astype(str).str.upper().eq("TRUE")

    df["importance"] = df["tournament"].map(importance_of)
    # Outcome from home perspective: H / D / A.
    diff = df["home_score"] - df["away_score"]
    df["outcome"] = pd.Series("D", index=df.index)
    df.loc[diff > 0, "outcome"] = "H"
    df.loc[diff < 0, "outcome"] = "A"

    df = df.sort_values("date").reset_index(drop=True)
    return df[
        ["date", "home_team", "away_team", "home_score", "away_score",
         "tournament", "importance", "neutral", "outcome"]
    ]


def load_matches() -> pd.DataFrame:
    """Read the processed table, building it from the raw download if missing."""
    if MATCHES_PARQUET.exists():
        return pd.read_parquet(MATCHES_PARQUET)
    return main()


def load_wc26_fixtures() -> pd.DataFrame:
    """
    WC26 fixtures (played or not) for match-prob publishing. Reads the raw CSV (downloading
    if missing) since the processed table drops unplayed matches. Returns canonical
    home/away/date/neutral, sorted by date. Group stage only — knockouts are TBD until the
    simulator (Phase 3) routes them.
    """
    raw = RAW_DIR / "results.csv"
    src = raw if raw.exists() else download_raw()
    df = pd.read_csv(src)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    wc = df[(df["tournament"] == "FIFA World Cup") & (df["date"].dt.year == 2026)].copy()
    wc["home_team"] = wc["home_team"].map(canonical)
    wc["away_team"] = wc["away_team"].map(canonical)
    wc["neutral"] = wc["neutral"].astype(str).str.upper().eq("TRUE")
    wc = wc.sort_values("date").reset_index(drop=True)
    return wc[["date", "home_team", "away_team", "neutral"]]


def derive_groups(fixtures: pd.DataFrame) -> dict[str, list[str]]:
    """Reconstruct the 12 WC26 groups from the fixture pairings — martj42 has no group
    column, but each group's 4 teams all play each other, so a group is a connected component
    of the group-stage match graph. Letters A–L are assigned by the alphabetically-first team
    in each component (cosmetic; the source doesn't label them)."""
    from collections import defaultdict

    adj: dict[str, set[str]] = defaultdict(set)
    for r in fixtures.itertuples(index=False):
        adj[r.home_team].add(r.away_team)
        adj[r.away_team].add(r.home_team)

    seen: set[str] = set()
    comps: list[list[str]] = []
    for team in adj:
        if team in seen:
            continue
        stack, comp = [team], []
        while stack:
            t = stack.pop()
            if t in seen:
                continue
            seen.add(t)
            comp.append(t)
            stack.extend(adj[t] - seen)
        comps.append(sorted(comp))

    comps.sort(key=lambda c: c[0])
    from .simulate import GROUP_LETTERS
    return {GROUP_LETTERS[i]: comp for i, comp in enumerate(comps)}


def main() -> pd.DataFrame:
    print("Downloading martj42 results …")
    raw = download_raw()
    df = clean(pd.read_csv(raw))
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(MATCHES_PARQUET, index=False)
    print(f"Wrote {len(df):,} matches → {MATCHES_PARQUET}")
    print(f"  date range: {df['date'].min().date()} → {df['date'].max().date()}")
    print(f"  importance mix: {df['importance'].value_counts().to_dict()}")
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest martj42 international results")
    parser.parse_args()
    main()
