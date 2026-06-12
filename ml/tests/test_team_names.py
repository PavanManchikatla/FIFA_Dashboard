from wc26ml.team_names import canonical


def test_canonicalizes_known_aliases():
    assert canonical("USA") == "United States"
    assert canonical("united states of america") == "United States"
    assert canonical("Korea Republic") == "South Korea"
    assert canonical("Czechia") == "Czech Republic"


def test_passes_through_unknown_names():
    assert canonical("Brazil") == "Brazil"
    assert canonical("  France  ") == "France"


def test_case_insensitive():
    assert canonical("uSa") == "United States"
