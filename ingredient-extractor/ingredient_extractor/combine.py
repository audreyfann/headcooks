"""
Groups parsed ingredient rows by (ingredient_normalized, unit_category) and
sums their base quantities, then converts each group back into a
human-friendly display unit.
"""

from __future__ import annotations

import pandas as pd

from .quantities import format_display_quantity


def build_combined_list(df: pd.DataFrame) -> pd.DataFrame:
    """df must already have qty_base and unit_category columns (see
    quantities.add_parsed_quantities). Returns one row per
    (ingredient, unit family) with summed, display-formatted quantities."""
    parseable = df.dropna(subset=["qty_base", "unit_category"])

    grouped = (
        parseable.groupby(["ingredient_normalized", "unit_category"], as_index=False)
        .agg(
            total_base_qty=("qty_base", "sum"),
            n_recipes=("dish", "nunique"),
            n_mentions=("ingredient", "size"),
            used_in=("dish", lambda x: ", ".join(sorted(set(x.dropna().astype(str))))),
        )
    )

    display = grouped.apply(
        lambda r: format_display_quantity(r["unit_category"], r["total_base_qty"]),
        axis=1,
    )
    grouped["display_qty"] = display.apply(lambda t: t[0])
    grouped["display_unit"] = display.apply(lambda t: t[1])

    grouped = grouped.drop(columns=["unit_category", "total_base_qty"])
    grouped = grouped[["ingredient_normalized", "display_qty", "display_unit", "n_recipes", "n_mentions", "used_in"]]
    return grouped.sort_values("ingredient_normalized").reset_index(drop=True)


def build_unspecified_list(df: pd.DataFrame) -> pd.DataFrame:
    """Ingredients that were mentioned but had no parseable quantity
    (e.g. 'salt to taste', 'garlic as needed', or free text)."""
    unparsed = df[df["qty_num"].isna()]

    grouped = (
        unparsed.groupby("ingredient_normalized", as_index=False)
        .agg(
            n_mentions=("ingredient", "size"),
            raw_quantities=("quantity", lambda x: "; ".join(sorted(set(str(v) for v in x.dropna())))),
            used_in=("dish", lambda x: ", ".join(sorted(set(x.dropna().astype(str))))),
        )
        .sort_values("n_mentions", ascending=False)
    )
    return grouped.reset_index(drop=True)
