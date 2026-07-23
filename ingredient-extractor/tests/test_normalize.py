from ingredient_extractor.normalize import normalize_ingredient_name, strip_vague_quantity_prefix


def test_strip_vague_prefix():
    assert strip_vague_quantity_prefix("a drizzle of sesame oil") == "sesame oil"
    assert strip_vague_quantity_prefix("a pinch of salt") == "salt"
    assert strip_vague_quantity_prefix("some cilantro") == "cilantro"
    assert strip_vague_quantity_prefix("Olive oil") == "Olive oil"  # unaffected


def test_normalize_strips_parenthetical_content_entirely():
    assert normalize_ingredient_name("Kosher salt (for fries)") == "salt"
    assert normalize_ingredient_name("Salt (for batter)") == "salt"


def test_normalize_strips_descriptors():
    assert normalize_ingredient_name("Baby spinach") == "spinach"
    assert normalize_ingredient_name("Fresh basil") == "basil"
    assert normalize_ingredient_name("Minced garlic") == "garlic"
    assert normalize_ingredient_name("Toasted sesame oil") == "sesame oil"


def test_normalize_singularizes_naively():
    assert normalize_ingredient_name("Onions") == "onion"
    assert normalize_ingredient_name("Eggs") == "egg"
    assert normalize_ingredient_name("Carrots") == "carrot"


def test_normalize_leaves_short_or_ss_words_alone():
    assert normalize_ingredient_name("Grass") == "grass"


def test_normalize_case_insensitive_grouping():
    variants = ["Salt", "salt", "Kosher Salt", "Kosher salt (for fries)"]
    normalized = {normalize_ingredient_name(v) for v in variants}
    assert normalized == {"salt"}
