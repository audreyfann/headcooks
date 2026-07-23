import math

from ingredient_extractor.quantities import convert_row, format_display_quantity, parse_quantity


def test_parse_simple_quantity():
    assert parse_quantity("4 cups") == (4.0, "cup")
    assert parse_quantity("1 tbsp") == (1.0, "tbsp")


def test_parse_unicode_fraction():
    num, unit = parse_quantity("1½ cups")
    assert math.isclose(num, 1.5)
    assert unit == "cup"


def test_parse_range_averages():
    num, unit = parse_quantity("18-20 avocados")
    assert math.isclose(num, 19.0)
    assert unit == "count"


def test_parse_vague_quantity_returns_none():
    assert parse_quantity("to taste") == (None, None)
    assert parse_quantity("as needed") == (None, None)


def test_parse_bare_count():
    num, unit = parse_quantity("20 limes")
    assert num == 20.0
    assert unit == "count"  # "limes" is not a recognized unit word


def test_garlic_conversion_to_cloves():
    # 1 tbsp minced garlic ~= 3 cloves
    base, category = convert_row("garlic", 1.0, "tbsp")
    assert base == 3.0
    assert category == "clove"

    # 1 head ~= 10 cloves
    base, category = convert_row("garlic", 2.0, "head")
    assert base == 20.0
    assert category == "clove"


def test_staple_density_merges_weight_and_volume():
    # flour: 1 cup ~= 120g
    base_cup, cat_cup = convert_row("flour", 1.0, "cup")
    assert cat_cup == "weight_volume_merged"
    assert math.isclose(base_cup, 120.0, rel_tol=0.01)

    # flour: 120g should land in the same category/base scale
    base_g, cat_g = convert_row("flour", 120.0, "g")
    assert cat_g == "weight_volume_merged"
    assert math.isclose(base_g, 120.0, rel_tol=0.01)


def test_non_staple_weight_and_volume_stay_separate():
    base_w, cat_w = convert_row("chicken", 1.0, "lb")
    base_v, cat_v = convert_row("chicken", 1.0, "cup")
    assert cat_w == "weight"
    assert cat_v == "volume"
    assert cat_w != cat_v  # must NOT be merged without a known density


def test_count_like_units_stay_distinct():
    # clove and head must never share a category (10 cloves != 10 heads)
    _, cat_clove = convert_row("onion", 1.0, "clove")
    _, cat_head = convert_row("onion", 1.0, "head")
    assert cat_clove == "clove"
    assert cat_head == "head"
    assert cat_clove != cat_head


def test_format_display_quantity_weight():
    qty, unit = format_display_quantity("weight", 453.592 * 2)
    assert unit == "lb"
    assert math.isclose(qty, 2.0)


def test_format_display_quantity_volume_small_amount_shows_tsp():
    qty, unit = format_display_quantity("volume", 4.92892)
    assert unit == "tsp"
    assert math.isclose(qty, 1.0)
