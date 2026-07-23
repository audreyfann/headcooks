"""
Command-line entry point.

Usage:
    python -m ingredient_extractor.cli path/to/workbook.xlsx --output-dir out/
"""

from __future__ import annotations

import argparse
import os

from . import config
from .combine import build_combined_list, build_unspecified_list
from .extract import extract_workbook
from .normalize import clean_and_normalize
from .quantities import add_parsed_quantities


def run(input_path: str, output_dir: str, skip_sheets: set[str] | None = None) -> None:
    os.makedirs(output_dir, exist_ok=True)

    print(f"Reading {input_path} ...")
    raw_df = extract_workbook(input_path, skip_sheets=skip_sheets)
    print(f"  extracted {len(raw_df)} raw ingredient rows")

    clean_df, review_df = clean_and_normalize(raw_df)
    print(f"  {len(review_df)} rows flagged for manual review (likely pasted text)")

    parsed_df = add_parsed_quantities(clean_df)

    combined_df = build_combined_list(parsed_df)
    unspecified_df = build_unspecified_list(parsed_df)

    all_rows_path = os.path.join(output_dir, "all_ingredients_parsed.csv")
    combined_path = os.path.join(output_dir, "combined_shopping_list.csv")
    unspecified_path = os.path.join(output_dir, "unspecified_quantity_items.csv")
    review_path = os.path.join(output_dir, "needs_manual_review.csv")

    parsed_df.to_csv(all_rows_path, index=False)
    combined_df.to_csv(combined_path, index=False)
    unspecified_df.to_csv(unspecified_path, index=False)
    review_df.to_csv(review_path, index=False)

    print()
    print(f"Combined shopping list ({len(combined_df)} rows): {combined_path}")
    print(f"Unspecified-quantity items ({len(unspecified_df)} rows): {unspecified_path}")
    print(f"Needs manual review ({len(review_df)} rows): {review_path}")
    print(f"Full parsed detail ({len(parsed_df)} rows): {all_rows_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract and combine ingredient lists from a multi-sheet recipe workbook.")
    parser.add_argument("input", help="Path to the .xlsx workbook")
    parser.add_argument("--output-dir", default="output", help="Directory to write CSV outputs to (default: ./output)")
    parser.add_argument(
        "--skip-sheets",
        nargs="*",
        default=None,
        help="Sheet names to skip (default: %s)" % sorted(config.DEFAULT_SKIP_SHEETS),
    )
    args = parser.parse_args()

    skip_sheets = set(args.skip_sheets) if args.skip_sheets is not None else None
    run(args.input, args.output_dir, skip_sheets=skip_sheets)


if __name__ == "__main__":
    main()
