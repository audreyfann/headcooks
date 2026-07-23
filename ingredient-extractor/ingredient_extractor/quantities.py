"""
Parses free-text quantity strings (e.g. "1½ cups", "18-20", "as needed")
into (number, unit) pairs, then converts to a common base unit so the same
ingredient measured in different units can be combined:

  - Weight units (lb/oz/g/kg) merge together via grams.
  - Volume units (cup/tbsp/tsp/ml/l/qt/gal) merge together via ml.
  - Ingredients with a known density (config.STAPLE_DENSITY_G_PER_CUP) merge
    weight AND volume together via grams (e.g. flour in cups + flour in g).
  - Ingredients with a unit override (config.INGREDIENT_UNIT_OVERRIDES, e.g.
    garlic) convert everything to that ingredient's natural unit instead.
  - Everything else (clove, head, slice, bunch, stick, can, pinch, bare
    count) is kept as its own distinct, non-mergeable unit -- merging a
    "head" of garlic with a "clove" would silently corrupt the quantity.
"""

from __future__ import annotations

import re

import pandas as pd

from . import config

def _replace_fractions(s: str) -> str:
    """Replace things like '1½' -> '1.5' and bare '½' -> '0.5'."""
    for frac_char, frac_val in config.UNICODE_FRACTIONS.items():
        def _sub(m, frac_val=frac_val):
            prefix = m.group(1)
            base = int(prefix) if prefix else 0
            return str(base + frac_val)
        s = re.sub(r"(\d*)" + re.escape(frac_char), _sub, s)
    return s


def parse_quantity(raw: str) -> tuple[float | None, str | None]:
    """Returns (number, unit_code). unit_code is one of config.UNIT_MAP's
    values, or 'count' if a number was found with no recognized unit word,
    or (None, None) if nothing parseable was found (e.g. 'as needed')."""
    if not isinstance(raw, str) or not raw.strip():
        return None, None

    s = raw.strip().lower()
    if any(kw in s for kw in ["as needed", "to taste", "optional", "as desired"]):
        return None, None

    s = _replace_fractions(s)

    range_match = re.match(r"^([\d.]+)\s*[-\u2013]\s*([\d.]+)", s)
    if range_match:
        num = (float(range_match.group(1)) + float(range_match.group(2))) / 2
        rest = s[range_match.end():].strip()
    else:
        num_match = re.match(r"^([\d.]+)", s)
        if not num_match:
            return None, None
        num = float(num_match.group(1))
        rest = s[num_match.end():].strip()

    unit = "count"
    for word in rest.split():
        word_clean = re.sub(r"[^a-z]", "", word)
        if word_clean in config.UNIT_MAP:
            unit = config.UNIT_MAP[word_clean]
            break

    return num, unit


def _to_base_weight_or_volume(qty_num: float, unit: str) -> tuple[float, str] | tuple[None, None]:
    if unit in config.WEIGHT_TO_GRAMS:
        return qty_num * config.WEIGHT_TO_GRAMS[unit], "weight"
    if unit in config.VOLUME_TO_ML:
        return qty_num * config.VOLUME_TO_ML[unit], "volume"
    return None, None


def convert_row(ingredient_normalized: str, qty_num: float | None, unit: str | None) -> tuple[float | None, str | None]:
    """Convert a single (ingredient, number, unit) into (base_quantity, category).

    `category` doubles as the grouping key for combination AND tells the
    formatter which family of units to display back in.
    """
    if qty_num is None or unit is None:
        return None, None

    override = config.INGREDIENT_UNIT_OVERRIDES.get(ingredient_normalized)
    if override:
        conversions = override["conversions"]
        if unit in conversions:
            return qty_num * conversions[unit], override["display_unit"]
        return None, None  # unit not covered by the override -- can't safely convert

    density = config.STAPLE_DENSITY_G_PER_CUP.get(ingredient_normalized)
    if density is not None and (unit in config.WEIGHT_TO_GRAMS or unit in config.VOLUME_TO_ML):
        if unit in config.WEIGHT_TO_GRAMS:
            grams = qty_num * config.WEIGHT_TO_GRAMS[unit]
        else:
            cups = (qty_num * config.VOLUME_TO_ML[unit]) / config.VOLUME_TO_ML["cup"]
            grams = cups * density
        return grams, "weight_volume_merged"

    base_val, base_cat = _to_base_weight_or_volume(qty_num, unit)
    if base_val is not None:
        return base_val, base_cat

    # anything else (clove, head, slice, bunch, stick, can, pinch, count):
    # keep as its own distinct, non-mergeable category
    return qty_num, unit


def add_parsed_quantities(df: pd.DataFrame) -> pd.DataFrame:
    """Adds qty_num, qty_unit, qty_base, unit_category columns to df.
    Requires an `ingredient_normalized` column (see normalize.py)."""
    df = df.copy()
    parsed = df["quantity"].apply(parse_quantity)
    df["qty_num"] = parsed.apply(lambda t: t[0])
    df["qty_unit"] = parsed.apply(lambda t: t[1])

    converted = df.apply(
        lambda r: convert_row(r["ingredient_normalized"], r["qty_num"], r["qty_unit"]),
        axis=1,
    )
    df["qty_base"] = converted.apply(lambda t: t[0])
    df["unit_category"] = converted.apply(lambda t: t[1])

    return df


def format_display_quantity(unit_category: str, total_base_qty: float) -> tuple[float, str]:
    """Convert a summed base quantity back into a human-friendly display unit."""
    if unit_category in ("weight", "weight_volume_merged"):
        if total_base_qty >= config.WEIGHT_TO_GRAMS["lb"]:
            return round(total_base_qty / config.WEIGHT_TO_GRAMS["lb"], 2), "lb"
        if unit_category == "weight_volume_merged":
            return round(total_base_qty, 1), "g"
        return round(total_base_qty / config.WEIGHT_TO_GRAMS["oz"], 2), "oz"

    if unit_category == "volume":
        if total_base_qty >= config.VOLUME_TO_ML["cup"]:
            return round(total_base_qty / config.VOLUME_TO_ML["cup"], 2), "cup"
        if total_base_qty >= config.VOLUME_TO_ML["tbsp"]:
            return round(total_base_qty / config.VOLUME_TO_ML["tbsp"], 2), "tbsp"
        return round(total_base_qty / config.VOLUME_TO_ML["tsp"], 2), "tsp"

    # ingredient-specific override units (e.g. "clove") and bare
    # count-like units (head, slice, bunch, stick, can, pinch, count)
    return round(total_base_qty, 2), unit_category
