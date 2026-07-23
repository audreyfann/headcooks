"""
Cleans raw ingredient-name strings so the same ingredient, written in
different ways, groups together (e.g. "Baby spinach" / "fresh spinach" /
"Spinach" -> "spinach"; "Kosher salt (for fries)" / "Salt" -> "salt").

Also flags rows that look like pasted recipe text rather than a real
ingredient name, so they can be routed to a manual-review pile instead of
silently corrupting the combined list.
"""

from __future__ import annotations

import re

import pandas as pd

from . import config

_VAGUE_PREFIX_RE = [re.compile(p, re.IGNORECASE) for p in config.VAGUE_QUANTITY_PREFIXES]


def strip_vague_quantity_prefix(raw: str) -> str:
    """'a drizzle of sesame oil' -> 'sesame oil'"""
    if not isinstance(raw, str):
        return raw
    s = raw.strip()
    for pattern in _VAGUE_PREFIX_RE:
        s = pattern.sub("", s)
    return s.strip()


def normalize_ingredient_name(raw: str) -> str | None:
    """Lowercase, strip parenthetical content, strip descriptor words, naive
    singularize. Returns a normalized grouping key for the ingredient."""
    if not isinstance(raw, str):
        return None

    s = raw.strip().lower()
    s = re.sub(r"\([^)]*\)", "", s)   # remove parenthetical content ENTIRELY (not just the parens)
    s = re.sub(r"\[[^\]]*\]", "", s)
    s = re.sub(r"[/,]", " ", s)
    s = re.sub(r"[^a-z\s\-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()

    tokens = [t for t in s.split(" ") if t and t not in config.NAME_MODIFIERS]
    s = " ".join(tokens).strip()

    # naive singularize: strip trailing 's' unless the word ends in 'ss' or is short
    words = []
    for w in s.split(" "):
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        words.append(w)
    s = " ".join(words).strip()

    return s if s else raw.strip().lower()


def _is_probably_pasted_text(ingredient: str) -> bool:
    if not isinstance(ingredient, str):
        return False
    too_long = len(ingredient) > config.MAX_INGREDIENT_NAME_LENGTH
    too_many_words = len(ingredient.split()) > config.MAX_INGREDIENT_NAME_WORDS
    return too_long or too_many_words


def clean_and_normalize(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Takes the raw extracted DataFrame and returns (clean_df, review_df).

    clean_df has an added `ingredient_normalized` column.
    review_df contains rows flagged as likely pasted recipe text, kept
    separately so nothing is silently dropped.
    """
    df = df.copy()
    df["ingredient"] = df["ingredient"].apply(strip_vague_quantity_prefix)

    flagged = df["ingredient"].apply(_is_probably_pasted_text)
    review_df = df[flagged].copy()
    clean_df = df[~flagged].copy()

    clean_df["ingredient_normalized"] = clean_df["ingredient"].apply(normalize_ingredient_name)

    return clean_df.reset_index(drop=True), review_df.reset_index(drop=True)
