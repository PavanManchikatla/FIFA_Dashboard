"""Single source of truth for team-name canonicalization (CLAUDE.md source-data gotcha).

The martj42 dataset and worldcup26.ir disagree on names ("USA" vs "United States",
"Korea Republic" vs "South Korea"). Everything downstream keys on the canonical name.
Extend ALIASES as new mismatches surface; keep this the only mapping in the repo.
"""

from __future__ import annotations

# alias (any source spelling, case-insensitive) -> canonical name
ALIASES: dict[str, str] = {
    "usa": "United States",
    "united states of america": "United States",
    "us": "United States",
    "korea republic": "South Korea",
    "republic of korea": "South Korea",
    "korea dpr": "North Korea",
    "ir iran": "Iran",
    "china pr": "China",
    "côte d'ivoire": "Ivory Coast",
    "cote d'ivoire": "Ivory Coast",
    "czechia": "Czech Republic",
    "türkiye": "Turkey",
    "turkiye": "Turkey",
    "bosnia and herzegovina": "Bosnia-Herzegovina",
}


def canonical(name: str) -> str:
    """Return the canonical team name for any source spelling."""
    key = name.strip().lower()
    return ALIASES.get(key, name.strip())
